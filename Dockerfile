# Multi-stage build for CS Study App
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Create package.json for server dependencies
RUN echo '{ \
  "name": "cs-study-app", \
  "version": "1.0.0", \
  "description": "CS Study App with optional server backend", \
  "main": "server/index.js", \
  "scripts": { \
    "start": "node server/index.js", \
    "serve": "npx serve . -l 8000" \
  }, \
  "dependencies": { \
    "express": "^4.18.2", \
    "cors": "^2.8.5", \
    "sqlite3": "^5.1.6", \
    "node-fetch": "^3.3.2", \
    "serve": "^14.2.1" \
  } \
}' > package.json

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose ports (8000 for frontend, 5174 for backend API)
EXPOSE 8000 5174

# Default command serves the frontend
CMD ["npx", "serve", ".", "-l", "8000", "--cors"]