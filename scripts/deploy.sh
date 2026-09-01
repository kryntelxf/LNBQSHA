#!/bin/bash
# ============================================================
# LNBQSHA — Production Deployment Script
# One-command deploy to production
# ============================================================

set -e

echo "🚀 LNBQSHA Production Deployment"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Check prerequisites
echo "📋 Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required but not installed.${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}❌ Docker Compose is required but not installed.${NC}"; exit 1; }
echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# 2. Check environment file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env with your production values before continuing.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Environment file found${NC}"
echo ""

# 3. Pull latest changes
echo "📦 Pulling latest code..."
git pull origin master
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# 4. Build and deploy
echo "🏗️ Building and deploying containers..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✅ Containers deployed${NC}"
echo ""

# 5. Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# 6. Health check
echo "🏥 Running health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7350)
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${RED}❌ Health check failed. Please check logs.${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi
echo ""

# 7. Show status
echo "📊 Deployment Status:"
echo "   - API: http://localhost:7350"
echo "   - Console: http://localhost:7351"
echo "   - Dashboard: http://localhost:3000"
echo "   - Prometheus: http://localhost:9090"
echo ""

# 8. Show logs
echo "📋 Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

echo ""
echo -e "${GREEN}🎉 LNBQSHA is now LIVE!${NC}"
echo "   Web: https://lnbqsha.com"
echo "   Dashboard: https://lnbqsha.com/dashboard"
echo "   API: https://api.lnbqsha.com"
