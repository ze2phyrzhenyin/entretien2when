#!/usr/bin/env bash
set -euo pipefail

pnpm exec prisma migrate reset --force
