#!/usr/bin/env bash
# Builds dist/cool-pills-chrome-<v>.zip and dist/cool-pills-firefox-<v>.zip
# extension/manifest.json is the Chrome manifest (service_worker only).
# Firefox needs background.scripts + gecko settings, so its manifest is generated here.
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
rm -rf dist && mkdir -p dist/chrome dist/firefox
cp -r extension/. dist/chrome/
cp -r extension/. dist/firefox/
python3 - <<'PY'
import json
p='dist/firefox/manifest.json'
m=json.load(open(p))
m['background']={'scripts':['background.js']}
m['browser_specific_settings']={'gecko':{'id':'cool-pills@asoapyoid.local','strict_min_version':'128.0'}}
json.dump(m,open(p,'w'),indent=2)
PY
( cd dist/chrome  && zip -qr "../cool-pills-chrome-$V.zip"  . -x '*.DS_Store' )
( cd dist/firefox && zip -qr "../cool-pills-firefox-$V.zip" . -x '*.DS_Store' )
ls -la dist/*.zip
