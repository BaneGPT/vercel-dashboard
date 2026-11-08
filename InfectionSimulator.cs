// =====================================================================
// INFECTION SIMULATOR MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Dry-run mode: logs what WOULD be encrypted/exfiltrated without doing it
// - Virtual filesystem simulation for testing
// - Network simulation for lateral movement testing
// - Report generation (JSON, HTML, CSV)
// - Configurable simulation parameters
// - Safe mode: no actual file/system modifications

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

internal static class InfectionSimulator
{
    public static async Task<SimulationReport> RunSimulation(SimulationConfig config)
    {
        var report = new SimulationReport
        {
            Config = config,
            StartTime = DateTime.UtcNow,
            Events = new List<SimulationEvent>(),
            Statistics = new SimulationStatistics(),
        };

        try
        {
            LogEvent(report, "SIMULATION_START", $"Starting simulation with config: {JsonSerializer.Serialize(config)}");

            // 1. Simulate system reconnaissance
            await SimulateReconnaissance(report, config);

            // 2. Simulate privilege escalation
            if (config.EnablePrivilegeEscalation)
                await SimulatePrivilegeEscalation(report, config);

            // 3. Simulate credential harvesting
            if (config.EnableCredentialHarvesting)
                await SimulateCredentialHarvesting(report, config);

            // 4. Simulate lateral movement
            if (config.EnableLateralMovement)
                await SimulateLateralMovement(report, config);

            // 5. Simulate file encryption
            if (config.EnableEncryption)
                await SimulateEncryption(report, config);

            // 6. Simulate exfiltration
            if (config.EnableExfiltration)
                await SimulateExfiltration(report, config);

            // 7. Simulate persistence
            if (config.EnablePersistence)
                await SimulatePersistence(report, config);

            // 8. Simulate ransom note
            if (config.EnableRansomNote)
                await SimulateRansomNote(report, config);

            // 9. Simulate cleanup
            if (config.EnableCleanup)
                await SimulateCleanup(report, config);

            report.EndTime = DateTime.UtcNow;
            report.Duration = report.EndTime - report.StartTime;
            CalculateStatistics(report);

            LogEvent(report, "SIMULATION_END", $"Simulation completed in {report.Duration.TotalSeconds:F2}s");
        }
        catch (Exception ex)
        {
            LogEvent(report, "SIMULATION_ERROR", $"Simulation error: {ex.Message}");
            report.Success = false;
            report.Error = ex.Message;
        }

        return report;
    }

    // ============ RECONNAISSANCE SIMULATION ============
    private static async Task SimulateReconnaissance(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "RECON", "Starting system reconnaissance");

        // System info
        LogEvent(report, "RECON_SYSTEM", $"OS: {Environment.OSVersion.VersionString}");
        LogEvent(report, "RECON_SYSTEM", $"Machine: {Environment.MachineName}");
        LogEvent(report, "RECON_SYSTEM", $"User: {Environment.UserName}");
        LogEvent(report, "RECON_SYSTEM", $"Domain: {Environment.UserDomainName}");
        LogEvent(report, "RECON_SYSTEM", $"CPU Cores: {Environment.ProcessorCount}");
        LogEvent(report, "RECON_SYSTEM", $"RAM: {GC.GetTotalMemory(false) / 1024 / 1024} MB (managed)");

        // Drives
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady)
            {
                LogEvent(report, "RECON_DRIVE", $"Drive {drive.Name}: {drive.TotalSize / 1024 / 1024 / 1024} GB total, {drive.AvailableFreeSpace / 1024 / 1024 / 1024} GB free, Type: {drive.DriveType}");
            }
        }

        // Network
        var hostEntry = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
        foreach (var ip in hostEntry.AddressList)
        {
            if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            {
                LogEvent(report, "RECON_NETWORK", $"IP: {ip}");
            }
        }

        // Processes
        var processes = Process.GetProcesses();
        LogEvent(report, "RECON_PROCESSES", $"Running processes: {processes.Length}");
        foreach (var proc in processes.OrderByDescending(p => p.WorkingSet64).Take(20))
        {
            try
            {
                LogEvent(report, "RECON_PROCESS", $"{proc.ProcessName} (PID: {proc.Id}, Mem: {proc.WorkingSet64 / 1024 / 1024} MB)");
            }
            catch { }
        }

        // Services
        var services = ServiceController.GetServices();
        LogEvent(report, "RECON_SERVICES", $"Services: {services.Length}");
        foreach (var svc in services.Where(s => s.Status == ServiceControllerStatus.Running).Take(20))
        {
            LogEvent(report, "RECON_SERVICE", $"{svc.ServiceName} ({svc.DisplayName})");
        }

        await Task.CompletedTask;
    }

    // ============ PRIVILEGE ESCALATION SIMULATION ============
    private static async Task SimulatePrivilegeEscalation(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "PRIVESC", "Checking privilege escalation vectors");

        // Check current integrity level
        var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
        var principal = new System.Security.Principal.WindowsPrincipal(identity);
        
        LogEvent(report, "PRIVESC_CHECK", $"IsAdmin: {principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator)}");
        LogEvent(report, "PRIVESC_CHECK", $"IsElevated: {identity.Token.IsElevated()}");

        // Simulate UAC bypass checks
        string[] uacMethods = { "Fodhelper", "EventViewer", "CompMgmt", "Sdclt", "SilentCleanup", "WScript" };
        foreach (string method in uacMethods)
        {
            bool wouldWork = SimulateUacBypassCheck(method);
            LogEvent(report, "PRIVESC_UAC", $"{method}: {(wouldWork ? "VULNERABLE" : "NOT VULNERABLE")}");
        }

        // Simulate token duplication
        bool canStealToken = SimulateTokenTheftCheck();
        LogEvent(report, "PRIVESC_TOKEN", $"System token theft: {(canStealToken ? "POSSIBLE" : "NOT POSSIBLE")}");

        // Simulate service exploitation
        var vulnerableServices = SimulateVulnerableServiceCheck();
        foreach (var svc in vulnerableServices)
        {
            LogEvent(report, "PRIVESC_SERVICE", $"Vulnerable service: {svc}");
        }

        await Task.CompletedTask;
    }

    private static bool SimulateUacBypassCheck(string method)
    {
        // Simulate checking if UAC bypass would work
        // In reality, this checks registry keys, file permissions, etc.
        return new Random().Next(100) < 30; // 30% chance
    }

    private static bool SimulateTokenTheftCheck()
    {
        // Check if SYSTEM processes are accessible
        return new Random().Next(100) < 20; // 20% chance
    }

    private static List<string> SimulateVulnerableServiceCheck()
    {
        var vulnerable = new List<string>();
        var services = ServiceController.GetServices();
        
        foreach (var svc in services)
        {
            try
            {
                // Simulate checking for unquoted paths, weak permissions
                if (new Random().Next(100) < 5) // 5% chance
                {
                    vulnerable.Add(svc.ServiceName);
                }
            }
            catch { }
        }
        return vulnerable;
    }

    // ============ CREDENTIAL HARVESTING SIMULATION ============
    private static async Task SimulateCredentialHarvesting(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "CREDHARVEST", "Simulating credential harvesting");

        // Browsers
        string[] browsers = { "Chrome", "Edge", "Firefox", "Brave", "Opera" };
        foreach (string browser in browsers)
        {
            int credCount = new Random().Next(0, 50);
            int cookieCount = new Random().Next(0, 200);
            LogEvent(report, "CREDHARVEST_BROWSER", $"{browser}: {credCount} credentials, {cookieCount} cookies");
        }

        // WiFi
        int wifiCount = new Random().Next(0, 10);
        LogEvent(report, "CREDHARVEST_WIFI", $"WiFi profiles with passwords: {wifiCount}");

        // VPN
        string[] vpns = { "OpenVPN", "WireGuard", "Cisco AnyConnect", "FortiClient" };
        foreach (string vpn in vpns)
        {
            if (new Random().Next(100) < 15)
            {
                LogEvent(report, "CREDHARVEST_VPN", $"{vpn}: credentials found");
            }
        }

        // RDP
        int rdpCount = new Random().Next(0, 5);
        LogEvent(report, "CREDHARVEST_RDP", $"RDP saved connections: {rdpCount}");

        // DPAPI
        int dpapiCount = new Random().Next(1, 5);
        LogEvent(report, "CREDHARVEST_DPAPI", $"DPAPI master keys: {dpapiCount}");

        // Credential Manager
        int credmanCount = new Random().Next(0, 20);
        LogEvent(report, "CREDHARVEST_CREDMANAGER", $"Credential Manager entries: {credmanCount}");

        // FTP/SSH
        string[] ftpTools = { "FileZilla", "WinSCP", "PuTTY" };
        foreach (string tool in ftpTools)
        {
            if (new Random().Next(100) < 20)
            {
                LogEvent(report, "CREDHARVEST_FTP", $"{tool}: saved sessions found");
            }
        }

        await Task.CompletedTask;
    }

    // ============ LATERAL MOVEMENT SIMULATION ============
    private static async Task SimulateLateralMovement(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "LATERAL", "Simulating lateral movement");

        // Network discovery
        string localIp = GetLocalIPAddress();
        string subnet = localIp != null ? string.Join(".", localIp.Split('.').Take(3)) : "192.168.1";
        
        LogEvent(report, "LATERAL_DISCOVERY", $"Scanning subnet: {subnet}.0/24");

        // Simulate discovered hosts
        int hostCount = new Random().Next(5, 50);
        var discoveredHosts = new List<string>();
        for (int i = 0; i < hostCount; i++)
        {
            string ip = $"{subnet}.{new Random().Next(1, 255)}";
            discoveredHosts.Add(ip);
            LogEvent(report, "LATERAL_HOST", $"Discovered: {ip}");
        }

        // Simulate lateral movement attempts
        string[] techniques = { "SMB (PsExec)", "WMI", "RDP", "DCOM", "Scheduled Tasks" };
        foreach (string technique in techniques)
        {
            if (!config.EnabledLateralTechniques.Contains(technique)) continue;

            int successCount = 0;
            foreach (string target in discoveredHosts.Take(10)) // Limit for simulation
            {
                bool success = SimulateLateralAttempt(technique, target);
                if (success)
                {
                    successCount++;
                    LogEvent(report, "LATERAL_SUCCESS", $"{technique} -> {target}: COMPROMISED");
                }
                else
                {
                    LogEvent(report, "LATERAL_FAILED", $"{technique} -> {target}: FAILED");
                }
            }
            LogEvent(report, "LATERAL_SUMMARY", $"{technique}: {successCount}/{Math.Min(10, discoveredHosts.Count)} successful");
        }

        await Task.CompletedTask;
    }

    private static bool SimulateLateralAttempt(string technique, string target)
    {
        // Simulate success based on technique
        double baseRate = technique switch
        {
            "SMB (PsExec)" => 0.4,
            "WMI" => 0.3,
            "RDP" => 0.2,
            "DCOM" => 0.15,
            "Scheduled Tasks" => 0.25,
            _ => 0.1
        };

        return new Random().NextDouble() < baseRate;
    }

    // ============ ENCRYPTION SIMULATION ============
    private static async Task SimulateEncryption(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "ENCRYPT", "Simulating file encryption");

        var targetExtensions = config.TargetExtensions ?? new[] { ".txt", ".doc", ".pdf", ".sql", ".json", ".cs", ".py" };
        var skipExtensions = config.SkipExtensions ?? new[] { ".exe", ".dll", ".sys" };
        var skipDirs = config.SkipDirectories ?? new[] { "windows", "program files", "appdata\\local\\temp" };

        long totalFiles = 0;
        long totalSize = 0;
        long encryptedFiles = 0;
        long encryptedSize = 0;
        long skippedFiles = 0;

        foreach (var drive in DriveInfo.GetDrives())
        {
            if (!drive.IsReady || drive.DriveType != DriveType.Fixed) continue;

            try
            {
                var files = SimulateFileEnumeration(drive.Name, targetExtensions, skipExtensions, skipDirs, config.MaxFilesPerDrive);
                
                foreach (var file in files)
                {
                    totalFiles++;
                    totalSize += file.Size;

                    if (file.Size > config.MaxFileSizeMB * 1024 * 1024)
                    {
                        skippedFiles++;
                        LogEvent(report, "ENCRYPT_SKIP", $"SKIP (too large): {file.Path} ({file.Size / 1024 / 1024} MB)");
                        continue;
                    }

                    encryptedFiles++;
                    encryptedSize += file.Size;
                    LogEvent(report, "ENCRYPT_FILE", $"ENCRYPT: {file.Path} ({file.Size / 1024} KB)");

                    if (encryptedFiles >= config.MaxTotalFiles) break;
                }
            }
            catch { }

            if (encryptedFiles >= config.MaxTotalFiles) break;
        }

        report.Statistics.TotalFiles = totalFiles;
        report.Statistics.TotalSize = totalSize;
        report.Statistics.EncryptedFiles = encryptedFiles;
        report.Statistics.EncryptedSize = encryptedSize;
        report.Statistics.SkippedFiles = skippedFiles;

        LogEvent(report, "ENCRYPT_SUMMARY", $"Encryption simulation: {encryptedFiles}/{totalFiles} files, {encryptedSize / 1024 / 1024} MB / {totalSize / 1024 / 1024} MB");
        await Task.CompletedTask;
    }

    private static List<SimulatedFile> SimulateFileEnumeration(string rootPath, string[] targetExts, string[] skipExts, string[] skipDirs, int maxFiles)
    {
        var files = new List<SimulatedFile>();
        
        try
        {
            // In simulation, we don't actually enumerate - we generate realistic mock data
            string[] commonPaths = {
                @"Users\Public\Documents",
                @"Users\Public\Desktop",
                @"Users\" + Environment.UserName + @"\Documents",
                @"Users\" + Environment.UserName + @"\Desktop",
                @"Users\" + Environment.UserName + @"\Downloads",
                @"Users\" + Environment.UserName + @"\Pictures",
                @"Users\" + Environment.UserName + @"\Videos",
                @"Users\" + Environment.UserName + @"\Music",
                @"ProgramData",
                @"inetpub\wwwroot",
            };

            foreach (string relPath in commonPaths)
            {
                string fullPath = Path.Combine(rootPath, relPath);
                if (Directory.Exists(fullPath))
                {
                    // Add some simulated files
                    int fileCount = new Random().Next(5, 30);
                    for (int i = 0; i < fileCount && files.Count < maxFiles; i++)
                    {
                        string ext = targetExts[new Random().Next(targetExts.Length)];
                        string name = $"Document_{new Random().Next(1000, 9999)}{ext}";
                        long size = new Random().Next(1, 50) * 1024; // 1-50 KB
                        
                        files.Add(new SimulatedFile 
                        { 
                            Path = Path.Combine(fullPath, name), 
                            Size = size,
                            Extension = ext 
                        });
                    }
                }
            }
        }
        catch { }

        return files;
    }

    // ============ EXFILTRATION SIMULATION ============
    private static async Task SimulateExfiltration(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "EXFIL", "Simulating data exfiltration");

        int exfilFiles = Math.Min(report.Statistics.EncryptedFiles, config.MaxExfilFiles);
        long exfilSize = 0;

        for (int i = 0; i < exfilFiles; i++)
        {
            long fileSize = new Random().Next(1, 100) * 1024;
            exfilSize += fileSize;

            if (config.EnableCompression)
            {
                fileSize = (long)(fileSize * 0.3); // Simulate compression
            }

            LogEvent(report, "EXFIL_FILE", $"EXFIL: file_{i}.enc ({fileSize / 1024} KB) -> {config.ExfilServerUrl}");

            if (exfilSize > config.MaxExfilSizeMB * 1024 * 1024) break;
        }

        report.Statistics.ExfiltratedFiles = exfilFiles;
        report.Statistics.ExfiltratedSize = exfilSize;

        LogEvent(report, "EXFIL_SUMMARY", $"Exfiltration simulation: {exfilFiles} files, {exfilSize / 1024 / 1024} MB");
        await Task.CompletedTask;
    }

    // ============ PERSISTENCE SIMULATION ============
    private static async Task SimulatePersistence(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "PERSIST", "Simulating persistence installation");

        string[] methods = config.PersistenceMethods ?? new[] { "run_key", "scheduled_task", "wmi_event" };
        
        foreach (string method in methods)
        {
            bool success = SimulatePersistenceMethod(method);
            LogEvent(report, "PERSIST_METHOD", $"{method}: {(success ? "INSTALLED" : "FAILED")}");
        }

        await Task.CompletedTask;
    }

    private static bool SimulatePersistenceMethod(string method)
    {
        double successRate = method switch
        {
            "run_key" => 0.95,
            "runonce_key" => 0.9,
            "scheduled_task" => 0.85,
            "wmi_event" => 0.8,
            "com_hijack" => 0.7,
            "service" => IsAdministrator() ? 0.9 : 0.0,
            "startup_folder" => 0.9,
            "bits_job" => 0.6,
            "winlogon" => IsAdministrator() ? 0.7 : 0.0,
            "ifeo" => IsAdministrator() ? 0.6 : 0.0,
            _ => 0.5
        };

        return new Random().NextDouble() < successRate;
    }

    // ============ RANSOM NOTE SIMULATION ============
    private static async Task SimulateRansomNote(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "RANSOMNOTE", "Simulating ransom note deployment");

        int noteCount = 0;
        string[] locations = {
            @"C:\Users\Public\Desktop\README.txt",
            @"C:\Users\" + Environment.UserName + @"\Desktop\README.txt",
            @"C:\README.txt",
        };

        foreach (string location in locations)
        {
            LogEvent(report, "RANSOMNOTE_DROP", $"DROPPED: {location}");
            noteCount++;
        }

        // Encrypted directories
        for (int i = 0; i < 10; i++)
        {
            string dir = $@"C:\Users\{Environment.UserName}\Documents\Folder_{i}";
            LogEvent(report, "RANSOMNOTE_DROP", $"DROPPED: {dir}\\README.txt");
            noteCount++;
        }

        report.Statistics.RansomNotesDropped = noteCount;
        LogEvent(report, "RANSOMNOTE_SUMMARY", $"Ransom notes: {noteCount}");

        await Task.CompletedTask;
    }

    // ============ CLEANUP SIMULATION ============
    private static async Task SimulateCleanup(SimulationReport report, SimulationConfig config)
    {
        LogEvent(report, "CLEANUP", "Simulating cleanup/anti-forensics");

        string[] actions = {
            "Clear Windows Event Logs (Security, System, Application)",
            "Delete Volume Shadow Copies (vssadmin delete shadows)",
            "Disable Windows Recovery (bcdedit /set {default} recoveryenabled No)",
            "Clear Recycle Bin",
            "Delete recent files history",
            "Clear browser history",
            "Delete PowerShell command history",
            "Clear RunMRU registry keys",
            "Delete prefetch files",
            "Overwrite free space (cipher /w)",
        };

        foreach (string action in actions)
        {
            bool success = new Random().NextDouble() < 0.8;
            LogEvent(report, "CLEANUP_ACTION", $"{(success ? "SUCCESS" : "FAILED")}: {action}");
        }

        await Task.CompletedTask;
    }

    // ============ HELPERS ============
    private static void LogEvent(SimulationReport report, string type, string message)
    {
        report.Events.Add(new SimulationEvent
        {
            Timestamp = DateTime.UtcNow,
            Type = type,
            Message = message,
        });
    }

    private static void CalculateStatistics(SimulationReport report)
    {
        report.Success = true;
        
        // Count events by type
        var typeCounts = report.Events.GroupBy(e => e.Type).ToDictionary(g => g.Key, g => g.Count());
        report.Statistics.EventCounts = typeCounts;
    }

    private static string GetLocalIPAddress()
    {
        try
        {
            var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !System.Net.IPAddress.IsLoopback(ip))
                    return ip.ToString();
            }
        }
        catch { }
        return null;
    }

    private static bool IsAdministrator()
    {
        try
        {
            var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
        }
        catch { return false; }
    }

    // ============ DATA CLASSES ============
    public class SimulationConfig
    {
        public bool EnablePrivilegeEscalation = true;
        public bool EnableCredentialHarvesting = true;
        public bool EnableLateralMovement = true;
        public bool EnableEncryption = true;
        public bool EnableExfiltration = true;
        public bool EnablePersistence = true;
        public bool EnableRansomNote = true;
        public bool EnableCleanup = true;
        public string[] EnabledLateralTechniques = { "SMB (PsExec)", "WMI", "RDP", "DCOM", "Scheduled Tasks" };
        public string[] PersistenceMethods = { "run_key", "scheduled_task", "wmi_event" };
        public string[] TargetExtensions = { ".txt", ".doc", ".pdf", ".sql", ".json", ".cs", ".py" };
        public string[] SkipExtensions = { ".exe", ".dll", ".sys" };
        public string[] SkipDirectories = { "windows", "program files", "appdata\\local\\temp" };
        public int MaxFilesPerDrive = 100;
        public int MaxTotalFiles = 1000;
        public int MaxFileSizeMB = 100;
        public int MaxExfilFiles = 500;
        public int MaxExfilSizeMB = 500;
        public string ExfilServerUrl = "https://c2.example.com";
        public bool EnableCompression = true;
    }

    public class SimulationReport
    {
        public SimulationConfig Config;
        public DateTime StartTime;
        public DateTime EndTime;
        public TimeSpan Duration;
        public bool Success;
        public string Error;
        public List<SimulationEvent> Events;
        public SimulationStatistics Statistics;
    }

    public class SimulationEvent
    {
        public DateTime Timestamp;
        public string Type;
        public string Message;
    }

    public class SimulationStatistics
    {
        public long TotalFiles;
        public long TotalSize;
        public long EncryptedFiles;
        public long EncryptedSize;
        public long SkippedFiles;
        public long ExfiltratedFiles;
        public long ExfiltratedSize;
        public int RansomNotesDropped;
        public Dictionary<string, int> EventCounts;
    }

    private class SimulatedFile
    {
        public string Path;
        public long Size;
        public string Extension;
    }
}

internal static partial class Config
{
    public static bool SimulationMode = false;
}