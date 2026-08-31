#!/bin/bash
cd /app/applet/localeats-api
export PORT=4000
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
echo "Testing with valid (mock) Firebase token that resolves to IVWdBC0coNXJGTF9aySjnd4JGSm1 (but since mock, we can't test fully this way. We will test it manually or leave it as it gracefully fails in auth middleware since verifyIdToken will throw)"
kill $API_PID
