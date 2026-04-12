# Database Storage Diagnostic Script (PowerShell)
# Run this to quickly diagnose why data isn't storing

Write-Host "🔍 LexAI Database Storage Diagnostic" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker
Write-Host "1️⃣  Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "   → Start Docker Desktop and try again" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check containers
Write-Host "2️⃣  Checking containers..." -ForegroundColor Yellow
$mongoStatus = docker ps --filter "name=lexai-mongodb" --format "{{.Status}}" 2>$null
$workerStatus = docker ps --filter "name=lexai-worker" --format "{{.Status}}" 2>$null
$apiStatus = docker ps --filter "name=lexai-api" --format "{{.Status}}" 2>$null

if ([string]::IsNullOrEmpty($mongoStatus)) {
    Write-Host "❌ MongoDB container is not running" -ForegroundColor Red
    Write-Host "   → Run: docker-compose up -d mongodb" -ForegroundColor Yellow
} else {
    Write-Host "✅ MongoDB: $mongoStatus" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($workerStatus)) {
    Write-Host "❌ Worker container is not running" -ForegroundColor Red
    Write-Host "   → Run: docker-compose up -d worker" -ForegroundColor Yellow
} else {
    Write-Host "✅ Worker: $workerStatus" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($apiStatus)) {
    Write-Host "⚠️  API container is not running" -ForegroundColor Yellow
    Write-Host "   → Run: docker-compose up -d api" -ForegroundColor Yellow
} else {
    Write-Host "✅ API: $apiStatus" -ForegroundColor Green
}
Write-Host ""

# Check MongoDB connection
Write-Host "3️⃣  Checking MongoDB connection..." -ForegroundColor Yellow
try {
    $pingResult = docker exec lexai-mongodb mongosh --quiet --eval "db.adminCommand('ping').ok" 2>$null
    if ($pingResult -eq "1") {
        Write-Host "✅ MongoDB is responding" -ForegroundColor Green
        
        # Check database
        $docCount = docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments()" 2>$null | Select-Object -Last 1
        Write-Host "   📊 Total analyses in database: $docCount" -ForegroundColor Cyan
        
        $completed = docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments({status: 'completed'})" 2>$null | Select-Object -Last 1
        Write-Host "   ✅ Completed: $completed" -ForegroundColor Green
        
        $pending = docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments({status: 'pending'})" 2>$null | Select-Object -Last 1
        Write-Host "   ⏳ Pending: $pending" -ForegroundColor Yellow
        
        $failed = docker exec lexai-mongodb mongosh --quiet --eval "use lexai; db.analyses.countDocuments({status: 'failed'})" 2>$null | Select-Object -Last 1
        Write-Host "   ❌ Failed: $failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Cannot connect to MongoDB" -ForegroundColor Red
}
Write-Host ""

# Check worker logs
Write-Host "4️⃣  Checking worker logs (last 20 lines)..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray
$logs = docker logs lexai-worker --tail 20 2>&1 | Select-String -Pattern "(Processing|saved|failed|error|Error|MongoDB)"
if ($logs) {
    $logs | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "No relevant logs found" -ForegroundColor Gray
}
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

# Check environment variables
Write-Host "5️⃣  Checking environment variables..." -ForegroundColor Yellow
$mongoUri = docker exec lexai-worker env 2>$null | Select-String "MONGO_URI" | ForEach-Object { $_.ToString().Split('=')[1] }
$groqKey = docker exec lexai-worker env 2>$null | Select-String "GROQ_API_KEY" | ForEach-Object { $_.ToString().Split('=')[1] }

if ([string]::IsNullOrEmpty($mongoUri)) {
    Write-Host "❌ MONGO_URI not set in worker" -ForegroundColor Red
} else {
    Write-Host "✅ MONGO_URI: $mongoUri" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($groqKey)) {
    Write-Host "❌ GROQ_API_KEY not set in worker" -ForegroundColor Red
} elseif ($groqKey -eq "gsk_your-groq-api-key-here") {
    Write-Host "⚠️  GROQ_API_KEY is still the example value" -ForegroundColor Yellow
    Write-Host "   → Update .env with your actual Groq API key" -ForegroundColor Yellow
} else {
    $keyPreview = $groqKey.Substring(0, [Math]::Min(20, $groqKey.Length))
    Write-Host "✅ GROQ_API_KEY is set ($keyPreview...)" -ForegroundColor Green
}
Write-Host ""

# Check RabbitMQ
Write-Host "6️⃣  Checking RabbitMQ..." -ForegroundColor Yellow
try {
    docker exec lexai-rabbitmq rabbitmq-diagnostics ping 2>$null | Out-Null
    Write-Host "✅ RabbitMQ is responding" -ForegroundColor Green
} catch {
    Write-Host "❌ RabbitMQ is not responding" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "📋 Summary" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan
if ([string]::IsNullOrEmpty($mongoStatus) -or [string]::IsNullOrEmpty($workerStatus)) {
    Write-Host "❌ ISSUE: Required containers are not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Quick Fix:" -ForegroundColor Yellow
    Write-Host "   docker-compose up -d" -ForegroundColor White
    Write-Host ""
} elseif ($groqKey -eq "gsk_your-groq-api-key-here" -or [string]::IsNullOrEmpty($groqKey)) {
    Write-Host "⚠️  ISSUE: Groq API key not configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 Quick Fix:" -ForegroundColor Yellow
    Write-Host "   1. Edit .env file" -ForegroundColor White
    Write-Host "   2. Set GROQ_API_KEY=your-actual-key" -ForegroundColor White
    Write-Host "   3. Run: docker-compose restart worker" -ForegroundColor White
    Write-Host ""
} elseif ($pending -gt 0 -and $completed -eq 0) {
    Write-Host "⚠️  ISSUE: Jobs are pending but not completing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 Check worker logs:" -ForegroundColor Yellow
    Write-Host "   docker logs lexai-worker -f" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✅ Everything looks good!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Database Stats:" -ForegroundColor Cyan
    Write-Host "   Total: $docCount" -ForegroundColor White
    Write-Host "   Completed: $completed" -ForegroundColor White
    Write-Host "   Pending: $pending" -ForegroundColor White
    Write-Host "   Failed: $failed" -ForegroundColor White
}

Write-Host ""
Write-Host "For detailed troubleshooting, see: TROUBLESHOOTING.md" -ForegroundColor Cyan
