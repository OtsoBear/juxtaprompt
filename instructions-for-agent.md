# Development Guidelines for Juxtaprompt

## Core TypeScript & Code Quality Principles

### 1. Strict Type Safety and Avoid `any`
- Enable `"strict": true` in tsconfig
- Use precise types, unions, generics
- Avoid `any` unless absolutely necessary

### 2. Single Responsibility Principle (SRP)
- Each module, class, or function should have one responsibility
- One reason to change per component
- Keep code modular and maintainable

### 3. Separation of Concerns
- Organize code so different concerns live in separate modules/folders
- UI, logic, and data access should be separated
- Improves readability and testability

### 4. Meaningful Naming and Consistency
- Use clear, descriptive names for files, variables, functions, and types
- Follow consistent naming conventions (camelCase, PascalCase)

### 5. Immutability and Pure Functions
- Favor immutable data structures
- Write pure functions with no side effects
- Reduces bugs and makes reasoning about code easier

### 6. Explicit Function Return Types
- Always declare return types explicitly
- Improves code clarity and catches errors early

### 7. Avoid Deep Nesting and Use Guard Clauses
- Flatten logic by returning early
- Avoid deep nested if statements
- Better readability

### 8. Modularity and Small Reusable Components
- Split code into small, focused modules and components
- Supports reuse and easier testing

### 9. Use TypeScript Utility Types
- Leverage built-in utility types: `Partial`, `Readonly`, `Record`
- Use mapped types for safer and concise typings

### 10. Dependency Inversion Principle
- Depend on abstractions (interfaces/types) rather than concrete implementations
- Reduces coupling and improves flexibility

### 11. Avoid Circular Dependencies
- Structure imports and modules to prevent circular references
- Simplifies builds and reduces bugs

### 12. Consistent Formatting and Linting
- Use ESLint with TypeScript plugins
- Use Prettier for consistent style
- Prevent common errors

### 13. Comprehensive JSDoc and Comments
- Document public APIs, complex logic, and types
- Use JSDoc for clear intent communication

### 14. DRY (Don't Repeat Yourself)
- Avoid duplicating code
- Abstract repeated logic into functions, hooks, or utility modules

### 15. Write Testable Code and Cover with Unit Tests
- Design for testability (pure functions, dependency injection)
- Write well-typed unit tests using Jest/Vitest

## Folder Structure Guidelines
- Organize files by feature or type (`/components`, `/services`, `/utils`)
- Use `index.ts` barrel files for cleaner imports
- Re-export modules through barrel files