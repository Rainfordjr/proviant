#!/bin/bash
# Proviant — Git setup script
# Run this from the Proviant folder: ./setup-git.sh

set -e

echo ""
echo "=== Proviant Git Setup ==="
echo ""

# Initialize repo
git init
git branch -M main

# Configure git identity (needed for first commit)
read -p "Your name (for git commits): " GIT_NAME
read -p "Your email (for git commits): " GIT_EMAIL
git config user.name "$GIT_NAME"
git config user.email "$GIT_EMAIL"

# Stage everything and commit
git add .
echo ""
echo "Staging $(git diff --cached --numstat | wc -l | tr -d ' ') files..."
git commit -m "Initial commit — Proviant food manufacturing platform"
echo ""
echo "✓ Repository initialized and first commit created."
echo ""

# Connect to GitHub
read -p "Paste your GitHub repo URL (e.g. https://github.com/you/proviant.git): " REPO_URL
git remote add origin "$REPO_URL"

# Push
echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "=== Done! ==="
echo "Your project is now on GitHub at: $REPO_URL"
echo ""
echo "On your other Mac, run:"
echo "  git clone $REPO_URL"
echo "  cd Proviant"
echo "  npm install"
echo "  # then copy over your .env.local"
echo ""

# Clean up this script from the repo
rm -f setup-git.sh
