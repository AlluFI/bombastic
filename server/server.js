const path = require('path')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { ENABLE_NPC, ENABLE_SINGLE_PLAYER_MODE, PORT, WS_PATH } = require('./config')
const {generateRoomCode, syncRoomGameState, handleNPCAction, colors, startPos} = require('./utils.js')

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
  const roomId = generateRoomCode() 
  
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
      board: null,      // Will be initialized when game starts
      gameMode: 'multiplayer', // 'multiplayer' | 'single-player'
      isRunning: false,
    },
    // NPC instances (only for single-player mode)
    npcs: new Map(),    // npc.id -> NPC instance
  })
  
  const room = rooms.get(roomId)
  
  // Add host as first player
  room.players.set(socket.id, {
    id: socket.id,
    name: data.name,
    x: startPos[0].x,
    y: startPos[0].y,
    color: colors[0]
  })
  
  // Sync game state after room creation
  syncRoomGameState(room)
  
  //  JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  // STORE ROOM CODE ON SOCKET (for later use)
  socket.roomCode = roomId
  
  // Send room info back to client
  socket.emit('room:created', {
    roomCode: roomId,
    players: Array.from(room.players.values()),
    chats: room.chats
  })
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
    color: colors[room.players.size]
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
    chats: room.chats
  })
})
  

  // Handle player movement
  socket.on('player:move', (moveData) => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (!player) return

    player.x = moveData.x
    player.y = moveData.y

    // Sync game state after player moves
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
      
      room.npcs.set(npcId, npc);
      
      // Add NPC to room.players Map (for consistency)
      room.players.set(npcId, {
        id: npcId,
        name: npc.name,
        x: startPos[room.players.size].x,
        y: startPos[room.players.size].y,
        color: colors[room.players.size],
        alive: true,
        score: 0,
        isNPC: true,
      });
    });
    
    // Sync game state
    syncRoomGameState(room);
    
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
    const player = allPlayers.get(socket.id)
    if (player) {
      console.log(`${player.name} disconnected`)
      allPlayers.delete(socket.id)
      
      // Notify others
      socket.broadcast.emit('player:left', socket.id)
    }
    
    // Clean up from room
    const room = rooms.get(socket.roomCode);
    if (room) {
      // Remove player from room
      room.players.delete(socket.id);
      
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
      });
    }
  })

    // Handle bomb placement
    socket.on('bomb:place', (bombData) => {
      const player = allPlayers.get(socket.id)
      if (!player) return
      
      console.log(`${player.name} placed bomb at (${bombData.x}, ${bombData.y})`)
      
      // Broadcast to ALL other players (not including sender)
      socket.broadcast.emit('bomb:placed', {
          bombId: bombData.bombId,
          playerId: bombData.playerId,
          x: bombData.x,
          y: bombData.y,
          duration: bombData.duration
      })
    })


})

// Game loop (runs at 60 FPS)
setInterval(() => {
  rooms.forEach((room, roomId) => {
    // Only process running games
    if (!room.gameState.isRunning) return;
    
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
          handleNPCAction(io, room, roomId, npcId, action);
        }
      });
      
      // Sync again after NPC updates
      syncRoomGameState(room);
    }
    
    // TODO: Update bomb timers, explosions (when implemented by Joel)
    
    // Broadcast updated game state to room
    io.to(roomId).emit('game-state', room.gameState);
  });
}, 1000 / 60); // 60 FPS



server.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`))

 // socket.on('player:join', (data) => {
      
  //   if (allPlayers.size === 4) {
  //     socket.emit('error', {message: "Lobby is full"})
  //     return
  //   }
 
  //     // Get the next available spawn position & colo
  //     const spawnIndex = allPlayers.size % startPos.length
  //     const colorIndex = allPlayers.size % colors.length
  //     const color = colors[colorIndex]
  //     const spawn = startPos[spawnIndex]
      
  //   allPlayers.set(socket.id, {
  //     id: socket.id,
  //     name: data.name || `Player${allPlayers.size + 1}`,
  //     x: spawn.x,
  //     y: spawn.y,
  //     color: color
      
  //   })

  //       // Send current allPlayers to new player
  //       socket.emit('game:state', {        
  //     allPlayers: Array.from(allPlayers.values())
  //   })

  //   // Broadcast new player to others
  //   socket.broadcast.emit('player:joined', allPlayers.get(socket.id))
    
  //   console.log(`${allPlayers.get(socket.id).name} joined at (${allPlayers.get(socket.id).x}, ${allPlayers.get(socket.id).y})`)
  // })
