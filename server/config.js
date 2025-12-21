/**
 * Server Configuration and Feature Flags
 * 
 * Controls which features are enabled/disabled on the server.
 */

// Feature flags
// Default to true for development. Set to false via environment variables to disable.
const ENABLE_SINGLE_PLAYER_MODE = process.env.ENABLE_SINGLE_PLAYER_MODE !== 'false';
const ENABLE_NPC = process.env.ENABLE_NPC !== 'false';

// Server configuration
const PORT = process.env.PORT || 3000;
const WS_PATH = '/';

module.exports = {
  ENABLE_SINGLE_PLAYER_MODE,
  ENABLE_NPC,
  PORT,
  WS_PATH,
};





