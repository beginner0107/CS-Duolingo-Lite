# TypeScript Migration for CS Study App

## Overview

This directory contains comprehensive TypeScript definitions for migrating the CS Study App from JavaScript to TypeScript. The migration focuses on type-safe models and function signatures for the core quiz logic.

## Files Structure

```
src/types/
├── quiz-models.ts      # Core data models and interfaces
├── quiz-functions.ts   # Function signatures and database interfaces  
├── index.ts           # Main exports and utility types
├── usage-example.ts   # Practical examples and patterns
└── README.md         # This documentation
```

## Core Models

### 🎯 **Question Models**

**Base Question Interface:**
```typescript
interface Question {
  id: number;
  deck: number | string;
  type: QuestionType;
  prompt: string;
  answer?: string | boolean;
  explain?: string;
  created?: number;
  tags?: string[];
  // ... type-specific fields
}
```

**Type-Safe Question Variants:**
- `OXQuestion` - True/False questions with `boolean | 'true' | 'false'` answers
- `ShortQuestion` - Short answer with synonyms and fuzzy matching
- `EssayQuestion` - Essay questions with keyword arrays
- `KeywordQuestion` - Keyword-based grading with thresholds

**Union Type for Exhaustive Checking:**
```typescript
type TypedQuestion = OXQuestion | ShortQuestion | EssayQuestion | KeywordQuestion;
```

### 📊 **UserPerformance Model**

Tracks spaced repetition data and adaptive difficulty:

```typescript
interface UserPerformance {
  questionId: number;
  ease: number;              // SM-2 ease factor
  interval: number;          // Days until next review
  due: string;              // Next review date
  count: number;            // Total reviews
  difficulty?: DifficultyLevel;  // Adaptive difficulty (1-5)
  recentPerformance?: PerformanceRecord[];  // Trend tracking
}
```

### 📝 **Explanation Model**

Enhanced explanation system:

```typescript
interface Explanation {
  content: string;
  type: 'basic' | 'detailed' | 'ai-generated';
  questionId: number;
  confidence?: number;
  relatedConcepts?: string[];
  targetDifficulty?: DifficultyLevel;
}

interface InteractiveExplanation extends Explanation {
  followUpQuestions?: string[];
  examples?: string[];
  resources?: { title: string; url: string; type: string }[];
  visuals?: { type: string; content: string; caption?: string }[];
}
```

## Type-Safe Function Signatures

### 🎯 **Question Management**

```typescript
function createQuestion<T extends QuestionType>(
  type: T,
  baseData: Omit<Question, 'id' | 'type'>,
  typeSpecificData: // Type-specific parameters based on T
): TypedQuestion;

function validateQuestion(question: Question): {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
};
```

### ⚡ **Answer Grading**

```typescript
function gradeAnswer(question: TypedQuestion, userAnswer: string): Promise<GradingResult>;

// Type-specific grading functions
function gradeOXAnswer(question: OXQuestion, userAnswer: string | boolean): GradingResult;
function gradeShortAnswer(question: ShortQuestion, userAnswer: string, options?: GradingOptions): GradingResult;
function gradeEssayAnswer(question: EssayQuestion, userAnswer: string, options?: AIGradingOptions): Promise<GradingResult>;
```

### 📈 **Spaced Repetition**

```typescript
function calculateNextReview(performance: UserPerformance, grade: Grade): UserPerformance;
function getDueQuestions(questions: Question[], performances: Record<number, UserPerformance>): Question[];
```

### 🎚️ **Adaptive Difficulty**

```typescript
function shouldAdjustDifficulty(accuracy: number, currentDifficulty: DifficultyLevel): {
  shouldAdjust: boolean;
  newDifficulty: DifficultyLevel;
  reason: string;
};

function selectQuestionsByDifficulty(
  questions: Question[],
  performances: Record<number, UserPerformance>,
  targetDifficulty: DifficultyLevel,
  tolerance?: number
): Question[];
```

## Usage Patterns

### 1. **Type-Safe Question Creation**

```typescript
// Compile-time type checking ensures correct structure
const oxQuestion: OXQuestion = {
  id: 1,
  deck: 'networking',
  type: 'OX',
  prompt: 'TCP is connection-oriented.',
  answer: 'true',  // Must be boolean | 'true' | 'false'
  // keywords: [...] // ❌ Compile error - not allowed for OX
};

const shortQuestion: ShortQuestion = {
  id: 2,
  deck: 'algorithms', 
  type: 'SHORT',
  prompt: 'Time complexity of binary search?',
  answer: 'O(log n)',
  synonyms: ['O(lg n)', 'logarithmic'],
  shortFuzzy: true
  // keywords: [...] // ❌ Compile error - not allowed for SHORT
};
```

### 2. **Exhaustive Question Processing**

```typescript
function processQuestion(question: TypedQuestion): string {
  switch (question.type) {
    case 'OX':
      // TypeScript knows this is OXQuestion
      return `True/False: ${question.answer}`;
      
    case 'SHORT':
      // TypeScript knows this is ShortQuestion  
      return `Short: ${question.synonyms?.join(', ') || 'No synonyms'}`;
      
    case 'ESSAY':
    case 'KEYWORD':
      // TypeScript knows these have keywords
      return `Keywords: ${question.keywords.join(', ')}`;
      
    default:
      // ✅ TypeScript ensures all cases handled
      const _exhaustive: never = question;
      return 'Unknown type';
  }
}
```

### 3. **Type-Safe Session Management**

```typescript
class TypeSafeStudySession {
  async startSession(config: SessionConfig): Promise<StudySession> {
    // Type-safe configuration
    const questions = await this.getQuestionsForSession(config);
    return {
      id: generateSessionId(),
      config,
      questions,
      currentIndex: 0,
      results: [],
      startTime: new Date(),
      isActive: true,
      stats: this.initializeStats(questions.length)
    };
  }
  
  async submitAnswer(userAnswer: string): Promise<GradingResult | null> {
    if (!this.session) return null;
    
    const question = this.session.questions[this.session.currentIndex];
    return await gradeAnswer(question, userAnswer); // Fully type-safe
  }
}
```

## Migration Benefits

### 🔒 **Type Safety**
- **Compile-time Error Detection** - Catch bugs before runtime
- **IntelliSense Support** - Rich autocomplete and documentation
- **Refactoring Safety** - Rename and restructure with confidence

### 🧩 **Better API Design**
- **Clear Interfaces** - Explicit contracts between modules
- **Exhaustive Checking** - Union types ensure all cases handled
- **Optional vs Required** - Clear distinction in type definitions

### 📚 **Self-Documenting Code**
- **Type Annotations** - Types serve as inline documentation
- **Usage Examples** - TypeScript examples show correct usage
- **IDE Integration** - Hover for type information and documentation

## Integration Strategy

### Phase 1: Core Models (✅ Complete)
- [x] Define `Question`, `UserPerformance`, `Explanation` interfaces
- [x] Create type-safe question variants (`OXQuestion`, etc.)
- [x] Add function signatures for core operations

### Phase 2: Gradual Migration (Next)
- [ ] Convert database module to TypeScript
- [ ] Migrate grading functions with type safety
- [ ] Update spaced repetition algorithm

### Phase 3: Full Migration
- [ ] Convert all modules to TypeScript
- [ ] Add runtime type validation with libraries like Zod
- [ ] Implement generic type guards and utilities

### Phase 4: Advanced Features
- [ ] Generic plugin system with TypeScript
- [ ] Type-safe configuration management
- [ ] Advanced inference and conditional types

## Best Practices

### 1. **Use Union Types for Exhaustive Checking**
```typescript
// ✅ Good - TypeScript ensures all types handled
function processQuestion(question: TypedQuestion) {
  switch (question.type) {
    case 'OX': return handleOX(question);
    case 'SHORT': return handleShort(question);  
    case 'ESSAY': return handleEssay(question);
    case 'KEYWORD': return handleKeyword(question);
    default:
      const _exhaustive: never = question; // Compile error if case missed
  }
}
```

### 2. **Leverage Type Guards**
```typescript
// ✅ Type guards for runtime type checking
function isOXQuestion(question: Question): question is OXQuestion {
  return question.type === 'OX';
}

if (isOXQuestion(question)) {
  // TypeScript knows this is OXQuestion
  console.log(question.answer); // No type errors
}
```

### 3. **Use Generic Functions for Reusability**
```typescript
// ✅ Generic function for type-safe operations
function createTypedQuestion<T extends QuestionType>(
  type: T,
  data: QuestionCreationData<T>
): TypedQuestion {
  return { ...data, type } as TypedQuestion;
}
```

### 4. **Prefer Interfaces Over Types for Extensibility**
```typescript
// ✅ Interface - can be extended
interface BaseQuestion {
  id: number;
  prompt: string;
}

// ✅ Can extend interface
interface ExtendedQuestion extends BaseQuestion {
  category: string;
}
```

## Development Tools

### Recommended VS Code Extensions
- **TypeScript Importer** - Auto-import TypeScript modules
- **TypeScript Hero** - Additional TypeScript tooling
- **Error Lens** - Inline error display
- **Auto Import - ES6, TS, JSX, TSX** - Smart imports

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Future Considerations

- **Runtime Type Validation** with Zod or similar
- **JSON Schema Generation** for API documentation  
- **GraphQL Schema Integration** if needed
- **Automated Testing** with type-safe mocks
- **Bundle Size Optimization** with TypeScript compilation