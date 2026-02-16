# Supabase MCP Setup Script (PowerShell)
# Run this to configure Supabase with your Titan Email credentials

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Seal & Send - Supabase MCP Setup" -ForegroundColor Cyan
Write-Host "============================================"
Write-Host ""

# Check for Supabase CLI
if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Error "Supabase CLI not found. Please install it: npm install -g supabase"
    exit 1
}

# Check for .env.local
if (-not (Test-Path ".env.local")) {
    Write-Error ".env.local not found! Please ensure it exists with your configuration."
    exit 1
}

# Read .env.local
$envVars = @{}
Get-Content ".env.local" | ForEach-Object {
    if ($_ -match "^\s*([^#=]+)=(.+)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove quotes if present
        if ($value -match "^['`"](.*)['`"]$") {
            $value = $matches[1]
        }
        $envVars[$key] = $value
    }
}

$projectRef = "vtbreowxqfcvwegpfnwn"

Write-Host "Step 1: Logging into Supabase..." -ForegroundColor Yellow
supabase login
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`nStep 2: Setting Edge Function secrets..." -ForegroundColor Yellow

# Set Titan secrets
$titanSecrets = @(
    "TITAN_SMTP_HOST",
    "TITAN_SMTP_PORT",
    "TITAN_SMTP_USER",
    "TITAN_SMTP_PASSWORD",
    "TITAN_DEFAULT_FROM",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY"
)

foreach ($key in $titanSecrets) {
    if ($envVars.ContainsKey($key)) {
        $val = $envVars[$key]
        Write-Host "Setting $key..."
        # Escape for shell if needed, though PowerShell handles strings well
        supabase secrets set "$key=$val" --project-ref $projectRef
    } else {
        Write-Warning "Variable $key not found in .env.local"
    }
}

Write-Host "`nStep 3: Deploying Edge Functions..." -ForegroundColor Yellow
supabase functions deploy titan-sender --project-ref $projectRef
supabase functions deploy email-webhook --project-ref $projectRef

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================"
Write-Host "`nNext steps:"
Write-Host "1. Run the SQL migration in Supabase dashboard (supabase/migrations/001_titan_email_setup.sql)"
Write-Host "2. Configure Auth URL settings in Supabase Dashboard"
Write-Host "3. Test sending an email via API or SQL"
