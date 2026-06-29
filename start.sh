#!/bin/bash

# ============================================
# AI Revenue Recognition Engine - Start Script
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║    AI Revenue Recognition Engine             ║"
echo "║    ASC 606 Compliance Platform               ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p "$SCRIPT_DIR/logs"

# Load environment variables
if [ -f .env ]; then
    echo -e "${GREEN}[✓] Loading environment variables...${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}[✗] .env file not found! Please create one.${NC}"
    exit 1
fi

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}[!] Killing existing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Clean up ports
echo -e "${BLUE}[*] Cleaning up ports...${NC}"
kill_port 3000
kill_port 3001

# Check if PostgreSQL is running
echo -e "${BLUE}[*] Checking PostgreSQL...${NC}"
if pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} > /dev/null 2>&1; then
    echo -e "${GREEN}[✓] PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}[!] Starting PostgreSQL...${NC}"
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
        echo -e "${RED}[✗] Could not start PostgreSQL. Please start it manually.${NC}"
        exit 1
    }
    sleep 2
fi

# Create database if it doesn't exist
echo -e "${BLUE}[*] Setting up database...${NC}"
if psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw ${DB_NAME:-revenue_recognition}; then
    echo -e "${GREEN}[✓] Database '${DB_NAME:-revenue_recognition}' exists${NC}"
else
    echo -e "${YELLOW}[!] Creating database '${DB_NAME:-revenue_recognition}'...${NC}"
    createdb -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} ${DB_NAME:-revenue_recognition} 2>/dev/null || {
        psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -c "CREATE DATABASE ${DB_NAME:-revenue_recognition};" 2>/dev/null || true
    }
fi

# Install backend dependencies
echo -e "${BLUE}[*] Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ]; then
    npm install --silent
else
    echo -e "${GREEN}[✓] Backend dependencies already installed${NC}"
fi

# Install frontend dependencies
echo -e "${BLUE}[*] Installing frontend dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install --silent
else
    echo -e "${GREEN}[✓] Frontend dependencies already installed${NC}"
fi

# Seed database
echo -e "${BLUE}[*] Seeding database...${NC}"
cd "$SCRIPT_DIR/backend"
node seed.js
echo -e "${GREEN}[✓] Database seeded successfully${NC}"

# Start backend with nodemon (auto-reload on changes)
echo -e "${BLUE}[*] Starting backend server (port 3001) with auto-reload...${NC}"
cd "$SCRIPT_DIR/backend"
BACKEND_LOG="$SCRIPT_DIR/logs/backend.log"
: > "$BACKEND_LOG"
npx nodemon server.js 2>&1 | tee -a "$BACKEND_LOG" &
BACKEND_PID=$!
echo -e "${GREEN}[✓] Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend to be ready
echo -e "${BLUE}[*] Waiting for backend to be ready...${NC}"
BACKEND_READY=false
for i in {1..30}; do
    if curl -fsS http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}[✓] Backend is ready${NC}"
        BACKEND_READY=true
        break
    fi
    sleep 1
done
if [ "$BACKEND_READY" != "true" ]; then
    echo -e "${RED}[✗] Backend did not become ready. Last backend log lines:${NC}"
    tail -n 40 "$BACKEND_LOG" || true
    exit 1
fi

# Start frontend with hot reload
echo -e "${BLUE}[*] Starting frontend (port 3000) with hot-reload...${NC}"
cd "$SCRIPT_DIR/frontend"
FRONTEND_LOG="$SCRIPT_DIR/logs/frontend.log"
: > "$FRONTEND_LOG"
BROWSER=none PORT=3000 npm start 2>&1 | tee -a "$FRONTEND_LOG" &
FRONTEND_PID=$!
echo -e "${GREEN}[✓] Frontend started (PID: $FRONTEND_PID)${NC}"

# Wait for frontend to be ready
echo -e "${BLUE}[*] Waiting for frontend to be ready...${NC}"
FRONTEND_READY=false
for i in {1..30}; do
    if curl -fsS http://localhost:3000/ > /dev/null 2>&1; then
        echo -e "${GREEN}[✓] Frontend is ready${NC}"
        FRONTEND_READY=true
        break
    fi
    sleep 1
done
if [ "$FRONTEND_READY" != "true" ]; then
    echo -e "${RED}[✗] Frontend did not become ready. Last frontend log lines:${NC}"
    tail -n 40 "$FRONTEND_LOG" || true
    exit 1
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗"
echo -e "║  ${GREEN}Application is starting up!${CYAN}                  ║"
echo -e "║                                              ║"
echo -e "║  ${NC}Frontend:  ${GREEN}http://localhost:3000${CYAN}              ║"
echo -e "║  ${NC}Backend:   ${GREEN}http://localhost:3001${CYAN}              ║"
echo -e "║                                              ║"
echo -e "║  ${NC}Login:     ${YELLOW}admin@revrec.com / password123${CYAN}    ║"
echo -e "║                                              ║"
echo -e "║  ${NC}Logs:      ${YELLOW}logs/backend.log${CYAN}                  ║"
echo -e "║             ${YELLOW}logs/frontend.log${CYAN}                 ║"
echo -e "║                                              ║"
echo -e "║  ${NC}Press ${RED}Ctrl+C${NC} to stop all services${CYAN}           ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}[!] Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    kill_port 3000
    kill_port 3001
    echo -e "${GREEN}[✓] All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Monitor both processes. If either one dies, stop the other and show logs.
while true; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${RED}[✗] Backend process stopped. Last backend log lines:${NC}"
        tail -n 60 "$BACKEND_LOG" || true
        cleanup
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${RED}[✗] Frontend process stopped. Last frontend log lines:${NC}"
        tail -n 60 "$FRONTEND_LOG" || true
        cleanup
    fi
    sleep 2
done
