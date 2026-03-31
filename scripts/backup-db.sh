#!/bin/bash
# MongoDB Backup Script
# Usage: ./scripts/backup-db.sh [backup_dir]
# Backs up the lexai database from the running Docker container.

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/lexai_${TIMESTAMP}"
CONTAINER="lexai-mongodb"
DB_NAME="lexai"

echo "Starting MongoDB backup..."
echo "  Container : $CONTAINER"
echo "  Database  : $DB_NAME"
echo "  Output    : $BACKUP_PATH"

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Run mongodump inside the container
docker exec "$CONTAINER" mongodump \
    --db "$DB_NAME" \
    --out "/tmp/backup_${TIMESTAMP}"

# Copy dump out of container
docker cp "${CONTAINER}:/tmp/backup_${TIMESTAMP}/." "$BACKUP_PATH"

# Clean up temp files inside container
docker exec "$CONTAINER" rm -rf "/tmp/backup_${TIMESTAMP}"

# Compress the backup
tar -czf "${BACKUP_PATH}.tar.gz" -C "$BACKUP_DIR" "lexai_${TIMESTAMP}"
rm -rf "$BACKUP_PATH"

echo "Backup complete: ${BACKUP_PATH}.tar.gz"
echo "Size: $(du -sh "${BACKUP_PATH}.tar.gz" | cut -f1)"
