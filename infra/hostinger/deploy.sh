#!/usr/bin/env bash
# Deploy/refresh the KPM stack on a Hostinger KVM VPS over SSH.
# Usage: DOMAIN=app.example.my REGISTRY=ghcr.io/you TAG=v1.2.3 ./deploy.sh
set -euo pipefail

: "${DOMAIN:?set DOMAIN}"
: "${REGISTRY:?set REGISTRY}"
TAG="${TAG:-latest}"
APP_DIR="/opt/kpm"

echo "==> Ensuring app dir on VPS"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "==> Pulling images ($REGISTRY @ $TAG)"
export DOMAIN REGISTRY TAG
docker compose -f docker-compose.prod.yml pull

echo "==> Applying database migrations"
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @kpm/api db:migrate
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @kpm/api db:vector

echo "==> Starting stack"
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "==> Pruning old images"
docker image prune -f

echo "==> Done. Health: https://$DOMAIN/health"
