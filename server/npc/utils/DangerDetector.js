/**
 * Danger Detection Utilities for NPCs
 * 
 * Calculates danger zones from active bombs and explosions.
 * Helps NPCs avoid getting caught in explosions.
 * 
 * Feature Flag: This module should be disabled for first review.
 */

class DangerDetector {
  /**
   * Calculates all danger zones from active bombs
   * @param {Array<Object>} bombs - Array of bomb objects { x, y, range, timer }
   * @param {Array<Array<number>>} grid - 2D grid representing the map
   * @param {number} maxRows - Maximum rows in grid
   * @param {number} maxCols - Maximum columns in grid
   * @returns {Set<string>} Set of danger zone keys (format: "x,y")
   */
  static calculateDangerZones(bombs, grid, maxRows, maxCols) {
    const dangerZones = new Set();

    if (!bombs || bombs.length === 0) {
      return dangerZones;
    }

    bombs.forEach(bomb => {
      // Add bomb position itself
      const bombKey = `${bomb.x},${bomb.y}`;
      dangerZones.add(bombKey);

      // Calculate explosion range in all 4 directions
      // Coordinate system: x = row (vertical), y = col (horizontal)
      const directions = [
        { x: -1, y: 0 }, // UP (decrease row)
        { x: 1, y: 0 },  // DOWN (increase row)
        { x: 0, y: -1 }, // LEFT (decrease col)
        { x: 0, y: 1 },  // RIGHT (increase col)
      ];

      const range = bomb.range || 1;

      directions.forEach(dir => {
        for (let i = 1; i <= range; i++) {
          const checkX = bomb.x + dir.x * i;
          const checkY = bomb.y + dir.y * i;

          // Stop if out of bounds
          // Coordinate system: x = row (0 to maxRows-1), y = col (0 to maxCols-1)
          if (checkX < 0 || checkX >= maxRows || checkY < 0 || checkY >= maxCols) {
            break;
          }

          // Add to danger zones
          const key = `${checkX},${checkY}`;
          dangerZones.add(key);

          // Stop if hit an indestructible wall (explosion doesn't pass through)
          // Grid is structured as grid[row][col], and x=row, y=col
          if (grid[checkX] && grid[checkX][checkY] === 2) { // 2 = indestructible wall
            break;
          }

          // Stop if hit a destructible block (explosion stops at block)
          // Grid is structured as grid[row][col], and x=row, y=col
          if (grid[checkX] && grid[checkX][checkY] === 1) { // 1 = destructible block
            break;
          }
        }
      });
    });

    return dangerZones;
  }

  /**
   * Checks if a position is in a danger zone
   * @param {Object} pos - { x, y } position to check
   * @param {Set<string>} dangerZones - Set of danger zone keys
   * @returns {boolean}
   */
  static isInDanger(pos, dangerZones) {
    const key = `${pos.x},${pos.y}`;
    return dangerZones.has(key);
  }

  /**
   * Finds the nearest safe position from a dangerous position
   * @param {Object} start - { x, y } starting position (currently dangerous)
   * @param {Set<string>} dangerZones - Set of danger zone keys
   * @param {Array<Array<number>>} grid - 2D grid representing the map
   * @param {number} maxRows - Maximum rows in grid
   * @param {number} maxCols - Maximum columns in grid
   * @returns {Object|null} Nearest safe position { x, y } or null if none found
   */
  static findNearestSafePosition(start, dangerZones, grid, maxRows, maxCols) {
    // BFS to find nearest safe position
    const queue = [{ x: start.x, y: start.y }];
    const visited = new Set();
    visited.add(`${start.x},${start.y}`);

    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      // Check if this position is safe and walkable
      const key = `${current.x},${current.y}`;
      if (!dangerZones.has(key) && 
          this._isValidPosition(current, maxRows, maxCols) &&
          grid[current.y] && grid[current.y][current.x] === 0) {
        return current;
      }

      // Explore neighbors
      for (const dir of directions) {
        const nextX = current.x + dir.x;
        const nextY = current.y + dir.y;
        const nextKey = `${nextX},${nextY}`;

        if (visited.has(nextKey)) continue;
        if (!this._isValidPosition({ x: nextX, y: nextY }, maxRows, maxCols)) continue;

        visited.add(nextKey);
        queue.push({ x: nextX, y: nextY });
      }
    }

    return null;
  }

  /**
   * Checks if a position is valid (within bounds)
   * @param {Object} pos - { x, y } position
   * @param {number} maxRows - Maximum rows
   * @param {number} maxCols - Maximum columns
   * @returns {boolean}
   */
  static _isValidPosition(pos, maxRows, maxCols) {
    return pos.x >= 0 && pos.x < maxCols && pos.y >= 0 && pos.y < maxRows;
  }

  /**
   * Calculates time until explosion at a position
   * @param {Object} pos - { x, y } position to check
   * @param {Array<Object>} bombs - Array of bomb objects { x, y, range, timer }
   * @returns {number|null} Time until explosion in ms, or null if not in danger
   */
  static getTimeUntilExplosion(pos, bombs) {
    if (!bombs || bombs.length === 0) {
      return null;
    }

    let minTime = Infinity;

    bombs.forEach(bomb => {
      const distance = Math.abs(bomb.x - pos.x) + Math.abs(bomb.y - pos.y);
      const range = bomb.range || 1;

      // Check if position is within explosion range
      if (distance <= range) {
        const timeUntilExplosion = bomb.timer || 3000; // Default 3 seconds
        minTime = Math.min(minTime, timeUntilExplosion);
      }
    });

    return minTime === Infinity ? null : minTime;
  }
}

module.exports = DangerDetector;




