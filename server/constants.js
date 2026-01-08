/**
 * Game Configuration Constants
 * 
 * Centralized configuration for game mechanics and limits.
 * This makes it easy to adjust game balance and prevents magic numbers.
 */

module.exports = {
  // Player Configuration
  DEFAULT_LIVES: 3,
  DEFAULT_BOMB_RANGE: 2,
  MAX_PLAYERS_PER_ROOM: 4,
  MIN_PLAYER_NAME_LENGTH: 2,
  MAX_PLAYER_NAME_LENGTH: 20,
  
  // Bomb Configuration
  BOMB_TIMER_MS: 3000,
  BOMB_EXPLOSION_DURATION_MS: 500,
  
  // Player Mechanics
  INVINCIBILITY_DURATION_MS: 2000,
  MOVEMENT_COOLDOWN_MS: 150,
  
  // Grid Configuration
  GRID_ROWS: 13,
  GRID_COLS: 15,
  
  // Power-up Configuration
  POWERUP_SPAWN_CHANCE: 0.3, // 30% chance per destroyed block
  MAX_POWERUPS_MULTIPLIER: 4, // Max powerups = players × 4
  
  // Rate Limiting
  RATE_LIMITS: {
    MOVE: { max: 20, window: 1000 },      // 20 moves per second
    BOMB: { max: 2, window: 3000 },       // 2 bombs per 3 seconds
    CHAT: { max: 5, window: 1000 },        // 5 messages per second
    POWERUP_PICKUP: { max: 10, window: 1000 }, // 10 pickups per second
  },
  
  // Room Configuration
  ROOM_CLEANUP_DELAY_MS: 5 * 60 * 1000, // 5 minutes
  ROOM_CODE_LENGTH: 6,
  
  // Chat Configuration
  MAX_CHAT_MESSAGE_LENGTH: 200,
  MIN_CHAT_MESSAGE_LENGTH: 1,
};
