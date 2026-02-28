#!/bin/bash

BASE_URL="http://localhost:5004/api/auth"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="password123"

echo "Testing Authentication Endpoints..."
echo "Using Email: $EMAIL"

# 1. Signup
echo -e "\n1. Testing Signup..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/signup" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Test User\", \"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"businessName\": \"Test Biz\"}")

echo "Response: $SIGNUP_RESPONSE"

if [[ $SIGNUP_RESPONSE == *"token"* ]]; then
  echo "✅ Signup Successful"
else
  echo "❌ Signup Failed"
  exit 1
fi

# Extract token for verification (simulated, since we can't read email here easily without more complex setup)
# But wait, the response doesn't return the verification token, it sends it via email.
# To test verification, we'd need to peek into the DB or just trust the email sending logic logs.
# For this script, we'll skip actual verification token extraction unless we add a test-only endpoint or check logs.
# However, we can test Login.

# 2. Login
echo -e "\n2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

echo "Response: $LOGIN_RESPONSE"

if [[ $LOGIN_RESPONSE == *"token"* ]]; then
  echo "✅ Login Successful"
else
  echo "❌ Login Failed"
  exit 1
fi

# 3. Forgot Password
echo -e "\n3. Testing Forgot Password..."
FORGOT_RESPONSE=$(curl -s -X POST "$BASE_URL/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}")

echo "Response: $FORGOT_RESPONSE"

if [[ $FORGOT_RESPONSE == *"sent"* ]]; then
  echo "✅ Forgot Password Successful"
else
  echo "❌ Forgot Password Failed"
  exit 1
fi

# 4. Reset Password (Mock)
# We can't easily get the reset token here without DB access.
# But checking the forgot password response gives confidence the endpoint exists and runs.

echo -e "\nTests Completed."
