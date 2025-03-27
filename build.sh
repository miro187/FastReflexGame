#!/bin/bash

# Exit on error
set -e

# Echo commands before executing
set -x

# Install dependencies
echo "Installing dependencies..."
npm install

# Create postcss.config.js if it doesn't exist
if [ ! -f postcss.config.js ]; then
  echo "Creating postcss.config.js..."
  cat > postcss.config.js << EOL
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
EOL
fi

# Build Next.js app
echo "Building Next.js app..."
npm run build

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy necessary files to dist
echo "Copying server files to dist..."
cp -r .next dist/
cp -r public dist/ || mkdir -p dist/public
cp package.json dist/
cp package-lock.json dist/ || echo "No package-lock.json found"
cp server.js dist/
cp postcss.config.js dist/ || echo "No postcss.config.js found"
cp tailwind.config.js dist/ || echo "No tailwind.config.js found"
cp next.config.js dist/ || echo "No next.config.js found"

# Create a minimal package.json for dist if needed
if [ ! -f dist/package.json ]; then
  echo "Creating minimal package.json in dist..."
  cat > dist/package.json << EOL
{
  "name": "fast-reflex",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "uuid": "^9.0.1"
  }
}
EOL
fi

echo "Build completed successfully!" 