#!/bin/bash
# SealSend Deployment Verification Script
# Run this on VPS (187.77.26.99) to verify deployment and database

set -e

echo "========================================"
echo "SealSend Deployment Verification"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd /data/coolify/services/x8okwogw0so8s08oss04s088

echo -e "${YELLOW}1. Checking Git Status...${NC}"
git log --oneline -3
echo ""

echo -e "${YELLOW}2. Checking Container Status...${NC}"
if docker ps | grep -q "x8okwogw0so8s08oss04s088"; then
    echo -e "${GREEN}✓ Container is running${NC}"
    docker ps --filter "name=x8okwogw0so8s08oss04s088" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo -e "${RED}✗ Container is NOT running${NC}"
    echo "Checking logs..."
    docker-compose logs --tail=20 web
fi
echo ""

echo -e "${YELLOW}3. Checking Site Health...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo -e "${GREEN}✓ Site is responding (HTTP 200)${NC}"
else
    echo -e "${RED}✗ Site is not responding correctly${NC}"
fi
echo ""

echo -e "${YELLOW}4. Checking Environment Variables...${NC}"
if docker exec x8okwogw0so8s08oss04s088-web printenv | grep -q "NEXT_PUBLIC_SITE_URL"; then
    echo -e "${GREEN}✓ Environment variables loaded${NC}"
else
    echo -e "${RED}✗ Environment variables missing${NC}"
fi
echo ""

echo -e "${YELLOW}5. Database Migration Check...${NC}"
echo "To verify database migration, run this SQL in Supabase:"
echo ""
echo "   SELECT column_name FROM information_schema.columns"
echo "   WHERE table_name = 'guests' AND column_name = 'last_login_at';"
echo ""
echo "   SELECT conname, pg_get_constraintdef(oid)"
echo "   FROM pg_constraint"
echo "   WHERE conname = 'guests_invite_status_check';"
echo ""

echo -e "${YELLOW}6. Checking New Routes...${NC}"
ROUTES=(
    "/invite/accept"
    "/dashboard"
    "/guest"
)
for route in "${ROUTES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$route" || echo "000")
    if [ "$STATUS" != "404" ] && [ "$STATUS" != "000" ]; then
        echo -e "${GREEN}✓ Route $route exists (HTTP $STATUS)${NC}"
    else
        echo -e "${RED}✗ Route $route not found (HTTP $STATUS)${NC}"
    fi
done
echo ""

echo "========================================"
echo "Verification Complete!"
echo "========================================"
echo ""
echo "Next Steps:"
echo "1. Apply database migration in Supabase SQL Editor"
echo "2. Test invite flow by sending an invitation"
echo "3. Check Coolify dashboard for any issues"
echo ""
