@echo off
echo ========================================
echo ECardApp Deployment Script
echo ========================================
echo.
echo This script will rebuild and restart the Docker container
echo with the dashboard fix applied.
echo.

REM Check if docker-compose.yml exists
if not exist docker-compose.yml (
    echo ERROR: docker-compose.yml not found!
    echo Please run this script from the ECardApp directory.
    pause
    exit /b 1
)

echo 1. Stopping existing containers...
docker-compose down

echo.
echo 2. Building new Docker image...
docker-compose build --no-cache web

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker build failed!
    pause
    exit /b 1
)

echo.
echo 3. Starting containers...
docker-compose up -d

echo.
echo 4. Checking container status...
docker-compose ps

echo.
echo 5. Viewing logs (Ctrl+C to exit)...
docker-compose logs -f web

echo.
echo Deployment complete!
echo.
echo IMPORTANT: Clear browser cookies for ecard.ashbi.ca before testing.
echo.
pause