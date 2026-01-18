/**
 * Tests for delta-updates.js
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { applyDeltaUpdate, resetCachedGameState, getCachedGameState } from '../delta-updates.js'

describe('Delta Updates', () => {
  beforeEach(() => {
    resetCachedGameState()
  })

  describe('applyDeltaUpdate', () => {
    it('should handle full state update', () => {
      const fullState = {
        full: true,
        players: [{ id: '1', name: 'Player1', x: 1, y: 1 }],
        bombs: [],
        powerups: [],
        board: [[0, 0], [0, 0]],
        gameMode: 'multiplayer'
      }

      const result = applyDeltaUpdate(fullState)
      expect(result.players).toHaveLength(1)
      expect(result.players[0].id).toBe('1')
      expect(result.gameMode).toBe('multiplayer')
    })

    it('should apply player additions', () => {
      // First, set initial state
      applyDeltaUpdate({ full: true, players: [], bombs: [], powerups: [] })

      const delta = {
        full: false,
        players: [{ id: '1', name: 'Player1', x: 1, y: 1, _action: 'add' }]
      }

      const result = applyDeltaUpdate(delta)
      expect(result.players).toHaveLength(1)
      expect(result.players[0].id).toBe('1')
    })

    it('should apply player updates', () => {
      // Set initial state
      applyDeltaUpdate({
        full: true,
        players: [{ id: '1', name: 'Player1', x: 1, y: 1 }],
        bombs: [],
        powerups: []
      })

      const delta = {
        full: false,
        players: [{ id: '1', name: 'Player1', x: 2, y: 2, _action: 'update' }]
      }

      const result = applyDeltaUpdate(delta)
      expect(result.players[0].x).toBe(2)
      expect(result.players[0].y).toBe(2)
    })

    it('should apply player removals', () => {
      // Set initial state
      applyDeltaUpdate({
        full: true,
        players: [
          { id: '1', name: 'Player1', x: 1, y: 1 },
          { id: '2', name: 'Player2', x: 2, y: 2 }
        ],
        bombs: [],
        powerups: []
      })

      const delta = {
        full: false,
        players: [{ id: '1', _action: 'remove' }]
      }

      const result = applyDeltaUpdate(delta)
      expect(result.players).toHaveLength(1)
      expect(result.players[0].id).toBe('2')
    })

    it('should apply bomb additions', () => {
      applyDeltaUpdate({ full: true, players: [], bombs: [], powerups: [] })

      const delta = {
        full: false,
        bombs: {
          added: [{ id: 'bomb1', playerId: '1', x: 5, y: 5, range: 2 }],
          removed: []
        }
      }

      const result = applyDeltaUpdate(delta)
      expect(result.bombs).toHaveLength(1)
      expect(result.bombs[0].id).toBe('bomb1')
    })

    it('should apply bomb removals', () => {
      applyDeltaUpdate({
        full: true,
        players: [],
        bombs: [
          { id: 'bomb1', playerId: '1', x: 5, y: 5 },
          { id: 'bomb2', playerId: '2', x: 6, y: 6 }
        ],
        powerups: []
      })

      const delta = {
        full: false,
        bombs: {
          added: [],
          removed: ['bomb1']
        }
      }

      const result = applyDeltaUpdate(delta)
      expect(result.bombs).toHaveLength(1)
      expect(result.bombs[0].id).toBe('bomb2')
    })

    it('should apply powerup additions', () => {
      applyDeltaUpdate({ full: true, players: [], bombs: [], powerups: [] })

      const delta = {
        full: false,
        powerups: {
          added: [{ id: 'powerup1', type: 'bomb_range', x: 3, y: 3 }],
          removed: []
        }
      }

      const result = applyDeltaUpdate(delta)
      expect(result.powerups).toHaveLength(1)
      expect(result.powerups[0].id).toBe('powerup1')
    })

    it('should apply board tile changes', () => {
      applyDeltaUpdate({
        full: true,
        players: [],
        bombs: [],
        powerups: [],
        board: [[0, 0], [0, 0]]
      })

      const delta = {
        full: false,
        board: [{ x: 1, y: 1, value: 1 }]
      }

      const result = applyDeltaUpdate(delta)
      expect(result.board[1][1]).toBe(1)
    })
  })

  describe('resetCachedGameState', () => {
    it('should reset cached state', () => {
      applyDeltaUpdate({
        full: true,
        players: [{ id: '1', name: 'Player1' }],
        bombs: [],
        powerups: []
      })

      expect(getCachedGameState()).not.toBeNull()
      resetCachedGameState()
      expect(getCachedGameState()).toBeNull()
    })
  })
})
