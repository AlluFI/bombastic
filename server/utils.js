/**
 * Utilities Module (Backward Compatibility Wrapper)
 * 
 * This file maintains backward compatibility for imports like:
 * - require('./utils')
 * - require('./utils.js')
 * 
 * All functionality has been split into modular files in the utils/ directory.
 * See utils/index.js for the main export.
 */

// Re-export everything from the modular utils directory
module.exports = require('./utils/index.js')
