#!/bin/bash

# Test Profile Image Upload API

echo "=== Testing Profile Image Upload ==="
echo ""

# First, login to get a token
echo "1. Logging in to get auth token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5002/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Got auth token"
echo ""

# Create a test image
echo "2. Creating test image..."
convert -size 200x200 xc:blue /tmp/test-profile.jpg 2>/dev/null || {
  # If ImageMagick is not available, create a simple image with echo
  echo "Creating simple test file..."
  echo "Test Image Data" > /tmp/test-profile.jpg
}
echo "✅ Test image created"
echo ""

# Upload the image
echo "3. Uploading profile image..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:5002/api/profile/upload-image \
  -H "x-auth-token: $TOKEN" \
  -F "image=@/tmp/test-profile.jpg")

echo "Upload Response:"
echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"
echo ""

# Get profile to verify image path
echo "4. Getting profile to verify image..."
PROFILE_RESPONSE=$(curl -s -X GET http://localhost:5002/api/profile \
  -H "x-auth-token: $TOKEN")

echo "Profile Response:"
echo "$PROFILE_RESPONSE" | jq '.' 2>/dev/null || echo "$PROFILE_RESPONSE"
echo ""

# Extract image URL
IMAGE_URL=$(echo $PROFILE_RESPONSE | grep -o '"profileImage":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$IMAGE_URL" ]; then
  echo "✅ Profile image path: $IMAGE_URL"
  
  # Try to access the image
  echo ""
  echo "5. Testing image retrieval..."
  IMAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002$IMAGE_URL)
  
  if [ "$IMAGE_STATUS" = "200" ]; then
    echo "✅ Image is accessible at http://localhost:5002$IMAGE_URL"
  else
    echo "❌ Image not accessible (HTTP $IMAGE_STATUS)"
  fi
else
  echo "❌ No profile image found in response"
fi

echo ""
echo "=== Test Complete ==="
