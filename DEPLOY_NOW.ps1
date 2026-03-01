#!/usr/bin/env pwsh
# SealSend Deployment Script for VPS
# Run this on your VPS (187.77.26.99) via SSH

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SealSend Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as root
if ($env:USER -ne "root" -and (whoami) -ne "root") {
    Write-Warning "This script should be run as root for Docker commands"
}

# Navigate to Coolify service directory
$serviceDir = "/data/coolify/services/x8okwogw0so8s08oss04s088"
if (-not (Test-Path $serviceDir)) {
    Write-Error "Service directory not found: $serviceDir"
    exit 1
}

Set-Location $serviceDir

Write-Host "Step 1: Pulling latest code..." -ForegroundColor Yellow
& git pull origin master
if ($LASTEXITCODE -ne 0) {
    Write-Error "Git pull failed"
    exit 1
}

Write-Host ""
Write-Host "Step 2: Stopping existing containers..." -ForegroundColor Yellow
& docker-compose down

Write-Host ""
Write-Host "Step 3: Building new Docker image..." -ForegroundColor Yellow
& docker-compose build --no-cache web
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed"
    exit 1
}

Write-Host ""
Write-Host "Step 4: Starting containers..." -ForegroundColor Yellow
& docker-compose up -d

Write-Host ""
Write-Host "Step 5: Waiting for container to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check container status
$containerStatus = & docker ps --filter "name=x8okwogw0so8s08oss04s088" --format "{{.Status}}"
Write-Host "Container status: $containerStatus" -ForegroundColor Green

Write-Host ""
Write-Host "Step 6: Applying database migration..." -ForegroundColor Yellow

# Run migration using the web container
$migrationSQL = @"
-- Add guest login tracking for seamless invite acceptance
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add 'accepted' to invite_status check constraint if not already present
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;
ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check 
  CHECK (invite_status IN ('not_sent', 'sent', 'failed', 'accepted'));
"@

# Write migration to temp file and execute
$migrationSQL | Out-File -FilePath "/tmp/migration.sql" -Encoding UTF8
& docker cp "/tmp/migration.sql" "x8okwogw0so8s08oss04s088-web:/tmp/migration.sql"

# Execute migration using psql through the container
Write-Host "Running database migration..." -ForegroundColor Yellow
$envVars = & docker exec x8okwogw0so8s08oss04s088-web printenv | Select-String "SUPABASE"
Write-Host "Found Supabase environment variables"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "New Features Deployed:" -ForegroundColor Cyan
Write-Host "  ✓ Unified dashboard for all users" -ForegroundColor White
Write-Host "  ✓ Seamless invite acceptance with auto-login" -ForegroundColor White
Write-Host "  ✓ Magic invite links (no password needed)" -ForegroundColor White
Write-Host ""
Write-Host "Check logs with: docker-compose logs -f web" -ForegroundColor Gray
Write-Host ""
