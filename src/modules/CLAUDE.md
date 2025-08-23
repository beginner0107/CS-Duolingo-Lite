# Modules Directory Documentation

## Overview
This directory contains the modular JavaScript components of the CS Study App. Each module encapsulates specific functionality and follows a clean separation of concerns pattern.

## Architecture
- **Modular Design**: Each file handles a distinct feature area
- **ES6 Modules**: Use import/export for clean dependencies
- **Functional Approach**: Mostly pure functions with minimal side effects
- **Event-Driven**: Integration through UI handlers and global state

## Core Modules

### `database.js`
- **Purpose**: IndexedDB data layer abstraction
- **Key Functions**:
  - CRUD operations for questions, decks, reviews, notes
  - Schema management and migrations
  - Database connection and error handling
- **Usage**: Used by all other modules for data persistence

### `session.js`
- **Purpose**: Learning session management and flow control
- **Key Functions**:
  - Session initialization and state management
  - Question progression logic
  - Session completion handling
- **Integration**: Works with ui-handlers.js for session UI

### `ui-handlers.js`
- **Purpose**: UI event handling and DOM manipulation
- **Key Functions**:
  - Tab switching and navigation
  - Modal dialogs (edit questions, etc.)
  - Form validation and user interactions
  - Toast notifications
- **Integration**: Central hub connecting UI to business logic

### `scoring.js`
- **Purpose**: Answer validation and grading logic
- **Key Functions**:
  - Multiple question type grading (OX, SHORT, KEYWORD, ESSAY)
  - Fuzzy matching for flexible answers
  - Keyword-based partial scoring
- **Integration**: Used by session.js for real-time grading

### `spaced-repetition.js`
- **Purpose**: SM-2 algorithm implementation for spaced repetition
- **Key Functions**:
  - Calculate next review intervals
  - Adjust ease factors based on performance
  - Due date calculations
- **Integration**: Used by session.js for scheduling reviews

### `statistics.js`
- **Purpose**: Learning analytics and progress tracking
- **Key Functions**:
  - Daily/weekly/monthly statistics
  - Difficult problems analysis
  - Learning calendar and streaks
  - Performance analytics
- **Integration**: Used by stats tab and progress displays

### `data-management.js`
- **Purpose**: Import/export functionality and data operations
- **Key Functions**:
  - CSV/TSV import with validation
  - Data export in multiple formats
  - Bulk operations and templates
  - Guided import workflows
- **Integration**: Used by manage tab for data operations

### `notes.js`
- **Purpose**: Note-taking and knowledge management
- **Key Functions**:
  - Create/edit/delete notes
  - Note organization by decks
  - Markdown export functionality
  - Convert notes to questions
- **Integration**: Used by notes tab for knowledge management

### `theme.js`
- **Purpose**: Theme switching and appearance management
- **Key Functions**:
  - Dark/light theme toggle
  - Theme persistence
  - CSS custom property management
- **Integration**: Global theme system used throughout app

### `drag-drop.js`
- **Purpose**: Drag and drop functionality for file imports
- **Key Functions**:
  - File drop zone handling
  - Drag visual feedback
  - File validation and processing
- **Integration**: Used by data-management.js for file imports

## Module Dependencies

### Dependency Flow
```
app.js (main)
├── ui-handlers.js (central UI hub)
├── session.js → scoring.js, spaced-repetition.js
├── statistics.js → database.js
├── data-management.js → drag-drop.js
├── notes.js → database.js
└── theme.js (independent)
```

### Database Integration
All data modules depend on `database.js`:
- session.js: Question and review data
- statistics.js: Analytics data
- notes.js: Note storage
- data-management.js: Bulk operations

## Usage Patterns

### Import Style
```javascript
import { functionName } from './src/modules/module-name.js';
```

### Global Window Binding
Many functions are bound to `window` for HTML onclick handlers:
```javascript
window.functionName = functionName;
```

### Event Handling
Modules use addEventListener for DOM events:
```javascript
document.addEventListener('change', handleEvent);
```

## Integration Points

### Main App Integration
- **app.js imports**: Core functionality from each module
- **HTML integration**: Functions bound to window for inline handlers
- **State management**: Session object shared across modules

### Inter-Module Communication
- **Direct imports**: Modules import functions from other modules
- **Global state**: Session and configuration objects
- **Event system**: Some modules communicate via DOM events

## Development Guidelines

### Adding New Modules
1. Create module in `/src/modules/`
2. Export functions using ES6 export
3. Import in app.js and bind to window if needed
4. Document dependencies and integration points

### Best Practices
- Keep modules focused on single responsibility
- Use pure functions where possible
- Handle errors gracefully with try/catch
- Provide JSDoc documentation for complex functions