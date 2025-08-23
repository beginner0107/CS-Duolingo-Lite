# AI Directory Documentation

## Overview
This directory contains the AI integration layer for the CS Study App, providing both cloud-based and local AI functionality for answer grading and question generation.

## Architecture
The AI system uses an adapter pattern to support multiple AI backends:
- **CloudAdapter**: Integrates with external AI services (OpenAI, Anthropic, Google Gemini)
- **LocalAdapter**: Provides fallback local AI functionality

## Files Structure

### `index.js`
- **Purpose**: Main entry point and factory for AI adapters
- **Key Functions**:
  - `getAdapter(mode)`: Factory function returning CloudAdapter or LocalAdapter
  - `getConfig()`: Returns AI configuration with safe defaults
- **Exports**: Used by main app for AI functionality
- **Testing**: Includes `window.aiTest()` for console debugging

### `adapter.js`
- **Purpose**: Core adapter implementations
- **Key Classes**:
  - `CloudAdapter`: Handles cloud AI API calls
  - `LocalAdapter`: Provides local fallback functionality
- **Key Methods**:
  - `grade(input)`: Grades user answers (returns score 0-1, correctness, rationale)
  - `generateQuestions(input)`: Generates questions based on prompts
- **Types**: Comprehensive TypeScript-style JSDoc definitions

### `router.js`
- **Purpose**: Routes AI requests to appropriate handlers
- **Integration**: Works with server-side routing for AI endpoints

### `prompts.js`
- **Purpose**: Contains AI prompt templates and prompt engineering
- **Usage**: Templates for question generation and answer grading

## Configuration
AI adapters expect `window.__AI_CONF` object with:
```javascript
{
  enableCloud: boolean,
  baseUrl: string,      // API endpoint
  apiKey: string,       // API key
  provider: string,     // 'openai'|'anthropic'|'gemini'
  model: string         // Model name
}
```

## Integration Points
- **Main App**: Imported via `import { getAdapter } from './ai/index.js'`
- **Question Generation**: Used in manage tab for AI question creation
- **Answer Grading**: Used in session for intelligent answer validation
- **Fallback Strategy**: Local adapter as backup when cloud services unavailable

## Usage Patterns
```javascript
// Get adapter instance
const adapter = getAdapter('cloud'); // or 'local'

// Grade an answer
const result = await adapter.grade({
  prompt: userAnswer,
  reference: { answer: correctAnswer, keywords: ['key1', 'key2'] }
});

// Generate questions
const questions = await adapter.generateQuestions({
  prompt: 'Generate questions about operating systems',
  questionType: 'OX',
  count: 5
});
```

## Error Handling
- Cloud adapter falls back to local when API unavailable
- Configuration validation with helpful error messages
- Graceful degradation for unsupported features