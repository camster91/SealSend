#!/bin/bash
echo Checking TypeScript errors...
echo ==============================

# Create a temporary Dockerfile to run TypeScript check
cat > Dockerfile.tscheck << 'DOCKEREOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Run TypeScript check
RUN npx tsc --noEmit
DOCKEREOF

# Build and run
docker build -f Dockerfile.tscheck -t ts-check . 2>&1

# Cleanup
rm -f Dockerfile.tscheck
