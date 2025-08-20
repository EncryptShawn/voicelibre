#!/bin/sh

set -e

echo "🔧 Running DB migrations..."
npx prisma migrate deploy || echo "⚠️ Failed to run migrations"

echo "🚀 Starting app..."
exec npm run start

