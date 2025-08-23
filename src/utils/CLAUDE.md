# Utils Directory Documentation

## Overview
This directory contains utility functions that provide common, reusable functionality across the CS Study App. These are pure helper functions that don't depend on application state and can be used throughout the codebase.

## Architecture
- **Pure Functions**: Stateless utility functions with no side effects
- **Domain-Specific**: Organized by functionality (DOM, validation)
- **Reusable**: Imported by various modules as needed
- **Type-Safe**: Input validation and error handling

## Files Structure

### `db-error-handler.js`
**Purpose**: Comprehensive IndexedDB error handling and recovery system

#### Error Classification System
- **`IndexedDBError` Class**: Custom error class with type, severity, context
- **Error Types**: CONNECTION_FAILED, QUERY_FAILED, NO_DATA_FOUND, QUOTA_EXCEEDED, etc.
- **Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL with appropriate user messaging

#### Core Functions
- **`handleDBError(error, context, showUserMessage)`**: Main error handler with classification
- **`handleNoDataFound(context, showUserMessage)`**: Specific handler for missing data
- **`withErrorHandling(operation, context)`**: Wrapper for database operations
- **`checkIndexedDBHealth()`**: Database availability and health verification

#### Features
- **Automatic Error Classification**: Converts IndexedDB native errors to user-friendly types
- **Contextual Logging**: Detailed console logging with operation context
- **User Notifications**: Toast messages with appropriate severity styling
- **Recovery Strategies**: Built-in retry logic and fallback mechanisms
- **Health Monitoring**: Database connection and quota monitoring

#### Usage Examples
```javascript
// Wrap database operations
const result = await withErrorHandling(async () => {
  return await db.questions.get(id);
}, {
  operation: '문제 조회',
  table: 'questions',
  method: 'getQuestion',
  data: { id }
});

// Handle specific errors
try {
  await riskyDatabaseOperation();
} catch (error) {
  const dbError = handleDBError(error, {
    operation: '위험한 작업',
    table: 'data'
  });
  // Error is logged and user is notified automatically
}
```

### `db-error-test.js`
**Purpose**: Test utilities for IndexedDB error handling scenarios

#### Test Coverage
- Connection failure simulation
- Query failure scenarios  
- No data found cases
- Quota exceeded situations
- Error wrapper functionality
- Edge cases and null handling

#### Usage
```javascript
// Run in browser console
window.dbErrorTests.runAllErrorTests();
window.dbErrorTests.testConnectionFailure();
```

### `dom.js`
**Purpose**: DOM manipulation and UI utility functions

#### Core Functions
- **`escapeHtml(text)`**: Safely escape HTML to prevent XSS attacks
- **`showToast(message, type)`**: Display toast notifications (info, success, warning, error)
- **`closeModal(overlay)` / `openModal(overlay)`**: Modal dialog management
- **`createElement(tag, className, content)`**: Programmatically create DOM elements

#### Date & Time Utilities
- **`formatDate(date)`**: Format dates in Korean locale (ko-KR)
- **`formatDateTime(date)`**: Format date and time in Korean locale
- **Error handling**: Returns 'N/A' or 'Invalid Date' for edge cases

#### Performance Utilities
- **`debounce(func, wait)`**: Debounce function calls (search input, resize events)
- **`throttle(func, limit)`**: Throttle function calls (scroll handlers)

#### Usage Examples
```javascript
// Toast notification
showToast('문제가 저장되었습니다', 'success');

// Safe HTML rendering
const safeHtml = escapeHtml(userInput);

// Debounced search
const debouncedSearch = debounce(searchFunction, 300);
```

### `validation.js`
**Purpose**: Input validation and data sanitization functions

#### Basic Validators
- **`validateRequired(value)`**: Check if value is not empty
- **`validateMinLength(value, minLength)`**: Minimum string length
- **`validateMaxLength(value, maxLength)`**: Maximum string length
- **`validateEmail(email)`**: Email format validation using regex

#### Numeric Validators
- **`validateNumber(value)`**: Check if value is numeric
- **`validatePositiveNumber(value)`**: Positive numbers only
- **`validateInteger(value)`**: Integer validation
- **`validatePositiveInteger(value)`**: Positive integers only
- **`validateRange(value, min, max)`**: Number within range

#### Security & Sanitization
- **`sanitizeInput(input)`**: Remove potentially harmful content
  - Strips `<script>` tags
  - Removes `javascript:` protocols  
  - Removes event handler attributes (`onclick`, etc.)

#### Domain-Specific Validators
- **`validateQuestionData(data)`**: Complete question validation
  - Required fields check
  - Length limits (prompt: 1000 chars, answer: 500 chars)
  - Returns `{isValid, errors}` object

- **`validateDeckData(data)`**: Deck validation
  - Name required and length limit (100 chars)

- **`validateNoteData(data)`**: Note validation  
  - Title required (200 chars max)
  - Content limit (50,000 chars)

#### Usage Examples
```javascript
// Form validation
const result = validateQuestionData({
  prompt: '질문 내용',
  answer: '정답',
  explain: '설명'
});

if (!result.isValid) {
  console.log('Validation errors:', result.errors);
}

// Input sanitization
const safeInput = sanitizeInput(userInput);

// Basic validation
if (!validateRequired(title)) {
  showToast('제목을 입력하세요', 'warning');
}
```

## Integration Points

### Used By Modules
- **ui-handlers.js**: Form validation, DOM manipulation
- **data-management.js**: Input validation for imports
- **notes.js**: Note content validation
- **session.js**: Toast notifications
- **All modules**: HTML escaping for security

### Security Integration
- **XSS Prevention**: `escapeHtml()` used throughout for safe rendering
- **Input Sanitization**: `sanitizeInput()` cleans user-provided content
- **Validation**: Prevents invalid data from reaching business logic

## Common Patterns

### Validation Workflow
```javascript
import { validateQuestionData, sanitizeInput, showToast } from '../utils/validation.js';

function handleQuestionSubmit(formData) {
  // 1. Sanitize inputs
  const sanitized = {
    prompt: sanitizeInput(formData.prompt),
    answer: sanitizeInput(formData.answer),
    explain: sanitizeInput(formData.explain)
  };
  
  // 2. Validate
  const validation = validateQuestionData(sanitized);
  
  // 3. Handle results
  if (!validation.isValid) {
    showToast(validation.errors.join(', '), 'error');
    return;
  }
  
  // 4. Process valid data
  saveQuestion(sanitized);
}
```

### Toast Notification Pattern
```javascript
import { showToast } from '../utils/dom.js';

// Success operations
showToast('저장되었습니다', 'success');

// User warnings
showToast('필수 항목을 입력하세요', 'warning'); 

// Error handling
showToast('저장에 실패했습니다', 'error');

// Information
showToast('처리 중입니다...', 'info');
```

## Best Practices

### Function Design
- **Pure Functions**: No side effects, predictable outputs
- **Error Handling**: Graceful degradation for invalid inputs  
- **Type Safety**: Input validation at function boundaries
- **Performance**: Use debounce/throttle for expensive operations

### Security Considerations
- **Always sanitize** user inputs before storage or display
- **Validate all data** at application boundaries  
- **Escape HTML** when rendering dynamic content
- **Use validation functions** consistently across the app

## Development Guidelines

### Adding New Utilities
1. Keep functions pure and stateless
2. Add comprehensive input validation
3. Include JSDoc documentation
4. Export individual functions (not default exports)
5. Add usage examples in comments

### Testing Utilities
```javascript
// Test validation
console.assert(validateEmail('test@example.com') === true);
console.assert(validateRequired('') === false);

// Test DOM utilities
const element = createElement('div', 'test-class', 'content');
console.assert(element.className === 'test-class');
```