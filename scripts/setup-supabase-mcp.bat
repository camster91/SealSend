@echo off
:: Setup Script for Supabase MCP with Titan Email
:: Run this after setting your Titan app password

echo ============================================
echo Seal & Send - Supabase MCP Setup
echo ============================================
echo.

:: Check for Supabase CLI
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Supabase CLI not found.
    echo Install it: npm install -g supabase
    exit /b 1
)

:: Check for .env.local
if not exist .env.local (
    echo ERROR: .env.local not found!
    echo Please copy .env.example to .env.local and fill in your Titan password.
    exit /b 1
)

echo Step 1: Logging into Supabase...
supabase login
if errorlevel 1 (
    echo ERROR: Supabase login failed
    exit /b 1
)

echo.
echo Step 2: Setting Edge Function secrets...
echo.

:: Read values from .env.local
for /f "tokens=1,2 delims==" %%a in (.env.local) do (
    if "%%a"=="TITAN_SMTP_PASSWORD" (
        echo Setting TITAN_SMTP_PASSWORD...
        supabase secrets set TITAN_SMTP_PASSWORD=%%b --project-ref vtbreowxqfcvwegpfnwn
    )
)

:: Set other secrets
echo Setting other secrets...
supabase secrets set TITAN_SMTP_HOST=smtp.titan.email --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set TITAN_SMTP_PORT=465 --project-ref vtbreowxqfcvwegpfnwn  
supabase secrets set TITAN_SMTP_USER=contact@sealsend.app --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set TITAN_DEFAULT_FROM="Seal & Send <contact@sealsend.app>" --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set SUPABASE_URL=https://vtbreowxqfcvwegpfnwn.supabase.co --project-ref vtbreowxqfcvwegpfnwn

echo.
echo Step 3: Deploying Edge Functions...
supabase functions deploy titan-sender --project-ref vtbreowxqfcvwegpfnwn
supabase functions deploy email-webhook --project-ref vtbreowxqfcvwegpfnwn

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Run the SQL migration in Supabase dashboard
echo 2. Configure Auth URL settings
echo 3. Test sending an email
echo.
echo See SUPABASE_MCP_SETUP.md for details.
echo.
pause