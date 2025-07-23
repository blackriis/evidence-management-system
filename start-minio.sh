#!/bin/bash

# Start MinIO server for development
echo "Starting MinIO server on localhost:9000..."
echo "Console will be available at http://localhost:9001"
echo "Access Key: minioadmin"
echo "Secret Key: minioadmin"
echo ""

export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin

minio server ~/minio-data --console-address ":9001"