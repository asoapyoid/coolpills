#!/usr/bin/env bash
# Usage: scripts/set-username.sh your-github-name [repo-name]
set -euo pipefail
cd "$(dirname "$0")/.."
U="${1:?github username}"; REPO="${2:-cool-pills}"
grep -rl 'OWNER/REPO' README.md docs | xargs sed -i.bak "s#OWNER/REPO#$U/$REPO#g; s#OWNER\.github\.io/REPO#$U.github.io/$REPO#g"
find . -name '*.bak' -delete
echo "Links updated for $U/$REPO"
