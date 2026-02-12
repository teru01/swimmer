#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

VERSION="$1"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in semver format (e.g. 1.2.3)"
  exit 1
fi

PACKAGE_JSON="package.json"
CARGO_TOML="src-tauri/Cargo.toml"
TAURI_CONF="src-tauri/tauri.conf.json"

for f in "$PACKAGE_JSON" "$CARGO_TOML" "$TAURI_CONF"; do
  if [ ! -f "$f" ]; then
    echo "Error: $f not found"
    exit 1
  fi
done

# package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"

# src-tauri/Cargo.toml
sed -i '' 's/^version = ".*"/version = "'"$VERSION"'"/' "$CARGO_TOML"

# src-tauri/tauri.conf.json
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('$TAURI_CONF', 'utf8'));
conf.version = '$VERSION';
fs.writeFileSync('$TAURI_CONF', JSON.stringify(conf, null, 2) + '\n');
"

echo "Updated to v$VERSION:"
echo "  - $PACKAGE_JSON"
echo "  - $CARGO_TOML"
echo "  - $TAURI_CONF"
