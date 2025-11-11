#!/bin/bash
# Auto-install CCS locally for testing changes

set -e

echo "[CCS Dev Install] Starting..."

# Get to the right directory
cd "$(dirname "$0")/.."

# Pack the npm package
echo "[CCS Dev Install] Creating package..."
npm pack

# Find the tarball
TARBALL=$(ls -t kaitranntt-ccs-*.tgz | head -1)

if [ -z "$TARBALL" ]; then
    echo "[CCS Dev Install] ERROR: No tarball found"
    exit 1
fi

echo "[CCS Dev Install] Found tarball: $TARBALL"

# Install globally
echo "[CCS Dev Install] Installing globally..."
npm install -g "$TARBALL"

# Clean up
echo "[CCS Dev Install] Cleaning up..."
rm "$TARBALL"

echo "[CCS Dev Install] ✓ Complete! CCS is now updated."
echo ""
echo "Test with: ccs glmt --version"
