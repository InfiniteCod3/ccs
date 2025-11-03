# CCS - Claude Code Switch (Windows PowerShell)
# Cross-platform Claude CLI profile switcher
# https://github.com/kaitranntt/ccs

param(
    [Parameter(Position=0)]
    [string]$ProfileOrFlag = "default",

    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

# Version - Read from VERSION file
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VersionFile = Join-Path $ScriptDir "VERSION"
$CCS_VERSION = if (Test-Path $VersionFile) {
    (Get-Content $VersionFile -Raw).Trim()
} else {
    "unknown"
}

# Installation function for commands and skills
function Install-CommandsAndSkills {
    $SourceDir = Join-Path $ScriptDir ".claude"
    $TargetDir = Join-Path $env:USERPROFILE ".claude"

    Write-Host "[Installing CCS Commands & Skills]" -ForegroundColor Cyan
    Write-Host "|  Source: $SourceDir"
    Write-Host "|  Target: $TargetDir"
    Write-Host "|"

    # Check if source directory exists
    if (-not (Test-Path $SourceDir)) {
        Write-Host "|"
        Write-Host "[ERROR] Source directory not found: $SourceDir" -ForegroundColor Red
        Write-Host "  Make sure you're running this from the CCS repository directory."
        exit 1
    }

    # Create target directories if they don't exist
    $CommandsDir = Join-Path $TargetDir "commands"
    $SkillsDir = Join-Path $TargetDir "skills"

    if (-not (Test-Path $CommandsDir)) {
        New-Item -ItemType Directory -Path $CommandsDir -Force | Out-Null
    }
    if (-not (Test-Path $SkillsDir)) {
        New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
    }

    $InstalledCount = 0
    $SkippedCount = 0

    # Install commands
    $SourceCommandsDir = Join-Path $SourceDir "commands"
    if (Test-Path $SourceCommandsDir) {
        Write-Host "|  Installing commands..." -ForegroundColor Yellow
        Get-ChildItem $SourceCommandsDir -Filter "*.md" | ForEach-Object {
            $CmdName = $_.BaseName
            $TargetFile = Join-Path $CommandsDir "$CmdName.md"

            if (Test-Path $TargetFile) {
                Write-Host "|  |  [i]  Skipping existing command: $CmdName.md" -ForegroundColor Yellow
                $SkippedCount++
            } else {
                try {
                    Copy-Item $_.FullName $TargetFile -ErrorAction Stop
                    Write-Host "|  |  [OK] Installed command: $CmdName.md" -ForegroundColor Green
                    $InstalledCount++
                } catch {
                    Write-Host "|  |  [!]  Failed to install command: $CmdName.md" -ForegroundColor Red
                    Write-Host "|       Error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "|  [i]  No commands directory found" -ForegroundColor Gray
    }

    Write-Host "|"

    # Install skills
    $SourceSkillsDir = Join-Path $SourceDir "skills"
    if (Test-Path $SourceSkillsDir) {
        Write-Host "|  Installing skills..." -ForegroundColor Yellow
        Get-ChildItem $SourceSkillsDir -Directory | ForEach-Object {
            $SkillName = $_.Name
            $TargetSkillDir = Join-Path $SkillsDir $SkillName

            if (Test-Path $TargetSkillDir) {
                Write-Host "|  |  [i]  Skipping existing skill: $SkillName" -ForegroundColor Yellow
                $SkippedCount++
            } else {
                try {
                    Copy-Item $_.FullName $TargetSkillDir -Recurse -ErrorAction Stop
                    Write-Host "|  |  [OK] Installed skill: $SkillName" -ForegroundColor Green
                    $InstalledCount++
                } catch {
                    Write-Host "|  |  [!]  Failed to install skill: $SkillName" -ForegroundColor Red
                    Write-Host "|       Error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "|  [i]  No skills directory found" -ForegroundColor Gray
    }

    Write-Host "[DONE]"
    Write-Host ""
    Write-Host "[OK] Installation complete!" -ForegroundColor Green
    Write-Host "  Installed: $InstalledCount items"
    Write-Host "  Skipped: $SkippedCount items (already exist)"
    Write-Host ""
    Write-Host "You can now use the /ccs command in Claude CLI for task delegation." -ForegroundColor Cyan
    Write-Host "Example: /ccs glm /plan 'add user authentication'" -ForegroundColor Cyan
}

# Special case: version command (check BEFORE profile detection)
# Check both $ProfileOrFlag and first element of $RemainingArgs
$FirstArg = if ($ProfileOrFlag -ne "default") { $ProfileOrFlag } elseif ($RemainingArgs.Count -gt 0) { $RemainingArgs[0] } else { $null }
if ($FirstArg -eq "version" -or $FirstArg -eq "--version" -or $FirstArg -eq "-v") {
    Write-Host "CCS (Claude Code Switch) version $CCS_VERSION"
    Write-Host "https://github.com/kaitranntt/ccs"
    exit 0
}

# Special case: help command (check BEFORE profile detection)
if ($FirstArg -eq "--help" -or $FirstArg -eq "-h" -or $FirstArg -eq "help") {
    try {
        if ($RemainingArgs) {
            & claude --help @RemainingArgs
        } else {
            & claude --help
        }
        exit $LASTEXITCODE
    } catch {
        Write-Host "Error: Failed to execute claude --help" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}

# Special case: install command (check BEFORE profile detection)
if ($FirstArg -eq "--install") {
    Install-CommandsAndSkills
    exit $LASTEXITCODE
}

# Smart profile detection: if first arg starts with '-', it's a flag not a profile
if ($ProfileOrFlag -match '^-') {
    # First arg is a flag → use default profile, keep all args
    $Profile = "default"
    # Prepend $ProfileOrFlag to $RemainingArgs (it's actually a flag, not a profile)
    if ($RemainingArgs) {
        $RemainingArgs = @($ProfileOrFlag) + $RemainingArgs
    } else {
        $RemainingArgs = @($ProfileOrFlag)
    }
} else {
    # First arg is a profile name
    $Profile = $ProfileOrFlag
    # $RemainingArgs already contains correct args (PowerShell handles this)
}

# Special case: "default" profile just runs claude directly (no profile switching)
if ($Profile -eq "default") {
    try {
        if ($RemainingArgs) {
            & claude @RemainingArgs
        } else {
            & claude
        }
        exit $LASTEXITCODE
    } catch {
        Write-Host "Error: Failed to execute claude" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}

# Config file location (supports environment variable override)
$ConfigFile = if ($env:CCS_CONFIG) {
    $env:CCS_CONFIG
} else {
    "$env:USERPROFILE\.ccs\config.json"
}

# Check config exists
if (-not (Test-Path $ConfigFile)) {
    Write-Host "Error: Config file not found: $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create $env:USERPROFILE\.ccs\config.json with your profile mappings."
    Write-Host "See .ccs.example.json for template."
    exit 1
}

# Validate profile name (alphanumeric, dash, underscore only)
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-Host "Error: Invalid profile name. Use only alphanumeric characters, dash, or underscore." -ForegroundColor Red
    exit 1
}

# Read and parse JSON config
try {
    $ConfigContent = Get-Content $ConfigFile -Raw -ErrorAction Stop
    $Config = $ConfigContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Error: Invalid JSON in $ConfigFile" -ForegroundColor Red
    exit 1
}

# Validate config has profiles object
if (-not $Config.profiles) {
    Write-Host "Error: Config must have 'profiles' object" -ForegroundColor Red
    Write-Host "See .ccs.example.json for correct format"
    exit 1
}

# Get settings path for profile
$SettingsPath = $Config.profiles.$Profile

if (-not $SettingsPath) {
    Write-Host "Error: Profile '$Profile' not found in $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available profiles:"
    $Config.profiles.PSObject.Properties.Name | ForEach-Object {
        Write-Host "  - $_"
    }
    exit 1
}

# Path expansion and normalization
# 1. Handle Unix-style tilde expansion (~/path -> %USERPROFILE%\path)
if ($SettingsPath -match '^~[/\\]') {
    $SettingsPath = $SettingsPath -replace '^~', $env:USERPROFILE
}

# 2. Expand Windows environment variables (%USERPROFILE%, etc.)
$SettingsPath = [System.Environment]::ExpandEnvironmentVariables($SettingsPath)

# 3. Convert forward slashes to backslashes (Unix path compatibility)
$SettingsPath = $SettingsPath -replace '/', '\'

# Validate settings file exists
if (-not (Test-Path $SettingsPath)) {
    Write-Host "Error: Settings file not found: $SettingsPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "  1. Create the settings file:"
    Write-Host "     New-Item -ItemType File -Force -Path '$SettingsPath'"
    Write-Host "     Set-Content -Path '$SettingsPath' -Value '{`"env`":{}}`'"
    Write-Host ""
    Write-Host "  2. Or update profile path in $ConfigFile"
    Write-Host ""
    Write-Host "  3. Or reinstall: irm ccs.kaitran.ca/install.ps1 | iex"
    exit 1
}

# Validate settings file is valid JSON (basic check)
try {
    $SettingsContent = Get-Content $SettingsPath -Raw -ErrorAction Stop
    $Settings = $SettingsContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Error: Invalid JSON in $SettingsPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Details: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "  1. Validate JSON at https://jsonlint.com"
    Write-Host "  2. Or reset to template:"
    Write-Host "     Set-Content -Path '$SettingsPath' -Value '{`"env`":{}}`'"
    Write-Host ""
    Write-Host "  3. Or reinstall: irm ccs.kaitran.ca/install.ps1 | iex"
    exit 1
}

# Execute claude with settings file (using --settings flag)
try {
    if ($RemainingArgs) {
        & claude --settings $SettingsPath @RemainingArgs
    } else {
        & claude --settings $SettingsPath
    }
    exit $LASTEXITCODE
} catch {
    Write-Host "Error: Failed to execute claude" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
