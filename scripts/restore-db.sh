#!/bin/bash
# MongoDB Restore Script
# Usage: ./scripts/restore-db.sh <backup_file.tar.gz>

set -e

BACKUP_FILE="$1"
CONTAINER="lexai-mongodb"
DB_NAME="lexai"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring MongoDB from: $BACKUP_FILE"
echo "  Container : $CONTAINER"
echo "  Database  : $DB_NAME"
echo ""
read -p "WARNING: This will overwrite the existing database. Continue? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Restore cancelled."
    exit 0
fi

TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Copy dump into container
docker cp "$TEMP_DIR/." "${CONTAINER}:/tmp/restore_data"

# Run mongorestore
docker exec "$CONTAINER" mongorestore \
    --db "$DB_NAME" \
    --drop \
    "/tmp/restore_data/${DB_NAME}"

# Cleanup
docker exec "$CONTAINER" rm -rf "/tmp/restore_data"
rm -rf "$TEMP_DIR"

echo "Restore complete."
