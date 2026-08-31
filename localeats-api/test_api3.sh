#!/bin/bash
cd /app/applet/localeats-api
export FIREBASE_PROJECT_ID="test-project"
export FIREBASE_CLIENT_EMAIL="test@example.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDE\n-----END PRIVATE KEY-----"
npm run build
node dist/server.js &
API_PID=$!
sleep 3
echo "Testing /health"
curl -s http://localhost:4000/health
echo ""
echo "Testing /api/v1/merchant/shop with no Auth"
curl -s http://localhost:4000/api/v1/merchant/shop
echo ""
echo "Testing with malformed token"
curl -s -H "Authorization: Bearer fb-malformed" http://localhost:4000/api/v1/merchant/shop
echo ""
kill $API_PID
