const {validateRoom, validatePlayer, emitError} = require('../errorHandler.js')
const {isRateLimited} = require('../rateLimiter.js')
const {validateBombPlacement, validateCoordinates} = require('../validation.js')
const CONSTANTS = require('../constants.js')
const { logPlayerAction, logGameEvent } = require('../logger')
const metrics = require('../metrics')

module.exports = function bombHandlers(io, socket, rooms) {

     //========================
     // Handle bomb placement
     //========================
    socket.on('bomb:place', (bombData) => {
      // Log ALL bomb placement attempts for debugging
      // logGameEvent('Bomb placement attempt received', {
      //   roomId: socket.roomCode,
      //   playerId: socket.id,
      //   bombId: bombData?.bombId,
      //   position: bombData ? { x: bombData.x, y: bombData.y } : null,
      //   hasBombData: !!bombData
      // });
      
      // Rate limiting
      if (isRateLimited(socket, 'BOMB')) {
        // logGameEvent('Bomb placement rejected - rate limited', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombId: bombData?.bombId,
        //   position: bombData ? { x: bombData.x, y: bombData.y } : null
        // });
        return
      }
      
      // Record action
      metrics.recordAction('BOMB')
      
      // Validate input
      if (!validateBombPlacement(bombData)) {
        // logGameEvent('Bomb placement rejected - invalid data', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombId: bombData?.bombId,
        //   position: bombData ? { x: bombData.x, y: bombData.y } : null
        // });
        emitError(socket, 'Invalid bomb placement data', 'INVALID_BOMB_DATA')
        return
      }
      
      // Validate that the bomb is for the correct player
      if (bombData.playerId !== socket.id) {
        // logGameEvent('Bomb placement rejected - invalid player', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombDataPlayerId: bombData.playerId,
        //   bombId: bombData.bombId,
        //   position: { x: bombData.x, y: bombData.y }
        // });
        emitError(socket, 'Cannot place bomb for another player', 'INVALID_PLAYER')
        return
      }
      
      // Validate room and player
      const room = validateRoom(socket, socket.roomCode, rooms)
      if (!room) {
        // logGameEvent('Bomb placement rejected - invalid room', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombId: bombData.bombId,
        //   position: { x: bombData.x, y: bombData.y }
        // });
        return
      }
      
      const player = validatePlayer(socket, room)
      if (!player) {
        // logGameEvent('Bomb placement rejected - invalid player object', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombId: bombData.bombId,
        //   position: { x: bombData.x, y: bombData.y }
        // });
        return
      }
      
      // Validate bomb position is walkable
      if (!room.gameState.board || room.gameState.board[bombData.x][bombData.y] !== 0) {
        // logGameEvent('Bomb placement rejected - non-walkable tile', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombId: bombData.bombId,
        //   position: { x: bombData.x, y: bombData.y },
        //   tileType: room.gameState.board ? room.gameState.board[bombData.x]?.[bombData.y] : 'no board'
        // });
        emitError(socket, 'Cannot place bomb on non-walkable tile', 'INVALID_BOMB_POSITION')
        return
      }
      
      // Check if there's already a bomb at this position
      if (room.gameState.bombs && room.gameState.bombs.some(b => b.x === bombData.x && b.y === bombData.y)) {
        // logGameEvent('Bomb placement rejected - bomb already exists at position', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   bombId: bombData.bombId,
        //   position: { x: bombData.x, y: bombData.y },
        //   existingBombsAtPosition: room.gameState.bombs.filter(b => b.x === bombData.x && b.y === bombData.y).map(b => ({ id: b.id, playerId: b.playerId }))
        // });
        emitError(socket, 'Bomb already exists at this position', 'BOMB_EXISTS')
        return
      }
      
      // CRITICAL: Add bomb to room.gameState.bombs so NPCs can see it and avoid it
      // This matches NPC bomb placement logic
      const BOMB_DURATION = bombData.duration || CONSTANTS.BOMB_TIMER_MS
      if (!room.gameState.bombs) {
        room.gameState.bombs = [];
      }
      
      // Check if player already has max bombs (dynamic based on power-ups)
      const maxBombs = player.maxBombs || 1
      const existingBombs = room.gameState.bombs.filter(b => b.playerId === socket.id);
      if (existingBombs.length >= maxBombs) {
        // Silently ignore - this is expected behavior (bomb limit reached)
        // logGameEvent('Bomb placement rejected - max bombs reached', {
        //   roomId: socket.roomCode,
        //   playerId: socket.id,
        //   playerName: player.name,
        //   existingBombsCount: existingBombs.length,
        //   maxBombs: maxBombs,
        //   attemptedPosition: { x: bombData.x, y: bombData.y },
        //   attemptedBombId: bombData.bombId,
        //   existingBombPositions: existingBombs.map(b => ({ id: b.id, x: b.x, y: b.y }))
        // });
        return
      }
      
      // Log successful bomb placement AFTER validation
      // logPlayerAction(socket.id, player.name, 'placed bomb', {
      //   roomId: socket.roomCode,
      //   position: { x: bombData.x, y: bombData.y },
      //   bombId: bombData.bombId,
      //   maxBombs: maxBombs,
      //   existingBombsCount: existingBombs.length,
      //   totalBombsInRoom: room.gameState.bombs.length
      // })
      
      // Get player's bomb range (default 2, can be upgraded via power-ups)
      // Use range from client if provided, otherwise use player's stored range
      const bombRange = bombData.range || (player.bombRange || CONSTANTS.DEFAULT_BOMB_RANGE)
      
      // Add bomb to game state
      room.gameState.bombs.push({
        id: bombData.bombId,
        bombId: bombData.bombId,
        playerId: socket.id,
        x: bombData.x,
        y: bombData.y,
        range: bombRange, // Use player's bomb range
        timer: BOMB_DURATION,
        placedAt: Date.now(),
        duration: BOMB_DURATION
      });
      
      // Broadcast to ALL players in the room (including sender for confirmation)
      // This ensures the client knows the server received the bomb placement
      io.to(socket.roomCode).emit('bomb:placed', {
          bombId: bombData.bombId,
          playerId: bombData.playerId,
          x: bombData.x,
          y: bombData.y,
          duration: BOMB_DURATION,
          range: bombRange
      })
    })

     //=================================
     // Handle single block destruction
     //=================================
    socket.on('block:destroy', (data) => {
        // Validate input
        if (!data || !validateCoordinates(data.x, data.y)) {
          emitError(socket, 'Invalid block destruction data', 'INVALID_BLOCK_DATA')
          return
        }
        
        // Validate room
        const room = validateRoom(socket, socket.roomCode, rooms)
        if (!room) return
        
        if (room.gameState.board) {
            // Update server board state (mark as walkable for NPCs)
            if (room.gameState.board[data.x] && room.gameState.board[data.x][data.y] === 1) {
                room.gameState.board[data.x][data.y] = 0 // 0 = walkable
                // logGameEvent('Block destroyed', {
                //   roomId: socket.roomCode,
                //   position: { x: data.x, y: data.y }
                // })
            }
        }
        
        // Broadcast to other players in the same room
        socket.to(socket.roomCode).emit('block:destroyed', {
            x: data.x,
            y: data.y,
            timestamp: data.timestamp || Date.now()
        })
    })

     //===================================
     // Handle multiple blocks destruction
     //===================================
    socket.on('blocks:destroy', (data) => {
        // Validate input
        if (!data || !Array.isArray(data.blocks)) {
          emitError(socket, 'Invalid blocks destruction data', 'INVALID_BLOCKS_DATA')
          return
        }
        
        // Validate all block coordinates
        for (const block of data.blocks) {
          if (!validateCoordinates(block.x, block.y)) {
            emitError(socket, 'Invalid block coordinates', 'INVALID_BLOCK_COORDINATES')
            return
          }
        }
        
        // Validate room
        const room = validateRoom(socket, socket.roomCode, rooms)
        if (!room) return
        
        if (room.gameState.board) {
            // Update server board state for all destroyed blocks
            data.blocks.forEach(block => {
                if (room.gameState.board[block.x] && room.gameState.board[block.x][block.y] === 1) {
                    room.gameState.board[block.x][block.y] = 0 // 0 = walkable
                }
            })
            // logGameEvent('Blocks destroyed', {
            //   roomId: socket.roomCode,
            //   blockCount: data.blocks.length
            // })
        }
        
        // Broadcast to other players in the same room
        socket.to(socket.roomCode).emit('blocks:destroyed', {
            blocks: data.blocks,
            timestamp: data.timestamp || Date.now()
        })
    })
	
}