#!/usr/bin/env bash
set -euo pipefail

# Deploy: bump version, commit, tag, push to main
# Usage: ./deploy.sh [patch|minor|major]

BUMP="${1:-patch}"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Usage: ./deploy.sh [patch|minor|major]"
  exit 1
fi

# Ensure we're on main and clean
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: must be on main (currently on $BRANCH)"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is dirty — commit or stash first"
  exit 1
fi

# Read current version from package.json
CURRENT=$(grep '"version"' package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEXT="$MAJOR.$MINOR.$PATCH"
TAG="v$NEXT"

echo "Bumping $CURRENT → $NEXT ($BUMP)"

# Update package.json version
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEXT\"/" package.json

# Commit and tag
git add package.json
git commit -m "release: $TAG"
git tag -a "$TAG" -m "$TAG"

# Push commit and tag
git push origin main
git push origin "$TAG"

echo "Deployed $TAG"
