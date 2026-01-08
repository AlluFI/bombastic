const { syncRoomGameState,  checkGameEnd} = require('../utils.js')


module.exports = function playerHandlers(io, socket, rooms) {

    //=========================
    // Handle player movement
    //=========================
  socket.on('player:move', (moveData) => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (!player) return

    // Validate movement: check if target position is walkable and not blocked by a bomb
    const newX = moveData.x
    const newY = moveData.y
    
    // Check bounds
    if (!room.gameState.board || 
        newX < 0 || newX >= room.gameState.board.length ||
        newY < 0 || newY >= (room.gameState.board[0]?.length || 0)) {
      return // Invalid position, ignore movement
    }
    
    // Check if tile is walkable (0 = walkable, 1 = block, 2 = wall)
    if (room.gameState.board[newX][newY] !== 0) {
      return // Blocked by wall or block, ignore movement
    }
    
    // Check if there's a bomb at the target position
    if (room.gameState.bombs && room.gameState.bombs.length > 0) {
      const hasBomb = room.gameState.bombs.some(bomb => bomb.x === newX && bomb.y === newY)
      if (hasBomb) {
        return // Blocked by bomb, ignore movement
      }
    }
    
    // Sync game state BEFORE validation to ensure we have current player positions
    syncRoomGameState(room)
    
    // Check if there's another player or NPC at the target position
    if (room.gameState.players && room.gameState.players.length > 0) {
      const hasPlayer = room.gameState.players.some(p => 
        p.alive && p.id !== socket.id && p.x === newX && p.y === newY
      )
      if (hasPlayer) {
        return // Blocked by another player/NPC, ignore movement
      }
    }

    player.x = newX
    player.y = newY

    // Sync game state after player moves to update gameState.players
    syncRoomGameState(room)

    // Broadcast movement to players in the same room only
    socket.to(socket.roomCode).emit('player:moved', {
      id: socket.id,
      x: moveData.x,
      y: moveData.y
    })
  })
    
    //=========================
    // Handle player damage
    //=========================
    socket.on('player:damage', (data) => {
        const room = rooms.get(socket.roomCode)
        if (!room) return
        
        const player = room.players.get(data.playerId)
        if (!player) return
        
        // Update player lives on server
        player.lives = data.lives
        player.alive = !data.died
        
        console.log(`${player.name} took damage. Lives: ${player.lives}, Alive: ${player.alive}`)
        
        // Sync game state
        syncRoomGameState(room)
        
        // Broadcast damage to all players in room
        io.to(socket.roomCode).emit('player:damaged', {
            playerId: data.playerId,
            lives: data.lives,
            died: data.died
        })
        
        // Check if game should end
        const gameEndResult = checkGameEnd(room.gameState)
        if (gameEndResult) {
            room.gameState.isRunning = false
            io.to(socket.roomCode).emit('game:end', {
                winner: gameEndResult.winner,
                isDraw: gameEndResult.isDraw,
                players: gameEndResult.allPlayers
            })
        }
    })

}