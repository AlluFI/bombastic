/**
 * Pathfinding Utilities for NPCs
 * 
 * Provides grid-based pathfinding algorithms (BFS) for NPC navigation.
 * Bomberman maps are small, so BFS is sufficient (A* optional for optimization).
 * 
 * Feature Flag: This module should be disabled for first review.
 */

class Pathfinder {
  /**
   * Finds a path from start to target using BFS (Breadth-First Search)
   * @param {Object} start - { x, y } starting position
   * @param {Object} target - { x, y } target position
   * @param {Array<Array<number>>} grid - 2D grid representing the map (0 = walkable, 1 = wall/block)
   * @param {number} maxRows - Maximum rows in grid
   * @param {number} maxCols - Maximum columns in grid
   * @returns {Array<Object>} Array of { x, y } positions representing the path, or empty array if no path
   */
  static findPath(start, target, grid, maxRows, maxCols) {
    // If start and target are the same, return empty path
    if (start.x === target.x && start.y === target.y) {
      return [];
    }

    // Validate positions
    if (!this._isValidPosition(start, maxRows, maxCols) || 
        !this._isValidPosition(target, maxRows, maxCols)) {
      return [];
    }

    // BFS queue: [ { x, y, path: [...] } ]
    const queue = [{ x: start.x, y: start.y, path: [] }];
    const visited = new Set();
    visited.add(`${start.x},${start.y}`);

    // Directions: UP, DOWN, LEFT, RIGHT
    const directions = [
      { x: 0, y: -1 }, // UP
      { x: 0, y: 1 },  // DOWN
      { x: -1, y: 0 }, // LEFT
      { x: 1, y: 0 },  // RIGHT
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      // Check if we reached the target
      if (current.x === target.x && current.y === target.y) {
        return current.path;
      }

      // Explore neighbors
      for (const dir of directions) {
        const nextX = current.x + dir.x;
        const nextY = current.y + dir.y;
        const key = `${nextX},${nextY}`;

        // Skip if already visited
        if (visited.has(key)) {
          continue;
        }

        // Skip if out of bounds
        if (!this._isValidPosition({ x: nextX, y: nextY }, maxRows, maxCols)) {
          continue;
        }

        // Skip if not walkable (wall or block)
        if (grid[nextY] && grid[nextY][nextX] === 1) {
          continue;
        }

        // Add to queue
        visited.add(key);
        queue.push({
          x: nextX,
          y: nextY,
          path: [...current.path, { x: nextX, y: nextY }],
        });
      }
    }

    // No path found
    return [];
  }

  /**
   * Finds the next direction to move toward a target
   * @param {Object} start - { x, y } starting position
   * @param {Object} target - { x, y } target position
   * @param {Array<Array<number>>} grid - 2D grid representing the map
   * @param {number} maxRows - Maximum rows in grid
   * @param {number} maxCols - Maximum columns in grid
   * @returns {string|null} Direction string ('UP', 'DOWN', 'LEFT', 'RIGHT') or null if no path
   */
  static getNextDirection(start, target, grid, maxRows, maxCols) {
    const path = this.findPath(start, target, grid, maxRows, maxCols);
    
    if (path.length === 0) {
      return null;
    }

    const nextStep = path[0];
    const dx = nextStep.x - start.x;
    const dy = nextStep.y - start.y;

    if (dx === 0 && dy === -1) return 'UP';
    if (dx === 0 && dy === 1) return 'DOWN';
    if (dx === -1 && dy === 0) return 'LEFT';
    if (dx === 1 && dy === 0) return 'RIGHT';

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
   * Calculates Manhattan distance between two points
   * @param {Object} a - { x, y } position
   * @param {Object} b - { x, y } position
   * @returns {number}
   */
  static manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Finds the nearest walkable position to a target (useful when target is blocked)
   * @param {Object} start - { x, y } starting position
   * @param {Object} target - { x, y } target position
   * @param {Array<Array<number>>} grid - 2D grid representing the map
   * @param {number} maxRows - Maximum rows in grid
   * @param {number} maxCols - Maximum columns in grid
   * @returns {Object|null} Nearest walkable position { x, y } or null
   */
  static findNearestWalkable(start, target, grid, maxRows, maxCols) {
    // If target is walkable, return it
    if (this._isValidPosition(target, maxRows, maxCols) && 
        grid[target.y] && grid[target.y][target.x] === 0) {
      return target;
    }

    // BFS to find nearest walkable position
    const queue = [{ x: target.x, y: target.y }];
    const visited = new Set();
    visited.add(`${target.x},${target.y}`);

    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      // Check if this position is walkable
      if (this._isValidPosition(current, maxRows, maxCols) && 
          grid[current.y] && grid[current.y][current.x] === 0) {
        return current;
      }

      // Explore neighbors
      for (const dir of directions) {
        const nextX = current.x + dir.x;
        const nextY = current.y + dir.y;
        const key = `${nextX},${nextY}`;

        if (visited.has(key)) continue;
        if (!this._isValidPosition({ x: nextX, y: nextY }, maxRows, maxCols)) continue;

        visited.add(key);
        queue.push({ x: nextX, y: nextY });
      }
    }

    return null;
  }
}

module.exports = Pathfinder;




