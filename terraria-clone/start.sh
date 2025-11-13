#!/bin/bash

echo "========================================="
echo "   TerraQuest - Starting Game Server    "
echo "========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🚀 Starting server..."
echo ""
echo "📍 Server will run on: http://localhost:3000"
echo ""

# Get local IP address
if command -v ipconfig &> /dev/null; then
    # Windows
    echo "🌐 For multiplayer, share this address with friends on the same WiFi:"
    ipconfig | grep "IPv4" | head -1
elif command -v ifconfig &> /dev/null; then
    # Mac/Linux with ifconfig
    echo "🌐 For multiplayer, share this address with friends on the same WiFi:"
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print "   http://"$2":3000"}' | head -1
else
    # Linux with ip command
    echo "🌐 For multiplayer, share this address with friends on the same WiFi:"
    ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print "   http://"$2":3000"}' | head -1
fi

echo ""
echo "========================================="
echo ""

npm start
