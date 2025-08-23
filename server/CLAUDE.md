# Server Directory Documentation

## Overview
This directory contains the Express.js backend server components for the CS Study App, providing API endpoints for data persistence and server-side operations.

## Architecture
Simple Express.js REST API server that complements the client-side IndexedDB storage:
- **Express App**: Main server with CORS and JSON middleware
- **Router**: API route definitions and handlers
- **Database**: Server-side database operations (SQLite/alternative to IndexedDB)

## Files Structure

### `index.js`
- **Purpose**: Main Express server entry point
- **Configuration**:
  - CORS enabled for cross-origin requests
  - JSON body parsing middleware
  - API routes mounted at `/api`
  - Default port: 5174 (env configurable)
- **Usage**: `node server/index.js` to start server

### `router.js`
- **Purpose**: API route definitions and handlers
- **Expected Routes**: 
  - Question CRUD operations
  - Deck management
  - Review data synchronization
  - Import/export endpoints
- **Integration**: Complements client-side IndexedDB operations

### `database.js`
- **Purpose**: Server-side database operations
- **Function**: Alternative/backup to client-side IndexedDB
- **Usage**: Likely SQLite or similar for persistence

## Integration with Main App
- **Hybrid Architecture**: App works offline-first with IndexedDB, server provides:
  - Data backup/sync
  - Cross-device synchronization
  - Advanced analytics
  - Bulk operations
- **API Endpoints**: Called from main app when server is available
- **Fallback**: App fully functional without server (offline-first PWA)

## Development Setup
```bash
# Install server dependencies
npm install express cors

# Start server
node server/index.js
# or
PORT=3000 node server/index.js
```

## API Usage Pattern
```javascript
// Example API calls from main app
const response = await fetch('/api/questions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(questionData)
});
```

## Docker Integration
- Configured in root `docker-compose.yml`
- Separate service for backend API
- Environment variables for configuration

## Notes
- **Optional Component**: App functions without server (PWA design)
- **Complementary**: Enhances but doesn't replace client-side storage
- **Development Tool**: Useful for data management and debugging