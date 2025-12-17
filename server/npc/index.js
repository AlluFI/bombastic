/**
 * NPC Module Entry Point
 * 
 * Exports all NPC-related classes and utilities.
 * 
 * Feature Flag: This entire module should be disabled for first review.
 * To disable: Comment out NPC imports in server/index.js or use environment variable.
 */

const NPC = require('./NPC');
const { DifficultyProfiles, getDifficultyProfile, isValidDifficulty } = require('./DifficultyProfiles');
const BehaviorStrategies = require('./BehaviorStrategies');
const Pathfinder = require('./utils/Pathfinder');
const DangerDetector = require('./utils/DangerDetector');
const ItemEvaluator = require('./utils/ItemEvaluator');

module.exports = {
  NPC,
  DifficultyProfiles,
  getDifficultyProfile,
  isValidDifficulty,
  BehaviorStrategies,
  Pathfinder,
  DangerDetector,
  ItemEvaluator,
};

