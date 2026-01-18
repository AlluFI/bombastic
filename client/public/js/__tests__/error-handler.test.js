/**
 * Tests for error-handler.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSocketErrorMessage } from '../error-handler.js'

// Mock notifications module
vi.mock('../ui/notifications.js', () => ({
  showError: vi.fn()
}))

describe('Error Handler', () => {
  describe('getSocketErrorMessage', () => {
    it('should return user-friendly message for ROOM_NOT_FOUND', () => {
      const error = { code: 'ROOM_NOT_FOUND' }
      const message = getSocketErrorMessage(error)
      expect(message).toBe('Room not found. It may have been closed.')
    })

    it('should return user-friendly message for NAME_TAKEN', () => {
      const error = { code: 'NAME_TAKEN' }
      const message = getSocketErrorMessage(error)
      expect(message).toBe('This name is already taken in this room. Please choose another name.')
    })

    it('should return user-friendly message for RATE_LIMIT_EXCEEDED', () => {
      const error = { code: 'RATE_LIMIT_EXCEEDED' }
      const message = getSocketErrorMessage(error)
      expect(message).toBe('Action too fast. Please slow down.')
    })

    it('should return custom message if provided', () => {
      const error = { code: 'CUSTOM_ERROR', message: 'Custom error message' }
      const message = getSocketErrorMessage(error)
      expect(message).toBe('Custom error message')
    })

    it('should return error code if no mapping exists', () => {
      const error = { code: 'UNKNOWN_ERROR_CODE' }
      const message = getSocketErrorMessage(error)
      expect(message).toBe('UNKNOWN_ERROR_CODE')
    })

    it('should return default message for null/undefined', () => {
      expect(getSocketErrorMessage(null)).toBe('An error occurred')
      expect(getSocketErrorMessage(undefined)).toBe('An error occurred')
    })

    it('should handle error with no code', () => {
      const error = { message: 'Some error' }
      const message = getSocketErrorMessage(error)
      expect(message).toBe('Some error')
    })
  })
})
