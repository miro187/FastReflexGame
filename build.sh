#!/bin/bash

# Exit on error
set -e

# Echo commands before executing
set -x

# Install dependencies
echo "Installing dependencies..."
npm install

# Ensure Tailwind is installed explicitly
echo "Ensuring Tailwind is installed..."
npm install tailwindcss@3.3.3 postcss@8.4.27 autoprefixer@10.4.14 --save

# Create postcss.config.js if it doesn't exist
if [ ! -f postcss.config.js ]; then
  echo "Creating postcss.config.js..."
  cat > postcss.config.js << EOL
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOL
fi

# Create or ensure tailwind.config.js
if [ ! -f tailwind.config.js ]; then
  echo "Creating tailwind.config.js..."
  cat > tailwind.config.js << EOL
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-red': '#FF4444',
        'game-green': '#44FF44',
      },
    },
  },
  plugins: [],
}
EOL
fi

# Build Next.js app
echo "Building Next.js app..."
NODE_OPTIONS='--max-old-space-size=4096' npm run build

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