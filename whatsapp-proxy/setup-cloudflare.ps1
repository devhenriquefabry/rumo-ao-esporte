param(
    [switch]$SkipKv,
    [switch]$SkipSecrets,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

if (-not $env:CLOUDFLARE_API_TOKEN) {
    throw "Defina CLOUDFLARE_API_TOKEN antes de rodar este script. Ex.: `$env:CLOUDFLARE_API_TOKEN='seu-token'"
}

Push-Location $PSScriptRoot
try {
    Write-Host "Validando Wrangler..." -ForegroundColor Cyan
    npx wrangler --version
    npx wrangler whoami

    if (-not $SkipKv) {
        Write-Host "Criando/atualizando namespace KV RAE_STORAGE no wrangler.toml..." -ForegroundColor Cyan
        npx wrangler kv namespace create RAE_STORAGE --binding RAE_STORAGE --update-config
    }

    if (-not $SkipSecrets) {
        if (Test-Path ".\secrets.json") {
            Write-Host "Aplicando secrets do Worker..." -ForegroundColor Cyan
            npx wrangler secret bulk .\secrets.json
        } else {
            Write-Warning "Arquivo secrets.json nao encontrado. Copie secrets.example.json para secrets.json e preencha EVOLUTION_API_KEY, ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN."
        }
    }

    Write-Host "Validando build do Worker..." -ForegroundColor Cyan
    npx wrangler deploy --dry-run

    if (-not $SkipDeploy) {
        Write-Host "Publicando Worker..." -ForegroundColor Cyan
        npx wrangler deploy
    }
} finally {
    Pop-Location
}
