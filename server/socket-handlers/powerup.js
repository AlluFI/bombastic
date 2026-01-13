const {validateRoom, validatePlayer, emitError} = require('../errorHandler.js')
const {isRateLimited} = require('../rateLimiter.js')
const {validatePowerupPickup} = require('../validation.js')
const CONSTANTS = require('../constants.js')
// const { logPlayerAction } = require('../logger')

module.exports = function powerupHandlers(io, socket, rooms) {
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
    if (!player.maxBombs) {
      player.maxBombs = 1
    }
    
    if (powerup.type === 'bomb_range') {
      player.bombRange += 1
      // logPlayerAction(player.id, player.name, 'picked up bomb range power-up', {
      //   roomId: socket.roomCode,
      //   powerupType: powerup.type,
      //   newRange: player.bombRange,
      //   position: { x: data.x, y: data.y }
      // })
    } else if (powerup.type === 'bomb_count') {
      player.maxBombs += 1
      // logPlayerAction(player.id, player.name, 'picked up bomb count power-up', {
      //   roomId: socket.roomCode,
      //   powerupType: powerup.type,
      //   newMaxBombs: player.maxBombs,
      //   position: { x: data.x, y: data.y }
      // })
    } else if (powerup.type === 'immortal') {
      // Initialize immortal state if not exists
      if (player.immortal === undefined) {
        player.immortal = false
        player.immortalEnd = 0
      }
      
      // Grant 15 seconds of immortality
      const IMMORTAL_DURATION = 15000
      player.immortal = true
      player.immortalEnd = Date.now() + IMMORTAL_DURATION
      
    //   logPlayerAction(player.id, player.name, 'picked up immortal power-up', {
    //     roomId: socket.roomCode,
    //     powerupType: powerup.type,
    //     duration: IMMORTAL_DURATION,
    //     position: { x: data.x, y: data.y }
    //   })
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