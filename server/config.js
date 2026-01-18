/**
 * Server Configuration and Feature Flags
 * 
 * Controls which features are enabled/disabled on the server.
 */

// Feature flags
// Default to true for development. Set to false via environment variables to disable.
const ENABLE_SINGLE_PLAYER_MODE = process.env.ENABLE_SINGLE_PLAYER_MODE !== 'false';

// Server configuration
const PORT = process.env.PORT || 3000;
const WS_PATH = '/';

// CORS configuration
// In production, specify allowed origins. Use '*' only for development.
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : '*');

module.exports = {
  ENABLE_SINGLE_PLAYER_MODE,
  PORT,
  WS_PATH,
  CORS_ORIGIN,
};





