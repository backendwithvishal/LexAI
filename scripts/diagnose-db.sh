#!/bin/bash

# Database Storage Diagnostic Script
# Run this to quickly diagnose why data isn't storing

echo "🔍 LexAI Database Storage Diagnostic"
echo "===================================="
echo ""

# Check Docker
echo "1️⃣  Checking Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "   → Start Docker Desktop and try again"
    exit 1
else
    echo "✅ Docker is running"
fi
echo ""

# Check containers
echo "2️⃣  Checking containers..."
MONGODB_STATUS=$(docker ps --filter "name=lexai-mongodb" --format "{{.Status}}" 2>/dev/null)
WORKER_STATUS=$(docker ps --filter "name=lexai-worker" --format "{{.Status}}" 2>/dev/null)
API_STATUS=$(docker ps --filter "name=lexai-api" --format "{{.Status}}" 2>/dev/null)

if [ -z "$MONGODB_STATUS" ]; then
    echo "❌ MongoDB container is not running"
    echo "   → Run: docker-compose up -d mongodb"
else
    echo "✅ MongoDB: $MONGODB_STATUS"
fi

if [ -z "$WORKER_STATUS" ]; then
    echo "❌ Worker container is not running"
    echo "   → Run: docker-compose up -d worker"
else
    echo "✅ Worker: $WORKER_STATUS"
fi

if [ -z "$API_STATUS" ]; then
    echo "⚠️  API container is not running"
    echo "   → Run: docker-compose up -d api"
else
    echo "✅ API: $API_STATUS"
fi
echo ""

# Check MongoDB connection
echo "3️⃣  Checking MongoDB connection..."
if docker exec lexai-mongodb mongosh --quiet --eval "db.adminCommand('ping').ok" > /dev/null 2>&1; then
    echo "✅ MongoDB is responding"
    
    # Check database
    DOC_COUNT=$(docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments()" 2>/dev/null | tail -1)
    echo "   📊 Total analyses in database: $DOC_COUNT"
    
    COMPLETED=$(docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments({status: 'completed'})" 2>/dev/null | tail -1)
    echo "   ✅ Completed: $COMPLETED"
    
    PENDING=$(docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments({status: 'pending'})" 2>/dev/null | tail -1)
    echo "   ⏳ Pending: $PENDING"
    
    FAILED=$(docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments({status: 'failed'})" 2>/dev/null | tail -1)
    echo "   ❌ Failed: $FAILED"
else
    echo "❌ Cannot connect to MongoDB"
fi
echo ""

# Check worker logs
echo "4️⃣  Checking worker logs (last 20 lines)..."
echo "─────────────────────────────────────────"
docker logs lexai-worker --tail 20 2>&1 | grep -E "(Processing|saved|failed|error|Error|MongoDB)" || echo "No relevant logs found"
echo "─────────────────────────────────────────"
echo ""

# Check environment variables
echo "5️⃣  Checking environment variables..."
MONGO_URI=$(docker exec lexai-worker env 2>/dev/null | grep MONGO_URI | cut -d= -f2)
GROQ_KEY=$(docker exec lexai-worker env 2>/dev/null | grep GROQ_API_KEY | cut -d= -f2)

if [ -z "$MONGO_URI" ]; then
    echo "❌ MONGO_URI not set in worker"
else
    echo "✅ MONGO_URI: $MONGO_URI"
fi

if [ -z "$GROQ_KEY" ]; then
    echo "❌ GROQ_API_KEY not set in worker"
elif [ "$GROQ_KEY" = "gsk_your-groq-api-key-here" ]; then
    echo "⚠️  GROQ_API_KEY is still the example value"
    echo "   → Update .env with your actual Groq API key"
else
    echo "✅ GROQ_API_KEY is set (${GROQ_KEY:0:20}...)"
fi
echo ""

# Check RabbitMQ
echo "6️⃣  Checking RabbitMQ..."
if docker exec lexai-rabbitmq rabbitmq-diagnostics ping > /dev/null 2>&1; then
    echo "✅ RabbitMQ is responding"
else
    echo "❌ RabbitMQ is not responding"
fi
echo ""

# Summary
echo "📋 Summary"
echo "=========="
if [ -z "$MONGODB_STATUS" ] || [ -z "$WORKER_STATUS" ]; then
    echo "❌ ISSUE: Required containers are not running"
    echo ""
    echo "🔧 Quick Fix:"
    echo "   docker-compose up -d"
    echo ""
elif [ "$GROQ_KEY" = "gsk_your-groq-api-key-here" ] || [ -z "$GROQ_KEY" ]; then
    echo "⚠️  ISSUE: Groq API key not configured"
    echo ""
    echo "🔧 Quick Fix:"
    echo "   1. Edit .env file"
    echo "   2. Set GROQ_API_KEY=your-actual-key"
    echo "   3. Run: docker-compose restart worker"
    echo ""
elif [ "$PENDING" -gt 0 ] && [ "$COMPLETED" -eq 0 ]; then
    echo "⚠️  ISSUE: Jobs are pending but not completing"
    echo ""
    echo "🔧 Check worker logs:"
    echo "   docker logs lexai-worker -f"
    echo ""
else
    echo "✅ Everything looks good!"
    echo ""
    echo "📊 Database Stats:"
    echo "   Total: $DOC_COUNT"
    echo "   Completed: $COMPLETED"
    echo "   Pending: $PENDING"
    echo "   Failed: $FAILED"
fi

echo ""
echo "For detailed troubleshooting, see: TROUBLESHOOTING.md"
