#!/usr/bin/env bash
# Deploy dist/ to the gh-pages branch of the offerpilot-ai repo.
# Usage:  bash deploy.sh
# Requires: gh authenticated, node installed.
set -euo pipefail

REPO="KidusB9/offerpilot-ai"
BRANCH="gh-pages"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> building"
cd "$DIR"
node build.mjs

echo "==> publishing dist/ to $BRANCH"
cd "$DIR/dist"
rm -rf .git
git init -q
git checkout -q -b "$BRANCH"
git add -A
git -c user.name="KidusB9" -c user.email="kidus.habte.berhanu@gmail.com" commit -qm "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -q --force "https://github.com/$REPO.git" "$BRANCH"
rm -rf .git

echo "==> live at https://kidusb9.github.io/offerpilot-ai/"
