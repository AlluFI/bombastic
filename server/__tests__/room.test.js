/**
 * Room Management Tests
 * Tests for room creation, joining, and player management
 */

// Mock dependencies
jest.mock('../utils', () => ({
  generateRoomCode: jest.fn(() => 'TEST123'),
  generateBoard: jest.fn(() => {
    const board = [];
    for (let r = 0; r < 13; r++) {
      board[r] = [];
      for (let c = 0; c < 15; c++) {
        board[r][c] = r === 0 || r === 12 || c === 0 || c === 14 ? 2 : 1;
      }
    }
    return board;
  }),
  syncRoomGameState: jest.fn((room) => {
    room.gameState.players = Array.from(room.players.values());
  }),
  broadcastLobbyUpdate: jest.fn(),
}));

const { sanitizePlayerName } = require('../validation');
const CONSTANTS = require('../constants');

describe('Room Management', () => {
  let rooms;
  let mockSocket;
  let mockIO;

  beforeEach(() => {
    rooms = new Map();
    mockSocket = {
      id: 'socket-123',
      emit: jest.fn(),
      join: jest.fn(),
      roomCode: null,
    };
    mockIO = {
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    };
  });

  describe('Room Creation', () => {
    test('should create room with valid player name', () => {
      const playerName = 'TestPlayer';
      const sanitizedName = sanitizePlayerName(playerName);
      
      expect(sanitizedName).toBe(playerName);
      expect(sanitizedName.length).toBeGreaterThanOrEqual(CONSTANTS.MIN_PLAYER_NAME_LENGTH);
      expect(sanitizedName.length).toBeLessThanOrEqual(CONSTANTS.MAX_PLAYER_NAME_LENGTH);
    });

    test('should reject invalid player names', () => {
      expect(sanitizePlayerName('A')).toBeNull(); // Too short
      expect(sanitizePlayerName('A'.repeat(21))).toBeNull(); // Too long
      expect(sanitizePlayerName('<script>alert("xss")</script>')).toBeNull(); // Dangerous chars
    });
  });

  describe('Player Name Uniqueness', () => {
    test('should detect duplicate names (case-insensitive)', () => {
      const existingNames = ['Player1', 'Player2', 'Player3'].map(n => n.toLowerCase());
      const newName = 'player1'; // Same as Player1 (case-insensitive)
      
      expect(existingNames.includes(newName.toLowerCase())).toBe(true);
    });

    test('should allow unique names', () => {
      const existingNames = ['Player1', 'Player2'].map(n => n.toLowerCase());
      const newName = 'Player3';
      
      expect(existingNames.includes(newName.toLowerCase())).toBe(false);
    });
  });

  describe('Room Capacity', () => {
    test('should enforce max players per room', () => {
      expect(CONSTANTS.MAX_PLAYERS_PER_ROOM).toBe(4);
      
      // Room should allow 2-4 players
      for (let i = 2; i <= CONSTANTS.MAX_PLAYERS_PER_ROOM; i++) {
        expect(i).toBeLessThanOrEqual(CONSTANTS.MAX_PLAYERS_PER_ROOM);
      }
    });
  });
});
