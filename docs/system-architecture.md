# CCS System Architecture

## Overview

CCS (Claude Code Switch) is a lightweight CLI wrapper that provides instant profile switching between Claude Sonnet 4.5 and GLM 4.6 models. Current version **v3.3.0** features GLMT thinking mode with embedded proxy architecture, debug logging, and refined configuration management.

## Core Architecture Principles

### Design Philosophy
- **YAGNI** (You Aren't Gonna Need It): No features "just in case"
- **KISS** (Keep It Simple): Minimal complexity, maximum reliability
- **DRY** (Don't Repeat Yourself): Single source of truth for each concern

### Simplification Goals
- Consolidate duplicate logic into reusable functions
- Remove unnecessary validation layers ("security theater")
- Simplify error handling and messaging
- Maintain cross-platform compatibility

## High-Level Architecture

```mermaid
graph TB
    subgraph "User Interface Layer"
        CLI[Command Line Interface]
        FLAGS[Special Flag Handlers]
    end

    subgraph "Core Processing Layer"
        DETECT[Profile Detection Logic]
        CONFIG[Configuration Manager]
        SPAWN[Unified Spawn Executor]
    end

    subgraph "System Integration Layer"
        CLAUDE[Claude CLI Detector]
        PATH[Path Resolution]
        ENV[Environment Variables]
    end

    subgraph "External Dependencies"
        CLAUDE_EXEC[Claude CLI Executable]
        SETTINGS[Claude Settings Files]
    end

    CLI --> DETECT
    FLAGS --> SPAWN
    DETECT --> CONFIG
    CONFIG --> SPAWN
    SPAWN --> CLAUDE
    CLAUDE --> PATH
    CLAUDE --> ENV
    SPAWN --> CLAUDE_EXEC
    CONFIG --> SETTINGS
```

## Component Architecture

### 1. Main Entry Point (`bin/ccs.js`)

**Role**: Central orchestrator for all CCS operations

**Key Responsibilities**:
- Argument parsing and profile detection
- Special command handling (--version, --help, auth, doctor) [--install/--uninstall WIP]
- Profile type routing (settings-based vs account-based)
- GLMT proxy lifecycle management
- Unified process execution through `execClaude()`
- Error propagation and exit code management
- Auto-recovery for missing configuration

**Architecture with GLMT Support (v3.3.0)**:
```mermaid
graph TD
    subgraph "Entry Point"
        ARGS[Parse Arguments]
        SPECIAL[Handle Special Commands]
        RECOVER[Auto-recovery]
        DETECT[ProfileDetector]
        SETTINGS[Settings-based Profile]
        GLMT{GLMT Profile?}
        ACCOUNT[Account-based Profile]
        PROXY[Spawn Proxy]
        EXEC[Execute Claude]
    end

    ARGS --> SPECIAL
    SPECIAL --> RECOVER
    RECOVER --> DETECT
    DETECT --> SETTINGS
    DETECT --> ACCOUNT
    SETTINGS --> GLMT
    GLMT -->|Yes| PROXY
    GLMT -->|No| EXEC
    PROXY --> EXEC
    ACCOUNT --> EXEC
```

**Key Enhancements**:
- **v3.3.0**: GLMT proxy spawning with verbose flag detection, API key validation, 5s timeout
- **v3.2.0**: Dual-path execution supporting both `--settings` flag (backward compatible) and `CLAUDE_CONFIG_DIR` env var (concurrent sessions)
- **v3.1.0**: Auto-recovery manager for missing configs

**GLMT-Specific Logic**:
```javascript
// Check if GLMT profile
if (profileInfo.name === 'glmt') {
  // 1. Read API key from settings
  // 2. Spawn proxy with --verbose flag (if detected in args)
  // 3. Wait for PROXY_READY:port signal (5s timeout)
  // 4. Spawn Claude CLI with proxy URL
  // 5. Kill proxy when Claude exits
  await execClaudeWithProxy(claudeCli, 'glmt', remainingArgs);
}
```

### 2. Configuration Manager (`bin/config-manager.js`)

**Role**: Handles all configuration-related operations

**Key Responsibilities**:
- Configuration file path resolution
- JSON parsing and validation
- Profile-to-settings-file mapping
- Error handling for configuration issues

**Architecture Flow**:
```mermaid
graph TD
    PATH[Get Config Path] --> READ[Read Config File]
    READ --> PARSE[Parse JSON]
    PARSE --> VALIDATE[Validate Structure]
    VALIDATE --> MAP[Map Profile to Settings]
    MAP --> RETURN[Return Settings Path]
```

**Simplified Validation**: Removed redundant validation functions while maintaining essential checks for file existence and JSON validity.

### 3. Claude CLI Detector (`bin/claude-detector.js`)

**Role**: Locates and validates the Claude CLI executable

**Key Responsibilities**:
- Environment variable override support (`CCS_CLAUDE_PATH`)
- System PATH resolution
- Cross-platform executable detection
- Windows-specific executable extension handling

**Detection Priority**:
```mermaid
graph TD
    ENV[CCS_CLAUDE_PATH] --> VALID{Valid Path?}
    VALID -->|Yes| USE_ENV[Use Environment Path]
    VALID -->|No| PATH[System PATH Lookup]
    PATH --> FOUND{Found in PATH?}
    FOUND -->|Yes| USE_PATH[Use PATH Result]
    FOUND -->|No| FAIL[Return null]
```

**Platform-Specific Logic**:
- **Unix/macOS**: Uses `which claude` command
- **Windows**: Uses `where.exe claude` with extension preference
- **Cross-platform**: Unified error handling and fallback logic

### 4. Helpers Module (`bin/helpers.js`)

**Role**: Provides essential utility functions

**Key Responsibilities**:
- TTY-aware color formatting
- Path expansion with tilde and environment variables
- Simplified error reporting
- Cross-platform compatibility

**Removed Functions** (Security Theater):
- `escapeShellArg()`: Unnecessary with spawn() arrays
- `validateProfileName()`: Redundant validation
- `isPathSafe()`: Excessive security checking

### 5. Instance Manager (`bin/instance-manager.js`) - NEW in 

**Role**: Manages isolated Claude CLI instances per profile

**Key Responsibilities**:
- Lazy instance initialization on first use (YAGNI principle)
- Instance directory creation (`~/.ccs/instances/<profile>/`)
- Credential synchronization from vault to instance
- Instance integrity validation
- Instance lifecycle management (create, validate, delete)

**Architecture Flow**:
```mermaid
graph TD
    ACTIVATE[activateInstance] --> EXISTS{Instance exists?}
    EXISTS -->|No| INIT[initializeInstance]
    EXISTS -->|Yes| SYNC[syncCredentialsToInstance]
    INIT --> SYNC
    SYNC --> VALIDATE[validateInstance]
    VALIDATE --> RETURN[Return instance path]
```

**Directory Structure Created**:
```
~/.ccs/instances/<profile>/
├── session-env/           # Claude session data
├── todos/                 # Per-profile todo lists
├── logs/                  # Execution logs
├── file-history/          # File edit history
├── shell-snapshots/       # Shell state snapshots
├── debug/                 # Debug information
├── .anthropic/            # Anthropic SDK config
├── commands/              # Custom commands (copied from global)
├── skills/                # Custom skills (copied from global)
└── .credentials.json      # Encrypted credentials (synced from vault)
```

### 6. Profile Detector (`bin/profile-detector.js`) - NEW in 

**Role**: Determines profile type for routing

**Key Responsibilities**:
- Detect settings-based profiles (glm, kimi) - Priority 1 for backward compatibility
- Detect account-based profiles (work, personal) - Priority 2
- Resolve default profile across both types
- Provide error messages with available profiles

**Detection Priority**:
```mermaid
graph TD
    INPUT[Profile name] --> SETTINGS{In config.json?}
    SETTINGS -->|Yes| RETURN_SETTINGS[Return: type=settings]
    SETTINGS -->|No| ACCOUNT{In profiles.json?}
    ACCOUNT -->|Yes| RETURN_ACCOUNT[Return: type=account]
    ACCOUNT -->|No| ERROR[Throw: Profile not found]
```

### 7. Profile Registry (`bin/profile-registry.js`) - NEW in 

**Role**: Manages account profile metadata

**Key Responsibilities**:
- CRUD operations for account profiles in `~/.ccs/profiles.json`
- Default profile management
- Last-used timestamp tracking
- Atomic file writes for data integrity

**Profile Metadata Schema**:
```json
{
  "version": "2.0.0",
  "profiles": {
    "work": {
      "type": "account",
      "vault": "~/.ccs/accounts/work.json.enc",
      "subscription": "pro",
      "email": "user@work.com",
      "created": "2025-11-09T...",
      "last_used": "2025-11-09T..."
    }
  },
  "default": "work"
}
```
## GLMT Architecture (v3.2.0+)

### Overview

GLMT (GLM with Thinking) uses an embedded HTTP proxy to enable thinking mode support for GLM 4.6. The proxy converts between Anthropic and OpenAI formats, injecting reasoning parameters and transforming `reasoning_content` into thinking blocks.

### Components

**1. GLMT Transformer (`bin/glmt-transformer.js`)**
- Converts Anthropic Messages API → OpenAI Chat Completions format
- Extracts thinking control tags: `<Thinking:On|Off>`, `<Effort:Low|Medium|High>` (effort deprecated)
- Injects reasoning parameters: `reasoning: true` (binary only - Z.AI constraint)
- Transforms OpenAI `reasoning_content` → Anthropic thinking blocks
- Generates thinking signatures for Claude Code UI
- Debug logging to `~/.ccs/logs/` when `CCS_DEBUG_LOG=1`

**Control Mechanisms** (v3.6):
- **Locale enforcer** (`bin/locale-enforcer.js`): Force English output (prevents Chinese responses)
- **Budget calculator** (`bin/budget-calculator.js`): Thinking on/off based on task type + budget
- **Task classifier** (`bin/task-classifier.js`): Classify reasoning vs execution tasks
- **Loop detection** (`bin/delta-accumulator.js`): Break unbounded planning loops (3 blocks)

**2. GLMT Proxy (`bin/glmt-proxy.js`)**
- Embedded HTTP server on `127.0.0.1:random_port`
- Intercepts Claude CLI → Z.AI requests
- Lifecycle tied to parent process
- Buffered mode only (streaming not supported)
- Request timeout: 120s default

### GLMT Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant CCS as ccs.js
    participant Proxy as glmt-proxy.js
    participant Transformer as glmt-transformer.js
    participant ZAI as Z.AI API
    participant Claude as Claude CLI

    User->>CCS: ccs glmt "solve problem"
    CCS->>CCS: Read GLMT settings (API key, config)
    CCS->>Proxy: Spawn proxy with --verbose flag
    Proxy->>Proxy: Bind to 127.0.0.1:random_port
    Proxy-->>CCS: PROXY_READY:port
    CCS->>Claude: Spawn with ANTHROPIC_BASE_URL=http://127.0.0.1:port
    Claude->>Proxy: POST /v1/messages (Anthropic format)
    Proxy->>Transformer: transformRequest(anthropicRequest)
    Transformer->>Transformer: Extract thinking control tags
    Transformer->>Transformer: Inject reasoning params
    Transformer-->>Proxy: OpenAI format request
    Proxy->>ZAI: POST /api/coding/paas/v4/chat/completions
    ZAI-->>Proxy: OpenAI response (with reasoning_content)
    Proxy->>Transformer: transformResponse(openaiResponse)
    Transformer->>Transformer: Convert reasoning_content → thinking blocks
    Transformer-->>Proxy: Anthropic format response
    Proxy-->>Claude: Return Anthropic response
    Claude-->>User: Display with thinking blocks
    Claude->>CCS: Exit
    CCS->>Proxy: Kill (SIGTERM)
```

### Debug Mode Architecture

**Verbose Logging** (`--verbose` flag):
- Console logging with timestamps
- Request/response size tracking
- Transformation validation results
- Proxy lifecycle events

**Debug File Logging** (`CCS_DEBUG_LOG=1`):
- Writes to `~/.ccs/logs/`
- Files: `{timestamp}-request-anthropic.json`, `request-openai.json`, `response-openai.json`, `response-anthropic.json`
- Pretty-printed JSON with full request/response data
- **[!] Warning**: Contains sensitive data (API keys, prompts)

**Debug Workflow**:
```bash
# Enable both verbose and debug logging
export CCS_DEBUG_LOG=1
ccs glmt --verbose "test prompt"

# Check reasoning content
cat ~/.ccs/logs/*response-openai.json | jq '.choices[0].message.reasoning_content'

# Verify transformation
cat ~/.ccs/logs/*response-anthropic.json | jq '.content[] | select(.type=="thinking")'
```

### Configuration Migration (v3.2.0 → v3.3.0)

**Automatic Migration** (postinstall script):
```javascript
// Added fields in v3.3.0
{
  "env": {
    "ANTHROPIC_TEMPERATURE": "0.2",        // New
    "ANTHROPIC_MAX_TOKENS": "65536",       // New
    "MAX_THINKING_TOKENS": "32768",        // New
    "ENABLE_STREAMING": "true",            // New
    "ANTHROPIC_SAFE_MODE": "false",        // New
    "API_TIMEOUT_MS": "3000000"            // New (50 minutes)
  },
  "alwaysThinkingEnabled": true            // New
}
```

**Removed/Obsolete Fields** (from v3.2.0):
- `BASH_DEFAULT_TIMEOUT_MS` - Moved to Claude CLI config
- `BASH_MAX_TIMEOUT_MS` - Moved to Claude CLI config
- `DISABLE_TELEMETRY` - No longer needed
- `ENABLE_THINKING` - Replaced by `alwaysThinkingEnabled`

### Proxy Lifecycle Management

**Startup**:
1. CCS spawns `node bin/glmt-proxy.js`
2. Proxy binds to `127.0.0.1:0` (random port)
3. Proxy emits `PROXY_READY:port` to stdout
4. CCS reads port, spawns Claude CLI with proxy URL
5. Timeout: 5s (configurable)

**Cleanup**:
- Claude CLI exits → CCS kills proxy (`SIGTERM`)
- Parent process dies → Proxy auto-terminates
- Uncaught exception → Proxy logs and exits

**Error Handling**:
- Proxy startup timeout → Show workaround (use `ccs glm`)
- Port conflict → Uses random port (unlikely)
- Upstream timeout → 120s default, configurable

## Data Flow Architecture

### Settings-Based Profile Execution Flow (Backward Compatible)

```mermaid
sequenceDiagram
    participant User
    participant CCS as ccs.js
    participant Detector as profile-detector.js
    participant Config as config-manager.js
    participant Claude as Claude CLI

    User->>CCS: ccs glm "command"
    CCS->>CCS: Parse arguments
    CCS->>Detector: detectProfileType("glm")
    Detector->>Detector: Check config.json
    Detector-->>CCS: {type: "settings", settingsPath: ...}
    CCS->>Config: getSettingsPath("glm")
    Config-->>CCS: Return settings path
    CCS->>Claude: execClaude(["--settings", path, "command"])
    Claude->>User: Execute with GLM profile
```

### Account-Based Profile Execution Flow (Concurrent Sessions)

```mermaid
sequenceDiagram
    participant User
    participant CCS as ccs.js
    participant Detector as profile-detector.js
    participant Instance as instance-manager.js
    participant Vault as vault-manager.js
    participant Registry as profile-registry.js
    participant Claude as Claude CLI

    User->>CCS: ccs work "command"
    CCS->>Detector: detectProfileType("work")
    Detector->>Detector: Check profiles.json
    Detector-->>CCS: {type: "account", name: "work"}
    CCS->>Instance: activateInstance("work")
    Instance->>Instance: Check if instance exists
    alt Instance not exists
        Instance->>Instance: initializeInstance (create dirs)
    end
    Instance->>Vault: decryptCredentials("work")
    Vault-->>Instance: Return credentials JSON
    Instance->>Instance: Write to instance/.credentials.json
    Instance->>Instance: validateInstance (check integrity)
    Instance-->>CCS: Return instance path
    CCS->>Registry: touchProfile("work")
    Registry->>Registry: Update last_used timestamp
    CCS->>Claude: execClaude(["command"], {CLAUDE_CONFIG_DIR: instancePath})
    Claude->>User: Execute with work account
```

### Special Command Flow

```mermaid
sequenceDiagram
    participant User
    participant CCS as ccs.js

    User->>CCS: ccs --version
    CCS->>CCS: handleVersionCommand()
    CCS->>User: Show version and install location

    User->>CCS: ccs --help
    CCS->>CCS: handleHelpCommand()
    CCS->>Detector: detectClaudeCli()
    CCS->>User: Show Claude help

    User->>CCS: ccs --install
    CCS->>CCS: handleInstallCommand()
    CCS->>User: Installation message
```

## Configuration Architecture

### File Structure

```
~/.ccs/
├── config.json              # Settings-based profile mappings (glm, glmt, kimi)
├── profiles.json            # Account-based profile metadata (work, personal)
├── glm.settings.json        # GLM configuration (Anthropic endpoint)
├── glmt.settings.json       # GLMT configuration (v3.3.0 with thinking mode)
├── kimi.settings.json       # Kimi configuration
├── config.json.backup       # Single backup file
├── VERSION                  # Version information
├── logs/                    # Debug logs (CCS_DEBUG_LOG=1)
│   ├── {timestamp}-request-anthropic.json
│   ├── {timestamp}-request-openai.json
│   ├── {timestamp}-response-openai.json
│   └── {timestamp}-response-anthropic.json
├── shared/                  # Shared across all profiles (v3.1+)
│   ├── commands/            # Slash commands
│   ├── skills/              # Agent skills
│   └── agents/              # Agent configs
├── accounts/                # Encrypted credential vaults
│   ├── .salt                # Key derivation salt
│   ├── work.json.enc        # Work account credentials (encrypted)
│   └── personal.json.enc    # Personal account credentials (encrypted)
└── instances/               # Isolated Claude instances
    ├── work/                # Work account instance
    │   ├── session-env/
    │   ├── todos/
    │   ├── logs/
    │   ├── commands@ → shared/commands/
    │   ├── skills@ → shared/skills/
    │   ├── agents@ → shared/agents/
    │   ├── .credentials.json
    │   └── ...
    └── personal/            # Personal account instance
        ├── session-env/
        ├── todos/
        └── ...

bin/                         # CCS source files
├── ccs.js                   # Main entry point (v3.3.0)
├── glmt-proxy.js            # Embedded HTTP proxy (v3.2.0+)
├── glmt-transformer.js      # Format conversion (v3.2.0+, control mechanisms v3.6)
├── locale-enforcer.js       # Force English output (v3.6)
├── budget-calculator.js     # Thinking budget control (v3.6)
├── task-classifier.js       # Task classification (v3.6)
├── delta-accumulator.js     # Streaming state + loop detection (v3.6)
├── sse-parser.js            # SSE stream parser (v3.4+)
├── config-manager.js        # Configuration handling
├── claude-detector.js       # Claude CLI detection
├── instance-manager.js      # Instance orchestration
├── shared-manager.js        # Shared data symlinks (v3.1+)
├── profile-detector.js      # Profile type detection
├── profile-registry.js      # Account profile metadata
├── helpers.js               # Utility functions
├── error-manager.js         # Error handling
├── recovery-manager.js      # Auto-recovery
├── auth-commands.js         # Multi-account management
└── doctor.js                # Health check diagnostics

config/
└── base-glmt.settings.json  # GLMT template (v3.3.0)

scripts/
└── postinstall.js           # Auto-configuration + migration
```

### Configuration Schema

```json
{
  "profiles": {
    "default": "~/.claude/settings.json",
    "glm": "~/.ccs/glm.settings.json"
  }
}
```

### Settings File Format

**GLM Settings (Anthropic endpoint)**:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your_api_key",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

**GLMT Settings (v3.3.0 with thinking mode)**:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/coding/paas/v4/chat/completions",
    "ANTHROPIC_AUTH_TOKEN": "your_api_key",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6",
    "ANTHROPIC_TEMPERATURE": "0.2",
    "ANTHROPIC_MAX_TOKENS": "65536",
    "MAX_THINKING_TOKENS": "32768",
    "ENABLE_STREAMING": "true",
    "ANTHROPIC_SAFE_MODE": "false",
    "API_TIMEOUT_MS": "3000000"
  },
  "alwaysThinkingEnabled": true
}
```

**[i] Note**: All env values are strings (not booleans/numbers) for PowerShell compatibility.

## Security Architecture

### Inherent Security Model

1. **No Shell Injection Risk**: Uses `spawn()` with array arguments
2. **No Arbitrary Code Execution**: No `eval()` or dynamic code generation
3. **Controlled File Access**: Only accesses known configuration locations
4. **Minimal Dependencies**: Reduces attack surface

### Removed Security Measures

The simplification removed several "security theater" measures that provided no real security benefit:

- **Shell argument escaping**: Unnecessary with spawn() arrays
- **Path name validation**: Redundant with proper file system checks
- **Profile name sanitization**: Excessive validation for controlled input

### Maintained Security Controls

- **File existence validation**: Essential for preventing errors
- **JSON parsing safety**: Prevents malformed configuration crashes
- **Path traversal protection**: Maintained through path normalization
- **Executable validation**: Ensures found executables are actually executable

## Platform Architecture

### Cross-Platform Compatibility

```mermaid
graph TD
    subgraph "Platform Abstraction"
        NODE[Node.js Runtime]
        FS[File System API]
        PROCESS[Process Management]
    end

    subgraph "Platform-Specific"
        UNIX[Unix/macOS Logic]
        WIN[Windows Logic]
        COMMON[Common Logic]
    end

    NODE --> UNIX
    NODE --> WIN
    NODE --> COMMON
```

### Platform-Specific Behaviors

**Unix/macOS**:
- Uses `which` command for executable detection
- POSIX path handling and permissions
- Standard Unix terminal TTY detection

**Windows**:
- Uses `where.exe` for executable detection
- Windows path separator handling
- PowerShell compatibility considerations

**Common**:
- Node.js cross-platform APIs
- Unified error handling
- Consistent configuration format

## Performance Architecture

### Optimization Strategies

1. **Reduced Function Call Overhead**: Eliminated redundant validation layers
2. **Simplified Error Handling**: Direct error propagation without complex formatting
3. **Optimized Path Resolution**: Cached environment variable lookups
4. **Minimal Memory Footprint**: 35% reduction in code size

### Performance Characteristics

- **Startup Time**: Fast due to minimal module loading
- **Execution Time**: Direct process spawning without overhead
- **Memory Usage**: Small footprint with efficient data structures
- **I/O Operations**: Optimized configuration reading and caching

## Testing Architecture

### Test Organization

```
tests/
├── shared/
│   ├── unit/           # Unit tests for individual modules
│   └── fixtures/       # Test data and configurations
├── npm/               # npm package-specific tests
└── edge-cases.sh      # Comprehensive scenario testing
```

### Test Coverage Strategy

- **Unit Tests**: Individual module functionality
- **Integration Tests**: Cross-module interaction
- **Platform Tests**: OS-specific behavior validation
- **Edge Case Tests**: Error conditions and unusual scenarios

## Deployment Architecture

### npm Package Distribution

```mermaid
graph LR
    subgraph "Development"
        SRC[Source Code]
        TEST[Run Tests]
        BUILD[Package Files]
    end

    subgraph "Distribution"
        NPM[npm Registry]
        DOWNLOAD[Package Download]
        INSTALL[Installation Process]
    end

    subgraph "Runtime"
        POSTINSTALL[Post-install Script]
        CONFIG[Auto-configuration]
        READY[Ready to Use]
    end

    SRC --> TEST
    TEST --> BUILD
    BUILD --> NPM
    NPM --> DOWNLOAD
    DOWNLOAD --> INSTALL
    INSTALL --> POSTINSTALL
    POSTINSTALL --> CONFIG
    CONFIG --> READY
```

### Installation Process

1. **Package Download**: User installs via npm/yarn/pnpm/bun
2. **Post-install Script** (`scripts/postinstall.js`):
   - Creates `~/.ccs/` directory structure
   - Creates `~/.ccs/shared/` (commands, skills, agents)
   - Migrates from v3.1.1 → v3.2.0 (if needed)
   - Migrates GLMT configs from v3.2.0 → v3.3.0 (adds new fields)
   - Creates `config.json` (glm, glmt, kimi, default)
   - Creates `glm.settings.json` (Anthropic endpoint)
   - Creates `glmt.settings.json` (OpenAI endpoint + thinking mode)
   - Creates `kimi.settings.json` (Kimi endpoint)
   - Creates `~/.claude/settings.json` (if missing)
   - Validates configuration (checks JSON syntax, file existence)
   - Shows API key setup instructions
3. **Path Configuration**: npm automatically adds to PATH
4. **Ready State**: System ready for profile switching

**Idempotency**: Safe to run multiple times, preserves existing configs

**Migration Logic** (v3.3.0):
```javascript
// Auto-adds missing fields to existing GLMT configs
const envDefaults = {
  ANTHROPIC_TEMPERATURE: '0.2',
  ANTHROPIC_MAX_TOKENS: '65536',
  MAX_THINKING_TOKENS: '32768',
  ENABLE_STREAMING: 'true',
  ANTHROPIC_SAFE_MODE: 'false',
  API_TIMEOUT_MS: '3000000'
};
```

## Concurrent Sessions Architecture ()

### CLAUDE_CONFIG_DIR Mechanism

CCS uses the undocumented `CLAUDE_CONFIG_DIR` environment variable to isolate Claude CLI instances:

```javascript
// Settings-based profile (backward compatible)
execClaude(claudeCli, ['--settings', settingsPath, ...args]);

// Account-based profile (concurrent sessions)
const envVars = { CLAUDE_CONFIG_DIR: instancePath };
execClaude(claudeCli, args, envVars);
```

**How it works**:
1. Claude CLI reads `CLAUDE_CONFIG_DIR` env var
2. If set, uses that directory instead of `~/.claude/`
3. All state (sessions, todos, logs) stored in instance directory
4. Each profile gets isolated state → concurrent sessions possible

### Isolation Guarantees

**Isolated per instance**:
- Credentials (`.credentials.json`)
- Chat sessions (`session-env/`)
- Todo lists (`todos/`)
- Execution logs (`logs/`)
- File edit history (`file-history/`)
- Shell snapshots (`shell-snapshots/`)

**Shared across instances**:
- Claude CLI binary location
- CCS configuration (`~/.ccs/config.json`, `profiles.json`)
- Encrypted credential vaults (`~/.ccs/accounts/`)

### Concurrent Sessions Workflow

```mermaid
graph TD
    subgraph "Terminal 1"
        T1[ccs work "task1"]
        I1[Instance: ~/.ccs/instances/work/]
        C1[CLAUDE_CONFIG_DIR=work]
        CLI1[Claude CLI Process 1]
    end

    subgraph "Terminal 2"
        T2[ccs personal "task2"]
        I2[Instance: ~/.ccs/instances/personal/]
        C2[CLAUDE_CONFIG_DIR=personal]
        CLI2[Claude CLI Process 2]
    end

    T1 --> I1 --> C1 --> CLI1
    T2 --> I2 --> C2 --> CLI2
```

### Known Limitations ()

1. **Same Profile Concurrent Access**: Running `ccs work` in 2 terminals → file conflicts
   - Not blocked in 
   - File locking considered for future versions

2. **CLAUDE_CONFIG_DIR Reliability**: Undocumented env var
   - May not work on all systems
   - Claude CLI version dependencies unknown
   - No official support from Anthropic

3. **Disk Space**: Each instance ~200-700 KB
   - Sessions accumulate over time
   - No automatic cleanup in 

## Future Extensibility

### Extension Points

The architecture provides clean extension points:

1. **New Profile Types**: Easy addition via ProfileDetector
2. **Additional Commands**: Straightforward command handler extension
3. **Enhanced Isolation**: File locking for same-profile concurrent access
4. **Instance Cleanup**: Automatic session/log cleanup policies
5. **Plugin System**: Clean architecture supports future plugins

### Architectural Guarantees

- **Backward Compatibility**: Settings-based profiles (glm, kimi) work unchanged
- **Performance**: Lazy instance initialization minimizes overhead
- **Maintainability**: Clear separation between settings-based and account-based paths
- **Reliability**: Encrypted vaults + isolated instances reduce failure coupling

## Summary

The CCS system architecture successfully balances simplicity with functionality:

- **Unified spawn logic** eliminates code duplication
- **Dual-path execution** supports both settings-based (backward compatible) and account-based (concurrent sessions) profiles
- **Lazy instance initialization** follows YAGNI principle (only create when needed)
- **Encrypted credential vaults** with AES-256-GCM provide secure multi-account storage
- **Isolated Claude instances** enable concurrent sessions via CLAUDE_CONFIG_DIR
- **Cross-platform compatibility** ensures consistent behavior everywhere
- **Performance optimization** achieves 35% code reduction with identical functionality
- **Clean separation of concerns** makes the codebase maintainable and extensible

**v3.3.0 Features**:
- **GLMT thinking mode**: Embedded proxy for GLM reasoning support
- **Debug logging**: File-based logging to `~/.ccs/logs/` when `CCS_DEBUG_LOG=1`
- **Verbose mode**: Console logging with `--verbose` flag
- **Configuration migration**: Auto-upgrade v3.2.0 configs with new fields
- **Enhanced settings**: Temperature, max tokens, thinking controls, API timeout
- **Transformation validation**: Self-test request/response conversions

**v3.2.0 Enhancements**:
- Concurrent sessions for account-based profiles
- Profile type detection and routing (settings vs account)
- Instance isolation with credential synchronization
- Backward compatibility maintained for all existing profiles

**v3.3.0 Architecture Highlights**:
1. **Proxy Architecture**: Buffered mode with 120s timeout, random port binding
2. **Debug Infrastructure**: Dual logging (console + file) with timestamp tracking
3. **Config Management**: Automatic migration, string-only env vars, PowerShell compatibility
4. **Thinking Mode**: Control tags, reasoning parameters, signature generation
5. **Error Recovery**: Timeout handling, fallback options, clear error messages

The architecture demonstrates how thoughtful design can add sophisticated features (thinking mode, debug infrastructure, multi-account management) while maintaining simplicity, security, and backward compatibility.