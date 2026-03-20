# Database Storage Troubleshooting Guide

## Issue: Data Not Storing in MongoDB

### Quick Diagnosis Checklist

Run these commands to diagnose the issue:

```bash
# 1. Check if Docker is running
docker ps

# 2. Check if MongoDB container is running
docker ps --filter "name=mongodb"

# 3. Check MongoDB logs
docker logs lexai-mongodb --tail 50

# 4. Check Worker logs (this is where data gets saved)
docker logs lexai-worker --tail 100

# 5. Check if MongoDB volume exists
docker volume ls | grep mongodb

# 6. Connect to MongoDB and check data
docker exec -it lexai-mongodb mongosh
# Then in mongosh:
use lexai
db.analyses.find().limit(5)
db.analyses.countDocuments()
```

---

## Common Issues & Solutions

### 1. Docker Not Running
**Symptom:** `docker ps` fails with "cannot connect to docker daemon"

**Solution:**
- Windows: Start Docker Desktop
- Linux: `sudo systemctl start docker`
- Mac: Start Docker Desktop app

---

### 2. MongoDB Container Not Running
**Symptom:** `docker ps` shows no mongodb container

**Solution:**
```bash
# Start all services
docker-compose up -d

# Or start just MongoDB
docker-compose up -d mongodb

# Check status
docker-compose ps
```

---

### 3. Worker Not Processing Jobs
**Symptom:** Analysis status stays "pending", never becomes "completed"

**Check Worker Logs:**
```bash
docker logs lexai-worker -f
```

**Look for:**
- ❌ "MongoDB connection failed" → MongoDB not accessible
- ❌ "RabbitMQ connection failed" → RabbitMQ not accessible
- ❌ "OpenRouter API error" → Invalid API key or rate limit
- ✅ "Processing analysis job" → Worker is working
- ✅ "Analysis saved to database" → Data is being stored

**Solution:**
```bash
# Restart worker
docker-compose restart worker

# Check environment variables
docker exec lexai-worker env | grep MONGO_URI
docker exec lexai-worker env | grep OPENROUTER_API_KEY
```

---

### 4. MongoDB Connection Issues
**Symptom:** Worker logs show "MongoDB connection failed"

**Check MongoDB:**
```bash
# Check if MongoDB is healthy
docker exec lexai-mongodb mongosh --eval "db.adminCommand('ping')"

# Check MongoDB logs
docker logs lexai-mongodb --tail 50
```

**Solution:**
```bash
# Restart MongoDB
docker-compose restart mongodb

# Wait for it to be ready (takes ~10 seconds)
sleep 10

# Restart worker
docker-compose restart worker
```

---

### 5. Volume Permission Issues
**Symptom:** MongoDB logs show "permission denied" errors

**Solution:**
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker volume rm lexai_mongodb_data

# Recreate with correct permissions
docker-compose up -d
```

---

### 6. Missing Environment Variables
**Symptom:** Worker crashes or shows "undefined" errors

**Check .env file exists:**
```bash
ls -la .env
```

**If missing, create from example:**
```bash
cp .env.example .env
```

**Required variables for database storage:**
```env
MONGO_URI=mongodb://mongodb:27017/lexai
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
REDIS_HOST=redis
```

**Restart after updating .env:**
```bash
docker-compose down
docker-compose up -d
```

---

### 7. RabbitMQ Not Delivering Jobs
**Symptom:** Jobs queued but worker never receives them

**Check RabbitMQ:**
```bash
# Check RabbitMQ logs
docker logs lexai-rabbitmq --tail 50

# Access RabbitMQ management UI
# Open: http://localhost:15672
# Login: guest / guest
# Check: Queues tab → lexai.analysis.queue → should show messages
```

**Solution:**
```bash
# Restart RabbitMQ
docker-compose restart rabbitmq

# Wait for health check to pass
docker-compose ps rabbitmq
```

---

### 8. AI Service Returning Invalid Data
**Symptom:** Worker processes jobs but data fields are empty

**Check Worker Logs for:**
```
"AI analysis failed"
"Could not extract valid JSON from AI response"
```

**Solution:**
- Verify OpenRouter API key is valid
- Check if you have API credits/quota
- Try a different AI model in .env:
```env
AI_PRIMARY_MODEL=meta-llama/llama-3.1-8b-instruct:free
AI_FALLBACK_MODEL=mistralai/mistral-7b-instruct:free
```

---

## Verification Steps

After fixing issues, verify data is storing:

### 1. Submit a Test Analysis
```bash
# Use your API client or curl
curl -X POST http://localhost:3100/api/v1/analysis/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contractId": "YOUR_CONTRACT_ID"}'
```

### 2. Watch Worker Logs
```bash
docker logs lexai-worker -f
```

**Expected output:**
```
Processing analysis job: <jobId>
Analysis saved to database { analysisId: '...', riskScore: 45 }
Analysis completed in 12345ms
```

### 3. Check Database
```bash
docker exec -it lexai-mongodb mongosh
```

```javascript
use lexai

// Count total analyses
db.analyses.countDocuments()

// View latest analysis
db.analyses.find().sort({createdAt: -1}).limit(1).pretty()

// Check for completed analyses
db.analyses.find({status: "completed"}).count()

// Check for failed analyses
db.analyses.find({status: "failed"}).count()
```

### 4. Check via API
```bash
curl http://localhost:3100/api/v1/analysis/YOUR_ANALYSIS_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Code Fixes Applied

The following code issues were fixed in `src/workers/analysis.worker.js`:

1. ✅ Added `$set` operator to all `findByIdAndUpdate()` calls
2. ✅ Added defensive defaults for all fields (summary, riskScore, etc.)
3. ✅ Added validation to ensure updates succeed
4. ✅ Added better error logging
5. ✅ Added `new: true` and `runValidators: true` options

---

## Still Having Issues?

### Enable Debug Logging

**In docker-compose.yml, add to worker environment:**
```yaml
worker:
  environment:
    LOG_LEVEL: debug
```

**Restart:**
```bash
docker-compose restart worker
```

### Check All Services Health
```bash
# All containers should be "Up" and "healthy"
docker-compose ps

# Check each service
docker exec lexai-mongodb mongosh --eval "db.adminCommand('ping')"
docker exec lexai-redis redis-cli ping
docker exec lexai-rabbitmq rabbitmq-diagnostics ping
```

### Nuclear Option (Fresh Start)
```bash
# Stop everything
docker-compose down

# Remove all volumes (WARNING: deletes all data)
docker-compose down -v

# Remove all containers and images
docker-compose down --rmi all

# Rebuild and start fresh
docker-compose build --no-cache
docker-compose up -d

# Watch logs
docker-compose logs -f
```

---

## Contact Support

If none of these solutions work, provide:
1. Output of `docker-compose ps`
2. Output of `docker logs lexai-worker --tail 100`
3. Output of `docker logs lexai-mongodb --tail 50`
4. Your `.env` file (with secrets redacted)
