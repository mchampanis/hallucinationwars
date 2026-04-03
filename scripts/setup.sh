#!/usr/bin/env bash
# Hallucination Wars - macOS Setup
# Run from project root: bash scripts/setup.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${CYAN}=== Hallucination Wars - macOS Setup ===${NC}"

# Check Node.js
if command -v node &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Node.js $(node --version)"
else
    echo -e "${RED}[!!]${NC} Node.js not found. Install via: brew install node"
    exit 1
fi

# Check npm
if command -v npm &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} npm $(npm --version)"
else
    echo -e "${RED}[!!]${NC} npm not found"
    exit 1
fi

# Check git
if command -v git &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} $(git --version)"
else
    echo -e "${RED}[!!]${NC} git not found. Install via: brew install git"
    exit 1
fi

# Check VS Code
if command -v code &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} VS Code found"

    echo -e "\n${CYAN}Installing recommended VS Code extensions...${NC}"
    extensions=(
        "ms-vsliveshare.vsliveshare"
        "sumneko.lua"
        "dbaeumer.vscode-eslint"
        "esbenp.prettier-vscode"
        "editorconfig.editorconfig"
    )
    for ext in "${extensions[@]}"; do
        code --install-extension "$ext" --force 2>/dev/null || true
    done
    echo -e "${GREEN}[OK]${NC} Extensions installed"
else
    echo -e "${YELLOW}[--]${NC} VS Code CLI not found (optional, install extensions manually)"
    echo "    To enable 'code' command: open VS Code > Cmd+Shift+P > 'Shell Command: Install'"
fi

# Install npm dependencies (when package.json exists)
if [ -f "package.json" ]; then
    echo -e "\n${CYAN}Installing npm dependencies...${NC}"
    npm install
    echo -e "${GREEN}[OK]${NC} Dependencies installed"
else
    echo -e "${YELLOW}[--]${NC} No package.json yet, skipping npm install"
fi

echo -e "\n${CYAN}=== Setup complete ===${NC}"
echo "Next steps:"
echo "  1. Open this folder in VS Code"
echo "  2. Accept the recommended extensions prompt"
echo "  3. Start a Live Share session or join one from your collaborator"
echo "  4. Coordinate on Discord #github-hw"
