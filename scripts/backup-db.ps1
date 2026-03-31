# MongoDB Backup Script (Windows PowerShell)
# Usage: .\scripts\backup-db.ps1 [-BackupDir .\backups]

param(
    [string]$BackupDir = ".\backups"
)

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = Join-Path $BackupDir "lexai_$Timestamp"
$Container = "lexai-mongodb"
$DbName = "lexai"

Write-Host "Starting MongoDB backup..."
Write-Host "  Container : $Container"
Write-Host "  Database  : $DbName"
Write-Host "  Output    : $BackupPath"

# Create backup directory
New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

# Run mongodump inside the container
docker exec $Container mongodump --db $DbName --out "/tmp/backup_$Timestamp"

# Copy dump out of container
docker cp "${Container}:/tmp/backup_$Timestamp/." $BackupPath

# Clean up temp files inside container
docker exec $Container rm -rf "/tmp/backup_$Timestamp"

# Compress
Compress-Archive -Path $BackupPath -DestinationPath "$BackupPath.zip"
Remove-Item -Recurse -Force $BackupPath

Write-Host "Backup complete: $BackupPath.zip"
