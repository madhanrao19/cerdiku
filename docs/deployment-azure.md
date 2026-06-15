# Deployment — Azure (production)

Managed footprint: App Service (web + api), Azure Database for PostgreSQL
Flexible Server (pgvector), Azure Cache for Redis, Blob Storage, Key Vault, and
Log Analytics + Application Insights. Template:
[infra/azure/main.bicep](../infra/azure/main.bicep).

> **Region:** the template defaults to `malaysiawest` for data residency.
> Verify per-service availability (notably Azure OpenAI) before committing — it
> may require a different region while data stays in Malaysia West.

## Provision

```bash
az group create -n kpm-prod -l malaysiawest
az deployment group create -g kpm-prod -f infra/azure/main.bicep \
  -p namePrefix=kpm pgAdminPassword='<strong-secret>'
```

Outputs: api/web hostnames and the Postgres FQDN.

## Post-provision

1. **Enable extensions** in the database (the Bicep allow-lists them):
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
2. Run migrations: `prisma migrate deploy` then apply `prisma/sql/embedding.sql`.
3. Put secrets in Key Vault; reference them from App Service settings.
4. Deploy app artifacts (zip-deploy or container images via the same Dockerfile).
5. Add Azure Front Door / WAF if you expect broad public traffic.

## Observability

`OTEL_EXPORTER_OTLP_ENDPOINT` and the App Insights connection string are wired
in the Bicep app settings. The API/worker ship OpenTelemetry-friendly logs;
dashboards live in Azure Monitor.

## Scaling path

Start on App Service (P1v3). Move workers + specialized services (e.g. Qdrant)
to AKS only once you outgrow one or two stateless services plus the worker.
