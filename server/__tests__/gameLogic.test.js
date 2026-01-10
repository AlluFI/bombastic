/**
 * Game Logic Tests
 * Tests for core game mechanics (board generation, explosions, game end)
 */

const { generateBoard, calculateExplosionBlocks, checkGameEnd } = require('../utils');
const CONSTANTS = require('../constants');

describe('Game Logic', () => {
  describe('generateBoard', () => {
    test('should generate board with correct dimensions', () => {
      const board = generateBoard();
      
      expect(board.length).toBe(CONSTANTS.GRID_ROWS);
      expect(board[0].length).toBe(CONSTANTS.GRID_COLS);
    });

    test('should have border walls (value 2)', () => {
      const board = generateBoard();
      
      // Check top and bottom borders
      for (let c = 0; c < CONSTANTS.GRID_COLS; c++) {
        expect(board[0][c]).toBe(2);
        expect(board[CONSTANTS.GRID_ROWS - 1][c]).toBe(2);
      }
      
      // Check left and right borders
      for (let r = 0; r < CONSTANTS.GRID_ROWS; r++) {
        expect(board[r][0]).toBe(2);
        expect(board[r][CONSTANTS.GRID_COLS - 1]).toBe(2);
      }
    });

    test('should have checkerboard pattern for internal walls', () => {
      const board = generateBoard();
      
      // Check internal unbreakable blocks (even rows and columns)
      for (let r = 2; r < CONSTANTS.GRID_ROWS - 2; r += 2) {
        for (let c = 2; c < CONSTANTS.GRID_COLS - 2; c += 2) {
          expect(board[r][c]).toBe(2);
        }
      }
    });

    test('should have walkable spawn zones', () => {
      const board = generateBoard();
      
      // Check spawn positions (corners)
      const spawns = [
        [1, 1],
        [1, CONSTANTS.GRID_COLS - 2],
        [CONSTANTS.GRID_ROWS - 2, 1],
        [CONSTANTS.GRID_ROWS - 2, CONSTANTS.GRID_COLS - 2]
      ];
      
      spawns.forEach(([r, c]) => {
        expect(board[r][c]).toBe(0); // Walkable
      });
    });

    test('should have destructible blocks in non-wall positions', () => {
      const board = generateBoard();
      
      // Check some internal positions (not borders, not checkerboard walls, not spawns)
      expect([0, 1, 2]).toContain(board[3][3]); // Should be 0, 1, or 2
      expect([0, 1, 2]).toContain(board[5][7]); // Should be 0, 1, or 2
    });
  });

  describe('calculateExplosionBlocks', () => {
    test('should calculate explosion blocks in cross pattern', () => {
      const board = generateBoard();
      const bomb = { x: 5, y: 5, range: 2 };
      
      const result = calculateExplosionBlocks(bomb, board);
      
      // Should return an array
      expect(Array.isArray(result)).toBe(true);
      // All returned blocks should be destructible (value 1)
      result.forEach(block => {
        expect(board[block.x]).toBeDefined();
        expect(board[block.x][block.y]).toBe(1); // Destructible block
      });
    });

    test('should stop at indestructible walls', () => {
      const board = generateBoard();
      const bomb = { x: 1, y: 1, range: 5 };
      
      const result = calculateExplosionBlocks(bomb, board);
      
      // Should not include indestructible walls (value 2)
      result.forEach(block => {
        expect(board[block.x][block.y]).not.toBe(2);
      });
    });

    test('should respect explosion range', () => {
      const board = generateBoard();
      const bomb = { x: 5, y: 5, range: 1 };
      
      const result = calculateExplosionBlocks(bomb, board);
      
      // Check that all blocks are within range
      result.forEach(block => {
        const distance = Math.abs(block.x - bomb.x) + Math.abs(block.y - bomb.y);
        expect(distance).toBeLessThanOrEqual(bomb.range);
      });
    });
  });

  describe('checkGameEnd', () => {
    test('should detect winner when one player remains', () => {
      const gameState = {
        players: [
          { id: 'player1', name: 'Player 1', alive: true, lives: 2 },
          { id: 'player2', name: 'Player 2', alive: false, lives: 0 },
        ]
      };
      
      const room = {
        eliminationOrder: ['player2']
      };
      
      const result = checkGameEnd(gameState, room);
      
      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.winner.id).toBe('player1');
      expect(result.isDraw).toBe(false);
    });

    test('should detect draw when all players eliminated', () => {
      const gameState = {
        players: [
          { id: 'player1', name: 'Player 1', alive: false, lives: 0 },
          { id: 'player2', name: 'Player 2', alive: false, lives: 0 },
        ]
      };
      
      const room = {
        eliminationOrder: ['player1', 'player2']
      };
      
      const result = checkGameEnd(gameState, room);
      
      expect(result).toBeDefined();
      expect(result.isDraw).toBe(true);
      expect(result.winner).toBeNull();
    });

    test('should return null when game continues', () => {
      const gameState = {
        players: [
          { id: 'player1', name: 'Player 1', alive: true, lives: 2 },
          { id: 'player2', name: 'Player 2', alive: true, lives: 1 },
        ]
      };
      
      const room = {
        eliminationOrder: []
      };
      
      const result = checkGameEnd(gameState, room);
      
      expect(result).toBeNull();
    });

    test('should end game when only one player remains', () => {
      const gameState = {
        players: [
          { id: 'player1', name: 'Player 1', alive: true, lives: 3 },
        ]
      };
      
      const room = {
        eliminationOrder: []
      };
      
      const result = checkGameEnd(gameState, room);
      
      // Game should end when only one player remains (they win)
      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.winner.id).toBe('player1');
      expect(result.isDraw).toBe(false);
    });
  });
});
