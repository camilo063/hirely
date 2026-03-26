#!/bin/bash
# Configure CORS on the S3 bucket to allow direct browser uploads.
# Run this once: bash scripts/configure-s3-cors.sh
#
# Requires: AWS CLI configured with credentials that have s3:PutBucketCors permission.

BUCKET="${S3_BUCKET_NAME:-empleo-nivelics}"

echo "Configuring CORS for bucket: $BUCKET"

aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://hirely-sepia.vercel.app", "http://localhost:3500"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

echo "CORS configured successfully."
echo ""
echo "Verifying:"
aws s3api get-bucket-cors --bucket "$BUCKET"
