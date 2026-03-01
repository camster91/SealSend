#!/bin/bash
# SealSend Deployment Script for VPS
# Run this on your VPS (187.77.26.99)

set -e

echo "========================================"
echo "SealSend Deployment Script"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to service directory
SERVICE_DIR="/data/coolify/services/x8okwogw0so8s08oss04s088"

echo -e "${YELLOW}Step 1: Checking service directory...${NC}"
if [ ! -d "$SERVICE_DIR" ]; then
    echo -e "${RED}Error: Service directory not found at $SERVICE_DIR${NC}"
    exit 1
fi

cd "$SERVICE_DIR"
echo -e "${GREEN}✓ Directory found${NC}"
echo ""

echo -e "${YELLOW}Step 2: Pulling latest code...${NC}"
git fetch origin
git reset --hard origin/master
echo -e "${GREEN}✓ Code updated to latest commit${NC}"
git log --oneline -1
echo ""

echo -e "${YELLOW}Step 3: Stopping existing containers...${NC}"
docker-compose down --remove-orphans
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

echo -e "${YELLOW}Step 4: Building new Docker image...${NC}"
echo "(This may take 2-5 minutes...)"
docker-compose build --no-cache web
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

echo -e "${YELLOW}Step 5: Starting containers...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

echo -e "${YELLOW}Step 6: Waiting for container to be ready...${NC}"
sleep 10

# Check container status
CONTAINER_STATUS=$(docker ps --filter "name=x8okwogw0so8s08oss04s088-web" --format "{{.Status}}" 2>/dev/null || echo "not found")
if [ "$CONTAINER_STATUS" != "not found" ]; then
    echo -e "${GREEN}✓ Container status: $CONTAINER_STATUS${NC}"
else
    echo -e "${RED}✗ Container not running - check logs below${NC}"
fi
echo ""

echo -e "${YELLOW}Step 7: Checking site health...${NC}"
sleep 5
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Site is responding (HTTP 200)${NC}"
else
    echo -e "${RED}✗ Site returned HTTP $HEALTH_STATUS${NC}"
fi
echo ""

echo "========================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose logs -f web"
echo "  Restart:      docker-compose restart web"
echo "  Shell access: docker exec -it x8okwogw0so8s08oss04s088-web sh"
echo ""
echo "Test the site:"
echo "  https://sealsend.app"
echo ""

# Show recent logs
echo -e "${YELLOW}Recent logs (last 20 lines):${NC}"
docker-compose logs --tail=20 web 2>/dev/null || echo "Could not fetch logs"
