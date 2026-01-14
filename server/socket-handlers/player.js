const { syncRoomGameState, checkGameEnd } = require('../utils.js')
const { validateRoom, validatePlayer, emitError } = require('../errorHandler.js')
const { isRateLimited } = require('../rateLimiter.js')
const { validateMovement } = require('../validation.js')
const { logPlayerAction } = require('../logger')

module.exports = function playerHandlers(io, socket, rooms) {

    //=========================
    // Handle player movement
    //=========================
  socket.on('player:move', (moveData) => {
    // Rate limiting
    if (isRateLimited(socket, 'MOVE')) {
      return
    }
    
    // Validate input
    if (!validateMovement(moveData)) {
      emitError(socket, 'Invalid movement data', 'INVALID_MOVEMENT')
      return
    }
    
    // Validate room and player
    const room = validateRoom(socket, socket.roomCode, rooms)
    if (!room) return
    
    const player = validatePlayer(socket, room)
    if (!player) return

    // Validate movement: check if target position is walkable and not blocked by a bomb
    const newX = moveData.x
    const newY = moveData.y
    
    // Check bounds (double-check with board)
    if (!room.gameState.board || 
        newX < 0 || newX >= room.gameState.board.length ||
        newY < 0 || newY >= (room.gameState.board[0]?.length || 0)) {
      emitError(socket, 'Invalid position: out of bounds', 'INVALID_POSITION')
      return
    }
    
    // Sync game state FIRST to ensure we have current player positions, bombs, and NPCs
    syncRoomGameState(room)
    
    const emitAuthoritativePosition = () => {
      socket.emit('player:moved', {
        id: socket.id,
        x: player.x,
        y: player.y
      })
    }

    // Check if tile is walkable (0 = walkable, 1 = block, 2 = wall)
    if (room.gameState.board[newX][newY] !== 0) {
      emitAuthoritativePosition()
      return
    }
    
    // Check if there's a bomb at the target position
    if (room.gameState.bombs && room.gameState.bombs.length > 0) {
      const hasBomb = room.gameState.bombs.some(bomb => bomb.x === newX && bomb.y === newY)
      if (hasBomb) {
        emitAuthoritativePosition()
        return
      }
    }
    
    // Check if there's another player or NPC at the target position
    // Check gameState.players first (includes synced NPCs)
    if (room.gameState.players && room.gameState.players.length > 0) {
      const hasPlayer = room.gameState.players.some(p => 
        p.id !== socket.id && 
        p.alive !== false && // Explicitly check for false (dead players have alive === false)
        p.x === newX && 
        p.y === newY &&
        p.x >= 0 && p.y >= 0 // Also exclude off-board positions (-1, -1)
      )
      if (hasPlayer) {
        emitAuthoritativePosition()
        return
      }
    }
    
    // Also check NPCs directly to catch any that might not be synced yet
    if (room.npcs) {
      for (const [npcId, npc] of room.npcs.entries()) {
        if (npc.alive && 
            npc.position.x === newX && 
            npc.position.y === newY &&
            npc.position.x >= 0 && npc.position.y >= 0) { // Exclude off-board positions
          emitAuthoritativePosition()
          return
        }
      }
    }
    
    // Also check human players directly as defensive check
    if (room.players) {
      for (const [playerId, player] of room.players.entries()) {
        if (playerId !== socket.id && 
            player.alive !== false && // Explicitly check for false
            player.x === newX && 
            player.y === newY &&
            player.x >= 0 && player.y >= 0) { // Exclude off-board positions
          emitAuthoritativePosition()
          return
        }
      }
    }

    // Movement allowed - update server position
    player.x = newX
    player.y = newY

    // Sync game state after player moves to update gameState.players
    syncRoomGameState(room)

    // Broadcast movement to all players (including mover) using authoritative position
    io.to(socket.roomCode).emit('player:moved', {
      id: socket.id,
      x: player.x,
      y: player.y
    })
  })
    
    //=========================
    // Handle player damage
    //=========================
    socket.on('player:damage', (data) => {
        // Validate input
        if (!data || typeof data !== 'object' || 
            typeof data.playerId !== 'string' ||
            typeof data.lives !== 'number' ||
            typeof data.died !== 'boolean') {
          emitError(socket, 'Invalid damage data', 'INVALID_DAMAGE_DATA')
          return
        }
        
        // Validate room and player
        const room = validateRoom(socket, socket.roomCode, rooms)
        if (!room) return
        
        const player = validatePlayer(socket, room)
        if (!player) return
        
        // Validate that the damage is for the correct player
        if (data.playerId !== socket.id) {
          emitError(socket, 'Cannot report damage for another player', 'INVALID_PLAYER')
          return
        }
        
        // Validate lives value
        if (data.lives < 0 || data.lives > 3) {
          emitError(socket, 'Invalid lives value', 'INVALID_LIVES')
          return
        }
        
        // Update player lives on server
        player.lives = data.lives
        player.alive = !data.died
        
        // logPlayerAction(player.id, player.name, 'took damage', {
        //   roomId: socket.roomCode,
        //   lives: player.lives,
        //   alive: player.alive
        // })
        
        // Sync game state
        syncRoomGameState(room)
        
        // Broadcast damage to all players in room
        io.to(socket.roomCode).emit('player:damaged', {
            playerId: data.playerId,
            lives: data.lives,
            died: data.died
        })
        
        // Check if game should end
        const gameEndResult = checkGameEnd(room.gameState, room)
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