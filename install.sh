#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# CCS Installation Script
# ============================================================================

# --- Configuration ---
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
CCS_DIR="$HOME/.ccs"
CLAUDE_DIR="$HOME/.claude"
GLM_MODEL="glm-4.6"

# Resolve script directory (handles both file-based and piped execution)
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  SCRIPT_DIR="$(cd "$(dirname "${0:-$PWD}")" && pwd)"
fi

# Detect installation method (git vs standalone)
# Check if ccs executable exists in SCRIPT_DIR (real git install)
# Don't just check .git (user might run curl | bash inside their own git repo)
if [[ -f "$SCRIPT_DIR/ccs" ]]; then
  INSTALL_METHOD="git"
else
  INSTALL_METHOD="standalone"
fi

# --- Platform Detection ---
# Detect platform and redirect to Windows installer if needed
detect_platform() {
  case "$OSTYPE" in
    msys*|mingw*|cygwin*|win32*)
      echo "windows"
      ;;
    *)
      echo "unix"
      ;;
  esac
}

PLATFORM=$(detect_platform)

if [[ "$PLATFORM" == "windows" ]]; then
  echo "Windows detected. Using PowerShell installer..."

  if [[ -f "$SCRIPT_DIR/install.ps1" ]]; then
    powershell.exe -ExecutionPolicy Bypass -File "$SCRIPT_DIR/install.ps1"
    exit $?
  else
    echo "Error: install.ps1 not found."
    echo "Please download the full CCS package from:"
    echo "  https://github.com/kaitranntt/ccs"
    exit 1
  fi
fi

# Continue with Unix installation...

# --- Helper Functions ---

detect_current_provider() {
  local settings="$CLAUDE_DIR/settings.json"
  if [[ ! -f "$settings" ]]; then
    echo "unknown"
    return
  fi

  if grep -q "api.z.ai\|glm-4" "$settings" 2>/dev/null; then
    echo "glm"
  elif grep -q "ANTHROPIC_BASE_URL" "$settings" 2>/dev/null && ! grep -q "api.z.ai" "$settings" 2>/dev/null; then
    echo "custom"
  else
    echo "claude"
  fi
}

create_glm_template() {
  cat << EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
    "ANTHROPIC_MODEL": "$GLM_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "$GLM_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "$GLM_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$GLM_MODEL"
  }
}
EOF
}

create_sonnet_template() {
  cat << 'EOF'
{
  "env": {}
}
EOF
}

atomic_mv() {
  local src="$1"
  local dest="$2"
  if mv "$src" "$dest" 2>/dev/null; then
    return 0
  else
    rm -f "$src"
    echo "  ❌ Error: Failed to create $dest (check permissions)"
    exit 1
  fi
}

create_glm_profile() {
  local current_settings="$CLAUDE_DIR/settings.json"
  local glm_settings="$CCS_DIR/glm.settings.json"
  local provider="$1"

  if [[ "$provider" == "glm" ]]; then
    echo "✓ Copying current GLM config to profile..."
    if command -v jq &> /dev/null; then
      if jq '.env |= (. // {}) + {
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "'"$GLM_MODEL"'"
      }' "$current_settings" > "$glm_settings.tmp" 2>/dev/null; then
        atomic_mv "$glm_settings.tmp" "$glm_settings"
        echo "  Created: $glm_settings (with your existing API key + enhanced settings)"
      else
        rm -f "$glm_settings.tmp"
        cp "$current_settings" "$glm_settings"
        echo "  Created: $glm_settings (copied as-is, jq enhancement failed)"
      fi
    else
      cp "$current_settings" "$glm_settings"
      echo "  Created: $glm_settings (copied as-is, jq not available)"
    fi
  else
    echo "Creating GLM profile template at $glm_settings"
    if [[ -f "$current_settings" ]] && command -v jq &> /dev/null; then
      if jq '.env |= (. // {}) + {
        "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
        "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
        "ANTHROPIC_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "'"$GLM_MODEL"'"
      }' "$current_settings" > "$glm_settings.tmp" 2>/dev/null; then
        atomic_mv "$glm_settings.tmp" "$glm_settings"
      else
        rm -f "$glm_settings.tmp"
        echo "  ℹ️  jq failed, using basic template"
        create_glm_template > "$glm_settings"
      fi
    else
      create_glm_template > "$glm_settings"
    fi
    echo "  Created: $glm_settings"
    echo "  ⚠️  Edit this file and replace YOUR_GLM_API_KEY_HERE with your actual GLM API key"
  fi
}

create_sonnet_profile() {
  local current_settings="$CLAUDE_DIR/settings.json"
  local sonnet_settings="$CCS_DIR/sonnet.settings.json"
  local provider="$1"

  if [[ "$provider" == "claude" ]]; then
    echo "✓ Copying current Claude config to profile..."
    cp "$current_settings" "$sonnet_settings"
    echo "  Created: $sonnet_settings"
  else
    echo "Creating Claude Sonnet profile template at $sonnet_settings"
    if [[ -f "$current_settings" ]] && command -v jq &> /dev/null; then
      # Remove GLM-specific vars, but keep ANTHROPIC_DEFAULT_* if they contain "claude" (user preference)
      # Filter logic assumes Claude model IDs contain "claude" substring (case-insensitive)
      if jq 'del(.env.ANTHROPIC_BASE_URL, .env.ANTHROPIC_AUTH_TOKEN, .env.ANTHROPIC_MODEL) |
          .env |= with_entries(
            select(
              (.key | IN("ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL") | not) or
              (.value | tostring? // "" | ascii_downcase | contains("claude"))
            )
          ) |
          if (.env | length) == 0 then .env = {} else . end' "$current_settings" > "$sonnet_settings.tmp" 2>/dev/null; then
        atomic_mv "$sonnet_settings.tmp" "$sonnet_settings"
      else
        rm -f "$sonnet_settings.tmp"
        echo "  ℹ️  jq failed, using basic template"
        create_sonnet_template > "$sonnet_settings"
      fi
    else
      create_sonnet_template > "$sonnet_settings"
    fi
    echo "  Created: $sonnet_settings"
    echo "  ℹ️  This uses your Claude subscription (no API key needed)"
  fi
}

# --- Main Installation ---

echo "┌─ Installing CCS"

# Create directories
mkdir -p "$INSTALL_DIR" "$CCS_DIR"

# Install main executable
if [[ "$INSTALL_METHOD" == "standalone" ]]; then
  # Standalone install - download ccs from GitHub
  if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is required for standalone installation"
    exit 1
  fi

  if curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o "$CCS_DIR/ccs"; then
    chmod +x "$CCS_DIR/ccs"
    ln -sf "$CCS_DIR/ccs" "$INSTALL_DIR/ccs"
    echo "│  ✓ Downloaded executable"
  else
    echo "│"
    echo "✗ Error: Failed to download ccs from GitHub"
    exit 1
  fi
else
  # Git install - use local ccs file
  chmod +x "$SCRIPT_DIR/ccs"
  ln -sf "$SCRIPT_DIR/ccs" "$INSTALL_DIR/ccs"
  echo "│  ✓ Installed executable"
fi

if [[ ! -L "$INSTALL_DIR/ccs" ]]; then
  echo "│"
  echo "✗ Error: Failed to create symlink at $INSTALL_DIR/ccs"
  echo "  Check directory permissions and try again."
  exit 1
fi

# Install uninstall script (with idempotency check)
if [[ -f "$SCRIPT_DIR/uninstall.sh" ]]; then
  # Only copy if source and destination are different
  if [[ "$SCRIPT_DIR/uninstall.sh" != "$CCS_DIR/uninstall.sh" ]]; then
    cp "$SCRIPT_DIR/uninstall.sh" "$CCS_DIR/uninstall.sh"
  fi
  chmod +x "$CCS_DIR/uninstall.sh"
  ln -sf "$CCS_DIR/uninstall.sh" "$INSTALL_DIR/ccs-uninstall"
  echo "│  ✓ Installed uninstaller"
elif [[ "$INSTALL_METHOD" == "standalone" ]] && command -v curl &> /dev/null; then
  if curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.sh -o "$CCS_DIR/uninstall.sh"; then
    chmod +x "$CCS_DIR/uninstall.sh"
    ln -sf "$CCS_DIR/uninstall.sh" "$INSTALL_DIR/ccs-uninstall"
    echo "│  ✓ Installed uninstaller"
  fi
fi

echo "│  ✓ Created directories"
echo "└─"
echo ""

# --- Profile Setup ---

CURRENT_PROVIDER=$(detect_current_provider)
GLM_SETTINGS="$CCS_DIR/glm.settings.json"
SONNET_SETTINGS="$CCS_DIR/sonnet.settings.json"

# Build provider label
PROVIDER_LABEL=""
[[ "$CURRENT_PROVIDER" == "glm" ]] && PROVIDER_LABEL=" (detected: GLM)"
[[ "$CURRENT_PROVIDER" == "claude" ]] && PROVIDER_LABEL=" (detected: Claude)"
[[ "$CURRENT_PROVIDER" == "custom" ]] && PROVIDER_LABEL=" (detected: custom)"

echo "┌─ Configuring Profiles${PROVIDER_LABEL}"

# Track if GLM needs API key
NEEDS_GLM_KEY=false

# Create missing profiles (silently, show only result)
if [[ ! -f "$GLM_SETTINGS" ]]; then
  create_glm_profile "$CURRENT_PROVIDER" >/dev/null 2>&1
  echo "│  ✓ GLM profile → ~/.ccs/glm.settings.json"
  [[ "$CURRENT_PROVIDER" != "glm" ]] && NEEDS_GLM_KEY=true
fi

if [[ ! -f "$SONNET_SETTINGS" ]]; then
  create_sonnet_profile "$CURRENT_PROVIDER" >/dev/null 2>&1
  echo "│  ✓ Sonnet profile → ~/.ccs/sonnet.settings.json"
fi

# Create ccs config
if [[ ! -f "$CCS_DIR/config.json" ]]; then
  cat > "$CCS_DIR/config.json.tmp" << 'EOF'
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "son": "~/.ccs/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
  atomic_mv "$CCS_DIR/config.json.tmp" "$CCS_DIR/config.json"
  echo "│  ✓ Config → ~/.ccs/config.json"
fi

echo "└─"
echo ""

# Check PATH warning
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "⚠  PATH Configuration Required"
  echo ""
  echo "   Add to your shell profile (~/.bashrc or ~/.zshrc):"
  echo "     export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

# Show API key warning if needed
if [[ "$NEEDS_GLM_KEY" == "true" ]]; then
  echo "⚠  ACTION REQUIRED"
  echo ""
  echo "   Edit ~/.ccs/glm.settings.json and add your GLM API key"
  echo "   Replace: YOUR_GLM_API_KEY_HERE"
  echo ""
fi

echo "✅ CCS installed successfully!"
echo ""

# Build quick start based on current provider
if [[ "$CURRENT_PROVIDER" == "claude" ]]; then
  echo "   Quick start:"
  echo "     ccs son       # Claude Sonnet (current)"
  echo "     ccs glm       # GLM (after adding API key)"
  echo "     ccs           # Default profile"
elif [[ "$CURRENT_PROVIDER" == "glm" ]]; then
  echo "   Quick start:"
  echo "     ccs glm       # GLM (current)"
  echo "     ccs son       # Claude Sonnet"
  echo "     ccs           # Default profile"
else
  echo "   Quick start:"
  echo "     ccs           # Default profile"
  echo "     ccs son       # Claude Sonnet"
  echo "     ccs glm       # GLM (after adding API key)"
fi

echo ""
echo "   To uninstall: ccs-uninstall"
echo ""
