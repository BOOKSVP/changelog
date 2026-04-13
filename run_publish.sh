#!/usr/bin/env bash
set -euo pipefail
cd /tmp/artsvp-changelog
node build.js
git add -A
git commit -m "Changelog: 2026-04-13"
git push
