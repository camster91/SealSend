#!/bin/bash
# Coolify Deployment Script for SealSend
# Run this on your VPS (187.77.26.99)

set -e

echo "========================================"
echo "SealSend Coolify Deployment"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVICE_DIR="/data/coolify/services/x8okwogw0so8s08oss04s088"

echo -e "${YELLOW}Step 1: Navigating to service...${NC}"
cd "$SERVICE_DIR"
pwd
echo ""

echo -e "${YELLOW}Step 2: Checking current git status...${NC}"
echo "Current commit:"
git log --oneline -1
echo ""

echo -e "${YELLOW}Step 3: Fetching and resetting to latest...${NC}"
git fetch origin master
git reset --hard origin/master
echo -e "${GREEN}✓ Now at commit:${NC}"
git log --oneline -1
echo ""

echo -e "${YELLOW}Step 4: Stopping container...${NC}"
docker-compose down --remove-orphans
echo -e "${GREEN}✓ Container stopped${NC}"
echo ""

echo -e "${YELLOW}Step 5: Cleaning build cache...${NC}"
rm -rf .next node_modules
docker system prune -f
echo -e "${GREEN}✓ Cache cleaned${NC}"
echo ""

echo -e "${YELLOW}Step 6: Building new image (this takes 2-5 mins)...${NC}"
docker-compose build --no-cache web 2>&1 | tee /tmp/build.log
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

echo -e "${YELLOW}Step 7: Starting container...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Container started${NC}"
echo ""

echo -e "${YELLOW}Step 8: Waiting for startup (15s)...${NC}"
sleep 15

echo -e "${YELLOW}Step 9: Checking container status...${NC}"
CONTAINER_ID=$(docker ps -q --filter "name=x8okwogw0so8s08oss04s088-web")
if [ -n "$CONTAINER_ID" ]; then
    echo -e "${GREEN}✓ Container running:${NC}"
    docker ps --filter "name=x8okwogw0so8s08oss04s088"
else
    echo -e "${RED}✗ Container not running!${NC}"
    echo "Checking logs..."
    docker-compose logs --tail=30
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 10: Health check...${NC}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Site responding (HTTP 200)${NC}"
else
    echo -e "${RED}✗ Site returned HTTP $HEALTH${NC}"
fi
echo ""

echo "========================================"
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo "========================================"
echo ""
echo "Verify at: https://sealsend.app"
echo "Check logs: docker-compose logs -f web"
echo ""
echo "New homepage should show:"
echo "  - 'SealSend' (no spaces)"
echo "  - Gradient purple/blue hero"
echo "  - 'Now in Beta' badge"
echo "  - 'Create Your Invitation' button"
