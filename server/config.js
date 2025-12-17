/**
 * Server Configuration and Feature Flags
 * 
 * Controls which features are enabled/disabled on the server.
 */

// Feature flags
const ENABLE_SINGLE_PLAYER_MODE = process.env.ENABLE_SINGLE_PLAYER_MODE === 'true' || false;
const ENABLE_NPC = process.env.ENABLE_NPC === 'true' || false;

// Server configuration
const PORT = process.env.PORT || 3000;
const WS_PATH = '/';

module.exports = {
  ENABLE_SINGLE_PLAYER_MODE,
  ENABLE_NPC,
  PORT,
  WS_PATH,
};





