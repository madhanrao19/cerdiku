# Deployment — Hostinger VPS

Best for prototype / private beta / early MVP: the full stack on one
operator-controlled KVM VPS. For production with child data, payments, and
residency concerns, prefer [Azure](deployment-azure.md).

## Topology

Caddy (TLS) → web (Next.js) + api (NestJS) → postgres (pgvector) + redis, with a
worker container. See [infra/hostinger/docker-compose.prod.yml](../infra/hostinger/docker-compose.prod.yml)
and [infra/hostinger/Caddyfile](../infra/hostinger/Caddyfile).

## One-time VPS setup

1. Provision a KVM VPS (≥ 2 vCPU / 4 GB), Ubuntu, with Docker + Compose.
2. Point your domain's A record at the VPS IP.
3. Create `/opt/kpm/.env.prod` from `.env.example` with production secrets
   (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, JWT
   secrets, AI keys, payment keys).
4. Copy `docker-compose.prod.yml` and `Caddyfile` into `/opt/kpm`.
5. Configure the VPS firewall to allow 80/443 only; keep 5432/6379 internal.

## Build & push images

```bash
docker build -f infra/docker/Dockerfile --target api    -t $REGISTRY/kpm-api:$TAG .
docker build -f infra/docker/Dockerfile --target web    -t $REGISTRY/kpm-web:$TAG .
docker build -f infra/docker/Dockerfile --target worker -t $REGISTRY/kpm-worker:$TAG .
docker push $REGISTRY/kpm-api:$TAG && docker push $REGISTRY/kpm-web:$TAG && docker push $REGISTRY/kpm-worker:$TAG
```

## Deploy

```bash
DOMAIN=app.example.my REGISTRY=ghcr.io/you TAG=v1.0.0 \
  bash infra/hostinger/deploy.sh
```

The script pulls images, runs `db:migrate` + `db:vector`, then `up -d`.

## Operational notes

- Backups: schedule `pg_dump` to off-box storage; Hostinger weekly snapshots are
  a coarse safety net, not a substitute.
- Object storage: use an external S3-compatible bucket rather than self-hosting
  for durability.
- This is a single point of failure — acceptable for pilot, not for scale.
