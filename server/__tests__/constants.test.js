/**
 * Constants Tests
 * Tests to ensure constants are properly defined
 */

const CONSTANTS = require('../constants');

describe('Constants', () => {
  test('should have all required player configuration constants', () => {
    expect(CONSTANTS.DEFAULT_LIVES).toBeDefined();
    expect(CONSTANTS.DEFAULT_BOMB_RANGE).toBeDefined();
    expect(CONSTANTS.MAX_PLAYERS_PER_ROOM).toBeDefined();
    expect(CONSTANTS.MIN_PLAYER_NAME_LENGTH).toBeDefined();
    expect(CONSTANTS.MAX_PLAYER_NAME_LENGTH).toBeDefined();
  });

  test('should have valid player configuration values', () => {
    expect(CONSTANTS.DEFAULT_LIVES).toBeGreaterThan(0);
    expect(CONSTANTS.DEFAULT_BOMB_RANGE).toBeGreaterThan(0);
    expect(CONSTANTS.MAX_PLAYERS_PER_ROOM).toBeGreaterThanOrEqual(2);
    expect(CONSTANTS.MAX_PLAYERS_PER_ROOM).toBeLessThanOrEqual(4);
    expect(CONSTANTS.MIN_PLAYER_NAME_LENGTH).toBeGreaterThan(0);
    expect(CONSTANTS.MAX_PLAYER_NAME_LENGTH).toBeGreaterThan(CONSTANTS.MIN_PLAYER_NAME_LENGTH);
  });

  test('should have all required bomb configuration constants', () => {
    expect(CONSTANTS.BOMB_TIMER_MS).toBeDefined();
    expect(CONSTANTS.BOMB_EXPLOSION_DURATION_MS).toBeDefined();
  });

  test('should have valid bomb configuration values', () => {
    expect(CONSTANTS.BOMB_TIMER_MS).toBeGreaterThan(0);
    expect(CONSTANTS.BOMB_EXPLOSION_DURATION_MS).toBeGreaterThan(0);
  });

  test('should have all required grid configuration constants', () => {
    expect(CONSTANTS.GRID_ROWS).toBeDefined();
    expect(CONSTANTS.GRID_COLS).toBeDefined();
  });

  test('should have valid grid dimensions', () => {
    expect(CONSTANTS.GRID_ROWS).toBeGreaterThan(0);
    expect(CONSTANTS.GRID_COLS).toBeGreaterThan(0);
  });

  test('should have rate limiting configuration', () => {
    expect(CONSTANTS.RATE_LIMITS).toBeDefined();
    expect(CONSTANTS.RATE_LIMITS.MOVE).toBeDefined();
    expect(CONSTANTS.RATE_LIMITS.BOMB).toBeDefined();
    expect(CONSTANTS.RATE_LIMITS.CHAT).toBeDefined();
  });

  test('should have valid rate limit values', () => {
    expect(CONSTANTS.RATE_LIMITS.MOVE.max).toBeGreaterThan(0);
    expect(CONSTANTS.RATE_LIMITS.MOVE.window).toBeGreaterThan(0);
    expect(CONSTANTS.RATE_LIMITS.BOMB.max).toBeGreaterThan(0);
    expect(CONSTANTS.RATE_LIMITS.BOMB.window).toBeGreaterThan(0);
  });
});
