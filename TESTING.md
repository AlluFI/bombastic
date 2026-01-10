# Testing Suite Documentation

This document describes the testing suite for the Bomberman Multiplayer game.

## Test Structure

Tests are located in `server/__tests__/` directory and use Jest as the testing framework.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run NPC-specific tests
npm run test:npc
```

## Test Files

### `validation.test.js`
Tests for input validation and sanitization:
- Player name sanitization (length, dangerous characters)
- Chat message sanitization (XSS prevention)
- Coordinate validation
- Room code validation
- Movement data validation
- Bomb placement validation
- Power-up pickup validation

### `rateLimiter.test.js`
Tests for rate limiting functionality:
- Rate limit enforcement
- Time window expiration
- Separate tracking for different actions
- Separate tracking for different sockets
- Cleanup functionality

### `errorHandler.test.js`
Tests for error handling utilities:
- Error object creation
- Error emission to sockets
- Room validation
- Player validation

### `gameLogic.test.js`
Tests for core game mechanics:
- Board generation (walls, spawn zones, blocks)
- Explosion calculations
- Game end detection (winner, draw, continuation)

### `constants.test.js`
Tests to ensure all constants are properly defined:
- Player configuration constants
- Bomb configuration constants
- Grid configuration constants
- Rate limiting configuration

### `room.test.js`
Tests for room management:
- Room creation
- Player name uniqueness
- Room capacity limits

## Test Coverage Goals

- **Unit Tests**: Test individual functions in isolation
- **Integration Tests**: Test interactions between modules
- **Edge Cases**: Test boundary conditions and error cases
- **Security Tests**: Test input validation and sanitization

## Writing New Tests

When adding new features, create corresponding test files:

1. Create test file in `server/__tests__/`
2. Import the module to test
3. Write descriptive test cases
4. Use Jest matchers (`expect`, `toBe`, `toEqual`, etc.)
5. Mock external dependencies when needed

Example:
```javascript
const { myFunction } = require('../myModule');

describe('My Module', () => {
  test('should do something', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

## Mocking

For Socket.io and other external dependencies, use Jest mocks:

```javascript
const mockSocket = {
  id: 'test-socket',
  emit: jest.fn(),
  join: jest.fn(),
};
```

## Continuous Integration

Tests should be run automatically in CI/CD pipelines to ensure code quality.

## Coverage

Aim for high test coverage, especially for:
- Security-critical functions (validation, sanitization)
- Core game logic (explosions, game end)
- Error handling

Run `npm run test:coverage` to see coverage reports.
