/**
 * Error Handler Tests
 * Tests for error handling utilities
 */

const {
  createError,
  emitError,
  validateRoom,
  validatePlayer,
} = require('../errorHandler');

describe('Error Handler', () => {
  describe('createError', () => {
    test('should create error object with message', () => {
      const error = createError('Test error');
      
      expect(error.error).toBe(true);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    test('should create error object with custom code', () => {
      const error = createError('Test error', 'CUSTOM_CODE');
      
      expect(error.error).toBe(true);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('CUSTOM_CODE');
    });
  });

  describe('emitError', () => {
    test('should emit error to socket', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      emitError(mockSocket, 'Test error', 'TEST_ERROR');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: true,
        message: 'Test error',
        code: 'TEST_ERROR',
        timestamp: expect.any(Number),
      });
    });

    test('should handle invalid socket gracefully', () => {
      expect(() => emitError(null, 'Test error')).not.toThrow();
      expect(() => emitError({}, 'Test error')).not.toThrow();
    });
  });

  describe('validateRoom', () => {
    test('should return room if valid', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      const rooms = new Map();
      const room = { id: 'ROOM123', players: new Map() };
      rooms.set('ROOM123', room);
      
      const result = validateRoom(mockSocket, 'ROOM123', rooms);
      
      expect(result).toBe(room);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should emit error and return null if room not found', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      const rooms = new Map();
      const result = validateRoom(mockSocket, 'INVALID', rooms);
      
      expect(result).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND',
      }));
    });

    test('should emit error if room code is missing', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      const rooms = new Map();
      const result = validateRoom(mockSocket, null, rooms);
      
      expect(result).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });

  describe('validatePlayer', () => {
    test('should return player if valid', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      const room = {
        players: new Map([
          ['test-socket', { id: 'test-socket', name: 'Test Player' }]
        ])
      };
      
      const result = validatePlayer(mockSocket, room);
      
      expect(result).toEqual({ id: 'test-socket', name: 'Test Player' });
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should emit error and return null if player not found', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      const room = {
        players: new Map()
      };
      
      const result = validatePlayer(mockSocket, room);
      
      expect(result).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: 'Player not found in room',
        code: 'PLAYER_NOT_FOUND',
      }));
    });

    test('should emit error if room is null', () => {
      const mockSocket = {
        id: 'test-socket',
        emit: jest.fn(),
      };
      
      const result = validatePlayer(mockSocket, null);
      
      expect(result).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });
});
