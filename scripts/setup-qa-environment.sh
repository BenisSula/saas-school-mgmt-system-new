#!/bin/bash
# Setup script for QA testing environment
# This script ensures the backend is ready for testing

echo "🔧 Setting up QA Testing Environment..."

# Check if backend is running
echo "📡 Checking if backend is running..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend is not running. Please start it with: npm run dev --prefix backend"
    exit 1
fi

# Seed demo accounts
echo "🌱 Seeding demo accounts..."
cd backend
npm run demo:seed
cd ..

echo "✅ QA environment setup complete!"
echo ""
echo "You can now run tests with: npm run qa:test"

