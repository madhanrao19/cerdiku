// Azure production footprint for the KPM platform.
// Deploy: az deployment group create -g <rg> -f main.bicep -p namePrefix=kpm \
//   pgAdminPassword=<secret> location=malaysiawest
//
// NOTE: verify model/service availability in malaysiawest before committing —
// some services (e.g. Azure OpenAI) may require a different region.

@description('Short prefix for resource names')
param namePrefix string = 'kpm'

@description('Location. Malaysia West for data residency where available.')
param location string = 'malaysiawest'

@description('PostgreSQL admin login')
param pgAdminUser string = 'kpmadmin'

@secure()
@description('PostgreSQL admin password')
param pgAdminPassword string

var suffix = uniqueString(resourceGroup().id)

// --- Log Analytics + App Insights (observability) --------------------------
resource logws 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs-${suffix}'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi-${suffix}'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logws.id }
}

// --- PostgreSQL Flexible Server (enable pgvector via server parameters) -----
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: '${namePrefix}-pg-${suffix}'
  location: location
  sku: { name: 'Standard_D2ds_v5', tier: 'GeneralPurpose' }
  properties: {
    version: '16'
    administratorLogin: pgAdminUser
    administratorLoginPassword: pgAdminPassword
    storage: { storageSizeGB: 64 }
    highAvailability: { mode: 'ZoneRedundant' }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
  }
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: pg
  name: 'kpm'
}

// Allow the vector + pgcrypto extensions (must also CREATE EXTENSION in db).
resource pgExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: pg
  name: 'azure.extensions'
  properties: { value: 'VECTOR,PGCRYPTO', source: 'user-override' }
}

// --- Redis -----------------------------------------------------------------
resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: '${namePrefix}-redis-${suffix}'
  location: location
  properties: { sku: { name: 'Standard', family: 'C', capacity: 1 }, enableNonSslPort: false }
}

// --- Storage (Blob for media/exports) --------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower('${namePrefix}st${suffix}')
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { allowBlobPublicAccess: false, minimumTlsVersion: 'TLS1_2' }
}

// --- Key Vault -------------------------------------------------------------
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv-${suffix}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
  }
}

// --- App Service plan + web + api ------------------------------------------
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan-${suffix}'
  location: location
  sku: { name: 'P1v3', tier: 'PremiumV3' }
  properties: { reserved: true } // Linux
}

resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-api-${suffix}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appi.properties.ConnectionString }
        { name: 'REDIS_URL', value: 'rediss://${redis.properties.hostName}:6380' }
        { name: 'NODE_ENV', value: 'production' }
      ]
    }
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-web-${suffix}'
  location: location
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        { name: 'API_BASE_URL', value: 'https://${apiApp.properties.defaultHostName}' }
      ]
    }
  }
}

output apiHostname string = apiApp.properties.defaultHostName
output webHostname string = webApp.properties.defaultHostName
output postgresFqdn string = pg.properties.fullyQualifiedDomainName
