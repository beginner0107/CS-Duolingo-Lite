# Docker Data Persistence Solution

## Problem
When using the CS Study App in Docker containers, all user data (questions, decks, progress, etc.) is lost when containers are stopped and restarted. This happens because:

1. The app stores data in IndexedDB and localStorage in the browser
2. This data lives in the container's ephemeral filesystem
3. When containers restart, the ephemeral filesystem is reset

## Solution
We've implemented an automatic backup and restore system that preserves data across container restarts:

### Features
1. **Automatic Backup**: Data is automatically backed up every 5 minutes and when the app closes
2. **Automatic Restore**: When the app starts with no data, it automatically restores from the last backup
3. **Manual Backup/Restore**: Users can manually download and upload backup files
4. **Docker Volume**: A persistent volume is mounted for backup storage

### How It Works

#### Automatic Process
1. When the app loads, it checks if data exists in IndexedDB
2. If no data is found, it looks for a backup in localStorage or mounted volume
3. If a backup exists, it automatically restores all data
4. The app continues to create automatic backups during usage

#### Manual Process
Users can access backup controls in the "데이터 관리" (Data Management) section:
- **백업 다운로드** (Download Backup): Downloads a complete backup file
- **백업 복원** (Restore Backup): Uploads and restores from a backup file

### Technical Implementation

#### Files Added
- `src/utils/docker-persistence.js`: Core backup/restore functionality
- `data/backups/`: Directory for persistent backup storage

#### Files Modified
- `app.js`: Integration of backup system into app initialization
- `cs-duolingo-lite.html`: Added backup UI controls
- `docker-compose.yml`: Added volume mount for backup directory

#### Key Functions
- `exportAllData()`: Exports complete app data to JSON
- `importAllData()`: Imports complete app data from JSON
- `enableAutoBackup()`: Sets up automatic backup intervals
- `checkAndRestore()`: Checks for and restores backup on startup

### Usage Instructions

#### Docker Setup
1. The docker-compose.yml includes a volume mount: `./data/backups:/app/backups`
2. This ensures backup files persist even when containers are recreated
3. Simply restart containers normally - data will be preserved

#### Manual Backup
1. Go to the "관리" (Manage) tab
2. Scroll to "🐳 Docker 컨테이너용 백업" section
3. Click "백업 다운로드" to download a backup file
4. Store this file safely outside the container

#### Manual Restore
1. Go to the "관리" (Manage) tab
2. Click "백업 복원" in the Docker backup section
3. Select your backup JSON file
4. Data will be restored and the page will refresh

### Backup Data Structure
```json
{
  "version": "1.0",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "profile": { "xp": 1000, "streak": 5 },
  "decks": [...],
  "questions": [...],
  "reviews": [...],
  "notes": [...],
  "dailyRollup": {...}
}
```

### Troubleshooting

#### Data Not Restoring
1. Check browser console for error messages
2. Verify backup file is valid JSON
3. Try manual restore with a known good backup

#### Backup Not Working
1. Check if localStorage is available in your browser
2. Verify the volume mount is working: `docker-compose logs frontend`
3. Check console for backup creation messages

#### Container Permissions
If you encounter permission issues with the backup directory:
```bash
sudo chown -R $(whoami):$(whoami) data/backups
chmod -R 755 data/backups
```

### Benefits
- **Zero Data Loss**: Complete preservation across container restarts
- **Automatic**: No user intervention required for normal operation
- **Manual Control**: Users can create and restore backups on demand
- **Docker-Friendly**: Works seamlessly with standard Docker workflows
- **Lightweight**: Minimal performance impact on app operation

This solution ensures that users never lose their study progress, questions, or settings when working with the CS Study App in Docker environments.