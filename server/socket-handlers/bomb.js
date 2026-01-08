

module.exports = function bombHandlers(io, socket, rooms) {

     // Handle bomb placement
    socket.on('bomb:place', (bombData) => {
      const room = rooms.get(socket.roomCode)
      if (!room) return
      
      const player = room.players.get(socket.id)
      if (!player) return
      
      console.log(`${player.name} placed bomb at (${bombData.x}, ${bombData.y}) in room ${socket.roomCode}`)
      
      // CRITICAL: Add bomb to room.gameState.bombs so NPCs can see it and avoid it
      // This matches NPC bomb placement logic
      const BOMB_DURATION = bombData.duration || 3000; // Default 3 seconds
      if (!room.gameState.bombs) {
        room.gameState.bombs = [];
      }
      
      // Check if player already has an active bomb (max 1 bomb per player/NPC)
      const existingBombs = room.gameState.bombs.filter(b => b.playerId === socket.id);
      if (existingBombs.length === 0) {
        // Get player's bomb range (default 2, can be upgraded via power-ups)
        // Use range from client if provided, otherwise use player's stored range
        const bombRange = bombData.range || (player.bombRange ? player.bombRange : 2)
        
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
      }
      
      // Broadcast to all OTHER players in the same room (sender already rendered it locally)
      socket.to(socket.roomCode).emit('bomb:placed', {
          bombId: bombData.bombId,
          playerId: bombData.playerId,
          x: bombData.x,
          y: bombData.y,
          duration: bombData.duration,
          range: bombData.range || (player.bombRange ? player.bombRange : 2)
      })
    })

    // Handle single block destruction
    socket.on('block:destroy', (data) => {
        const room = rooms.get(socket.roomCode)
        if (room && room.gameState.board) {
            // Update server board state (mark as walkable for NPCs)
            if (room.gameState.board[data.x] && room.gameState.board[data.x][data.y] === 1) {
                room.gameState.board[data.x][data.y] = 0 // 0 = walkable
                console.log(`Block destroyed at (${data.x}, ${data.y}) - board updated`)
            }
        }
        
        // Broadcast to other players in the same room
        socket.to(socket.roomCode).emit('block:destroyed', {
            x: data.x,
            y: data.y,
            timestamp: data.timestamp
        })
    })

    // Handle multiple blocks destruction
    socket.on('blocks:destroy', (data) => {
        const room = rooms.get(socket.roomCode)
        if (room && room.gameState.board && data.blocks) {
            // Update server board state for all destroyed blocks
            data.blocks.forEach(block => {
                if (room.gameState.board[block.x] && room.gameState.board[block.x][block.y] === 1) {
                    room.gameState.board[block.x][block.y] = 0 // 0 = walkable
                }
            })
            console.log(`${data.blocks.length} blocks destroyed - board updated`)
        }
        
        // Broadcast to other players in the same room
        socket.to(socket.roomCode).emit('blocks:destroyed', {
            blocks: data.blocks,
            timestamp: data.timestamp
        })
    })
	
}