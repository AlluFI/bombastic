const path = require('path')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { ENABLE_NPC, ENABLE_SINGLE_PLAYER_MODE, PORT, WS_PATH } = require('./config')
const {generateRoomCode, generateBoard, syncRoomGameState, handleNPCAction, checkGameEnd, colors, startPos, calculateExplosionBlocks, calculateExplosionTiles} = require('./utils.js')

// NPC module (feature-flagged)
const { NPC } = require('./npc')

//socket.io setup
const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve all static files from the client folder
app.use(express.static(path.join(__dirname, '../client')))

const rooms = new Map()
const allPlayers = new Map()


//Connect client
io.on('connection', socket => {
 
  //Host new room
  socket.on('room:host', (data) => {
  console.log(`📥 Received room:host from ${socket.id}, name: ${data.name}`)
  const roomId = generateRoomCode() 
  console.log(`🏠 Creating room ${roomId} for host ${socket.id}`)
  
  // Create room data structure with a NEW Map for players
  rooms.set(roomId, {
    host: socket.id,
    players: new Map(),
    started: false,
    chats: [],
    
    // Full game state for NPCs
    gameState: {
      players: [],      // Array format (synced from players Map)
      bombs: [],
      powerups: [],
      board: generateBoard(), // Generate board once when room is created
      gameMode: 'multiplayer', // 'multiplayer' | 'single-player'
      isRunning: false,
      isPaused: false, // Pause state
    },
    // NPC instances (only for single-player mode)
    npcs: new Map(),    // npc.id -> NPC instance
  })
  
  const room = rooms.get(roomId)
  
  // Add host as first player
  const playerData = {
    id: socket.id,
    name: data.name || `Player${room.players.size + 1}`,
    x: startPos[0].x,
    y: startPos[0].y,
    color: colors[0],
    lives: 3,
    alive: true
  }
  room.players.set(socket.id, playerData)
  console.log(`👤 Added host as player:`, playerData)
  
  // Sync game state after room creation
  syncRoomGameState(room)
  console.log(`🔄 Synced game state. Players in gameState:`, room.gameState.players.map(p => ({ id: p.id, name: p.name })))
  
  //  JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  // STORE ROOM CODE ON SOCKET (for later use)
  socket.roomCode = roomId
  
  // Send room info back to client
  const responseData = {
    roomCode: roomId,
    players: Array.from(room.players.values()),
    chats: room.chats,
    hostId: room.host,
    isRunning: room.gameState.isRunning,
    gameMode: room.gameState.gameMode
  }
  console.log(`📤 Emitting room:created to ${socket.id} with players:`, responseData.players.map(p => ({ id: p.id, name: p.name })))
  socket.emit('room:created', responseData)
  console.log(`✅ room:created event sent`)
})

  //Join to room
  socket.on('room:join', (data) => {
  const roomId = data.roomId
  const room = rooms.get(roomId)
  
  if (!room) {
    socket.emit('error', { message: 'Room not found' })
    return
  }
  
  // Reject if single-player mode
  if (room.gameState.gameMode === 'single-player') {
    socket.emit('error', { message: 'Room is in single-player mode' })
    return
  }
    
    if (room.players.size === 4) {
      socket.emit('error', { message: "Lobby is full" })
      return
    }
  
  // Add new player to room
  room.players.set(socket.id, {
    id: socket.id,
    name: data.name,
    x: startPos[room.players.size].x,
    y: startPos[room.players.size].y,
    color: colors[room.players.size],
    lives: 3,
    alive: true
  })
  
  // Sync game state after player joins
  syncRoomGameState(room)
  
  // JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  //  STORE ROOM CODE ON SOCKET
    socket.roomCode = roomId
        
  // Notify all players in this room
  io.to(roomId).emit('room:updated', {
    players: Array.from(room.players.values()),
    roomCode : roomId,
    chats: room.chats,
    hostId: room.host,
    isRunning: room.gameState.isRunning,
    gameMode: room.gameState.gameMode
  })
})
  

  // Handle player movement
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

  // Handle game pause/resume
  socket.on('game:pause', (payload) => {

    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (!player) return

    // Update pause state in game state
    room.gameState.isPaused = !!payload.paused

    console.log(`${player.name} ${payload.paused ? 'paused' : 'resumed'} the game`)

    // Broadcast to ALL clients (including sender) for sync
    io.to(socket.roomCode).emit('game:pause', {
      paused: !!payload.paused,
      by: socket.id,
      ts: Date.now(),
      name: player.name
    })
  })

//Send a message 
  socket.on('chat:send', (data) => {
    const room = rooms.get(socket.roomCode)
    if (!room) {
      console.log("error: room not found");
      socket.emit('error', { message: "room not found" })
      return
    } 
    

    const player = room.players.get(socket.id)
    if (!player) {
      console.log("error: player not found");
      socket.emit('error', { message: "player not found" })
      return
    } 

    const chatMessage = {
      message: data.chatMsg,
      by: player.name,
      timestamp: Date.now()
    }

    // Store message in room history
    room.chats.push(chatMessage)

    // Broadcast to room (including sender for consistency)
    io.to(socket.roomCode).emit('chat:toAll', chatMessage)
    
  })

  // Set game mode (single-player vs multiplayer)
  socket.on('set-game-mode', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Only host can set game mode' });
      return;
    }
    
    if (!ENABLE_SINGLE_PLAYER_MODE) {
      socket.emit('error', { message: 'Single-player mode is disabled' });
      return;
    }
    
    room.gameState.gameMode = data.mode; // 'multiplayer' | 'single-player'
    
    // If switching to single-player, reject new joins
    if (data.mode === 'single-player') {
      // Reject any pending joins (handled in room:join)
    }
    
    // Notify room
    io.to(socket.roomCode).emit('game-mode-changed', { mode: data.mode });
  });

  // Configure NPCs for single-player mode
  socket.on('configure-npcs', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Only host can configure NPCs' });
      return;
    }
    
    if (!ENABLE_NPC || !ENABLE_SINGLE_PLAYER_MODE) {
      socket.emit('error', { message: 'NPC mode is disabled' });
      return;
    }
    
    if (room.gameState.gameMode !== 'single-player') {
      socket.emit('error', { message: 'NPCs only available in single-player mode' });
      return;
    }
    
    // Clear existing NPCs
    room.npcs.clear();
    
    // Support two formats:
    // 1. Simple format: { count: number, difficulties: string[] }
    // 2. Advanced format: { npcs: [{ id, name, difficulty, ... }] }
    
    let npcsToCreate = [];
    
    if (data.npcs && Array.isArray(data.npcs)) {
      // Advanced format: individual NPC configs
      npcsToCreate = data.npcs.slice(0, 3); // Max 3 NPCs
    } else {
      // Simple format: count + difficulties array
      const count = Math.min(data.count || 1, 3); // Max 3 NPCs
      const difficulties = data.difficulties || Array(count).fill('medium');
      
      for (let i = 0; i < count; i++) {
        npcsToCreate.push({
          id: `npc-${i + 1}`,
          name: `Bot ${i + 1}`,
          difficulty: difficulties[i] || 'medium',
        });
      }
    }
    
    // Create NPCs
    npcsToCreate.forEach((npcConfig, index) => {
      const npcId = npcConfig.id || `npc-${index + 1}`;
      const npcName = npcConfig.name || `Bot ${index + 1}`;
      const difficulty = npcConfig.difficulty || 'medium';
      
      const npc = new NPC(npcId, npcName, difficulty);
      
      // Set NPC initial position (before adding to room)
      const startIndex = room.players.size;
      npc.position.x = startPos[startIndex].x;
      npc.position.y = startPos[startIndex].y;
      
      room.npcs.set(npcId, npc);
      
      // Add NPC to room.players Map (for consistency)
      room.players.set(npcId, {
        id: npcId,
        name: npc.name,
        x: npc.position.x,
        y: npc.position.y,
        color: colors[startIndex],
        alive: true,
        score: 0,
        isNPC: true,
      });
    });
    
    // Sync game state
    syncRoomGameState(room);
    
    // For single-player mode, automatically start the game after NPCs are configured
    if (room.gameState.gameMode === 'single-player' && !room.gameState.isRunning) {
      room.gameState.isRunning = true;
      console.log(`Single-player game started in room ${socket.roomCode} with ${room.npcs.size} NPC(s)`);
    }
    
    // Notify room (include updated players list with NPCs)
    io.to(socket.roomCode).emit('npcs-configured', {
      count: room.npcs.size,
      npcs: Array.from(room.npcs.values()).map(npc => ({
        id: npc.id,
        name: npc.name,
        difficulty: npc.difficulty,
      })),
    });
    
      // Also emit room:updated to sync NPCs to clients
    io.to(socket.roomCode).emit('room:updated', {
      players: Array.from(room.players.values()),
      roomCode: socket.roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode
    });
  });

  socket.on('game:quit', () => {
    const room = rooms.get(socket.roomCode)
    const player = room.players.get(socket.id)
    if (player) {
      console.log(`${player.name} disconnected`)
      room.players.delete(socket.id)
      
      // Notify others
      socket.to(socket.roomCode).emit('player:left', socket.id)
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
  
    // Clean up from room
    const room = rooms.get(socket.roomCode);
    if (room) {
      // Remove player from room
      room.players.delete(socket.id);

      socket.to(socket.roomCode).emit('player:left', socket.id)

      
      // If host disconnected, handle room cleanup
      if (room.host === socket.id) {
        // Clean up NPCs
        room.npcs.clear();
        // Optionally: delete room or transfer host
      }
      
      // Sync game state
      syncRoomGameState(room);
      
      // Notify room
      io.to(socket.roomCode).emit('room:updated', {
        players: Array.from(room.players.values()),
        roomCode: socket.roomCode,
        chats: room.chats,
        hostId: room.host,
        isRunning: room.gameState.isRunning,
        gameMode: room.gameState.gameMode
      });
    }
  })

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
        // Add bomb to game state
        room.gameState.bombs.push({
          id: bombData.bombId,
          bombId: bombData.bombId,
          playerId: socket.id,
          x: bombData.x,
          y: bombData.y,
          range: 2, // Default explosion range (can be upgraded via powerups later)
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
          duration: bombData.duration
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
    
    // Handle player damage
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

  // Handle game start (host only, requires 2+ players)
  socket.on('game:start', (data) => {
    const room = rooms.get(socket.roomCode)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    
    // Check if requester is the host
    if (room.host !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game' })
      return
    }
    
    // Check if game is already running
    if (room.gameState.isRunning) {
      socket.emit('error', { message: 'Game is already running' })
      return
    }
    
    // Check if there are at least 2 players
    const playerCount = room.players.size
    if (playerCount < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start the game' })
      return
    }
    
    // Start the game
    room.gameState.isRunning = true
    syncRoomGameState(room)
    
    console.log(`🎮 Game started in room ${socket.roomCode} by host ${socket.id} with ${playerCount} players`)
    
    // Broadcast game started event to all players in room
    io.to(socket.roomCode).emit('game:started', {
      roomCode: socket.roomCode,
      players: Array.from(room.players.values()),
      board: room.gameState.board,
      gameMode: room.gameState.gameMode,
      chats: room.chats
    })
  })


})

// Game loop (runs at 60 FPS)
setInterval(() => {
  rooms.forEach((room, roomId) => {
    // Only process running games
    if (!room.gameState.isRunning) return;
    
    // Skip all game logic if paused
    if (room.gameState.isPaused) return;
    
    // Sync player state (Map → Array)
    syncRoomGameState(room);
    
    // Update NPCs (only in single-player mode)
    if (ENABLE_NPC && room.gameState.gameMode === 'single-player') {
      room.npcs.forEach((npc, npcId) => {
        // Update NPC with current game state
        npc.updateWorldState(room.gameState);
        
        // Get next action
        const action = npc.getNextCommand(Date.now());
        if (action) {
          // Debug: log bomb actions to help diagnose
          if (action.type === 'BOMB') {
            console.log(`💣 NPC ${npcId} (${npc.name}) decided to place bomb at (${npc.position.x}, ${npc.position.y})`);
          }
          handleNPCAction(io, room, roomId, npcId, action);
        }
      });
      
      // Sync again after NPC updates
      syncRoomGameState(room);
    }
    
    // Update bomb timers and handle explosions
    if (room.gameState.bombs && room.gameState.bombs.length > 0) {
      const now = Date.now();
      const explodedBombs = [];
      const destroyedBlocks = [];
      
      room.gameState.bombs = room.gameState.bombs.filter(bomb => {
        const elapsed = now - bomb.placedAt;
        if (elapsed >= bomb.duration) {
          // Bomb has exploded - calculate explosion and destroy blocks
          explodedBombs.push(bomb);
          const blocks = calculateExplosionBlocks(bomb, room.gameState.board);
          destroyedBlocks.push(...blocks);
          return false; // Remove bomb from active bombs
        }
        return true; // Keep bomb (still active)
      });
      
      // Process exploded bombs
      if (explodedBombs.length > 0) {
        // Sync game state BEFORE checking for damage to ensure positions are current
        syncRoomGameState(room);
        
        const hitPlayers = new Set(); // Track players already hit (to avoid double damage)
        const hitNPCs = new Set(); // Track NPCs already hit (to avoid double damage)
        
        explodedBombs.forEach(bomb => {
          // Calculate all tiles affected by this explosion
          const explosionTiles = calculateExplosionTiles(bomb, room.gameState.board);
          
          // Check for players and NPCs caught in explosion
          // Also check NPCs directly from room.npcs to ensure we catch all NPCs
          explosionTiles.forEach(tile => {
            // First check NPCs directly (more reliable)
            if (ENABLE_NPC && room.gameState.gameMode === 'single-player') {
              room.npcs.forEach((npc, npcId) => {
                if (!hitNPCs.has(npcId) && npc.alive && npc.position.x === tile.x && npc.position.y === tile.y) {
                  hitNPCs.add(npcId);
                  hitPlayers.add(npcId); // Also add to hitPlayers to prevent double-checking
                  
                  // Apply damage to NPC
                  npc.lives = Math.max(0, npc.lives - 1);
                  npc.alive = npc.lives > 0;
                  
                  console.log(`💥 NPC ${npcId} (${npc.name}) caught in explosion at (${tile.x}, ${tile.y}). Lives: ${npc.lives}, Alive: ${npc.alive}`);
                  
                  // Broadcast damage to all players in room
                  io.to(roomId).emit('player:damaged', {
                    playerId: npcId,
                    lives: npc.lives,
                    died: !npc.alive
                  });
                }
              });
            }
            
            // Then check human players (both from gameState.players and room.players)
            room.gameState.players.forEach(player => {
              // Skip if already hit or if it's an NPC (we checked NPCs above)
              if (hitPlayers.has(player.id) || !player.alive || (ENABLE_NPC && room.npcs.has(player.id))) {
                return;
              }
              
              // Check if player is at this explosion tile
              if (player.x === tile.x && player.y === tile.y) {
                hitPlayers.add(player.id);
                
                // Handle human player damage
                const playerObj = room.players.get(player.id);
                if (playerObj) {
                  playerObj.lives = Math.max(0, playerObj.lives - 1);
                  playerObj.alive = playerObj.lives > 0;
                  
                  console.log(`💥 Player ${playerObj.name} (${playerObj.id}) caught in explosion at (${tile.x}, ${tile.y}). Lives: ${playerObj.lives}, Alive: ${playerObj.alive}`);
                  
                  // Broadcast damage to all players in room
                  io.to(roomId).emit('player:damaged', {
                    playerId: playerObj.id,
                    lives: playerObj.lives,
                    died: !playerObj.alive
                  });
                }
              }
            });
          });
          
          // Sync game state after applying damage (to update positions in gameState.players)
          syncRoomGameState(room);
          
          // Broadcast explosion to clients
          io.to(roomId).emit('bomb:exploded', {
            bombId: bomb.bombId,
            playerId: bomb.playerId,
            x: bomb.x,
            y: bomb.y
          });
        });
        
        // Sync game state after applying damage (to update player/NPC states)
        syncRoomGameState(room);
        
        // Update server board state for destroyed blocks
        if (destroyedBlocks.length > 0) {
          destroyedBlocks.forEach(block => {
            if (room.gameState.board[block.x] && room.gameState.board[block.x][block.y] === 1) {
              room.gameState.board[block.x][block.y] = 0; // 0 = walkable
            }
          });
          
          // Broadcast block destruction to clients
          io.to(roomId).emit('blocks:destroyed', {
            blocks: destroyedBlocks,
            timestamp: now
          });
          
          console.log(`${destroyedBlocks.length} blocks destroyed by bomb explosions in room ${roomId}`);
        }
      }
    }
    
    // Check for game end (winner detection)
    const gameEndResult = checkGameEnd(room.gameState);
    if (gameEndResult) {
      // Game has ended - stop the game and notify all players
      room.gameState.isRunning = false;
      
      // Emit game end event to all players in the room
      io.to(roomId).emit('game:end', {
        winner: gameEndResult.winner,
        isDraw: gameEndResult.isDraw,
        players: gameEndResult.allPlayers, // All players with final scores
      });
      
      console.log(`Game ended in room ${roomId}: ${gameEndResult.isDraw ? 'Draw' : `Winner: ${gameEndResult.winner.name}`}`);
    } else {
      // Broadcast updated game state to room
      io.to(roomId).emit('game:state', room.gameState);
    }
  });
}, 1000 / 60); // 60 FPS



server.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`))

 