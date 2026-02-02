#!/bin/bash

# Test script for WatchedPeer API with multi-industry support
# This script tests the refactored WatchedPeer API

BASE_URL="http://localhost:3000"
ORG_ID="test-org-123"

echo "=== Testing WatchedPeer API with Multi-Industry Support ==="
echo ""

# Test 1: Create a banking peer
echo "Test 1: Creating a banking peer (杭州银行)..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "杭州银行",
    "industry": "banking",
    "institutionType": "城商行",
    "description": "城商行标杆"
  }')
echo "Response: $RESPONSE"
BANKING_PEER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created banking peer ID: $BANKING_PEER_ID"
echo ""

# Test 2: Create a securities peer
echo "Test 2: Creating a securities peer (中信证券)..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "中信证券",
    "industry": "securities",
    "institutionType": "券商",
    "description": "头部券商"
  }')
echo "Response: $RESPONSE"
SECURITIES_PEER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created securities peer ID: $SECURITIES_PEER_ID"
echo ""

# Test 3: Create an insurance peer
echo "Test 3: Creating an insurance peer (中国人寿)..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "中国人寿",
    "industry": "insurance",
    "institutionType": "寿险公司",
    "description": "寿险行业领导者"
  }')
echo "Response: $RESPONSE"
INSURANCE_PEER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created insurance peer ID: $INSURANCE_PEER_ID"
echo ""

# Test 4: Create an enterprise peer
echo "Test 4: Creating an enterprise peer (华为)..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "华为",
    "industry": "enterprise",
    "institutionType": "制造业",
    "description": "科技制造标杆"
  }')
echo "Response: $RESPONSE"
ENTERPRISE_PEER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created enterprise peer ID: $ENTERPRISE_PEER_ID"
echo ""

# Test 5: Get all watched peers
echo "Test 5: Getting all watched peers..."
RESPONSE=$(curl -s -X GET "${BASE_URL}/radar/watched-peers" \
  -H "X-Organization-Id: ${ORG_ID}")
echo "Response: $RESPONSE"
echo ""

# Test 6: Try to create duplicate peer (should fail)
echo "Test 6: Trying to create duplicate peer (should fail)..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "杭州银行",
    "industry": "banking",
    "institutionType": "城商行"
  }')
echo "Response: $RESPONSE"
echo ""

# Test 7: Create peer without description (optional field)
echo "Test 7: Creating peer without description..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "招商银行",
    "industry": "banking",
    "institutionType": "股份制银行"
  }')
echo "Response: $RESPONSE"
echo ""

# Test 8: Try to create peer with invalid industry (should fail)
echo "Test 8: Trying to create peer with invalid industry (should fail)..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/radar/watched-peers" \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -d '{
    "peerName": "测试机构",
    "industry": "invalid_industry",
    "institutionType": "测试类型"
  }')
echo "Response: $RESPONSE"
echo ""

echo "=== All tests completed ==="
