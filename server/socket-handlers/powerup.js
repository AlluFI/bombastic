

module.exports = function powerupHandlers(socket, io, rooms) {
    // Handle power-up pickup
  socket.on('powerup:pickup', (data) => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(data.playerId)
    if (!player) return
    
    // Find and remove power-up from game state
    if (room.gameState.powerups) {
      const powerupIndex = room.gameState.powerups.findIndex(p => p.id === data.powerupId)
      if (powerupIndex !== -1) {
        const powerup = room.gameState.powerups[powerupIndex]
        room.gameState.powerups.splice(powerupIndex, 1)
        
        // Update player stats
        if (!player.bombRange) {
          player.bombRange = 2 // Default range
        }
        
        if (powerup.type === 'bomb_range') {
          player.bombRange += 1
          console.log(`Player ${player.name} picked up bomb range power-up! New range: ${player.bombRange}`)
        }
        
        // Broadcast power-up pickup to all clients
        io.to(socket.roomCode).emit('powerup:picked', {
          powerupId: data.powerupId,
          playerId: data.playerId,
          x: data.x,
          y: data.y,
          type: powerup.type
        })
      }
    }
  })

}