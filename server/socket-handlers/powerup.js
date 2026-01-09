const {validateRoom, validatePlayer, emitError} = require('../errorHandler.js')
const {isRateLimited} = require('../rateLimiter.js')
const {validatePowerupPickup} = require('../validation.js')
const CONSTANTS = require('../constants.js')

module.exports = function powerupHandlers(socket, io, rooms) {
    // Handle power-up pickup
  socket.on('powerup:pickup', (data) => {
    // Rate limiting
    if (isRateLimited(socket, 'POWERUP_PICKUP')) {
      return
    }
    
    // Validate input
    if (!validatePowerupPickup(data)) {
      emitError(socket, 'Invalid power-up pickup data', 'INVALID_POWERUP_DATA')
      return
    }
    
    // Validate room and player
    const room = validateRoom(socket, socket.roomCode, rooms)
    if (!room) return
    
    const player = validatePlayer(socket, room)
    if (!player) return
    
    // Validate that the pickup is for the correct player
    if (data.playerId !== socket.id) {
      emitError(socket, 'Cannot pick up power-up for another player', 'INVALID_PLAYER')
      return
    }
    
    // Find and remove power-up from game state
    if (!room.gameState.powerups || room.gameState.powerups.length === 0) {
      emitError(socket, 'No power-ups available', 'NO_POWERUPS')
      return
    }
    
    const powerupIndex = room.gameState.powerups.findIndex(p => p.id === data.powerupId)
    if (powerupIndex === -1) {
      emitError(socket, 'Power-up not found', 'POWERUP_NOT_FOUND')
      return
    }
    
    const powerup = room.gameState.powerups[powerupIndex]
    
    // Verify power-up is at the correct position
    if (powerup.x !== data.x || powerup.y !== data.y) {
      emitError(socket, 'Power-up position mismatch', 'POWERUP_POSITION_MISMATCH')
      return
    }
    
    room.gameState.powerups.splice(powerupIndex, 1)
    
    // Update player stats
    if (!player.bombRange) {
      player.bombRange = CONSTANTS.DEFAULT_BOMB_RANGE
    }
    
    if (powerup.type === 'bomb_range') {
      player.bombRange += 1
      console.log(`Player ${player.name} picked up bomb range power-up! New range: ${player.bombRange}`)
    }
    
    // Broadcast power-up pickup to all clients in the room (including sender for sync)
    io.to(socket.roomCode).emit('powerup:picked', {
      powerupId: data.powerupId,
      playerId: data.playerId,
      x: data.x,
      y: data.y,
      type: powerup.type
    })
  })

}