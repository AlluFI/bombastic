const {syncRoomGameState, calculateExplosionBlocks, calculateExplosionTiles, handleNPCAction, checkGameEnd} = require('./utils')
const {ENABLE_NPC} = require('./config')

module.exports = function gameLoop(io,rooms) {
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
          handleNPCAction(io, room, roomId, npcId, action);
        }
      });
      
      // Sync again after NPC updates
      syncRoomGameState(room);
    }
    
    // Update bomb timers and handle explosions (with chain reactions)
    if (room.gameState.bombs && room.gameState.bombs.length > 0) {
      const now = Date.now();
      const explodedBombs = [];
      const destroyedBlocks = [];
      const processedBombIds = new Set(); // Track bombs we've already processed in this cycle
      
      // Process chain reactions: keep processing until no more bombs explode
      let hasMoreExplosions = true;
      while (hasMoreExplosions) {
        hasMoreExplosions = false;
        
        // Find bombs that should explode (timer expired or triggered by chain reaction)
        const bombsToExplode = [];
        room.gameState.bombs.forEach(bomb => {
          if (processedBombIds.has(bomb.id)) {
            return; // Already processed this bomb
          }
          
          const elapsed = now - bomb.placedAt;
          if (elapsed >= bomb.duration) {
            bombsToExplode.push(bomb);
          }
        });
        
        if (bombsToExplode.length === 0) {
          break; // No more bombs to explode
        }
        
        // Process each bomb that should explode
        bombsToExplode.forEach(bomb => {
          processedBombIds.add(bomb.id);
          explodedBombs.push(bomb);
          
          // Calculate explosion tiles for this bomb
          const explosionTiles = calculateExplosionTiles(bomb, room.gameState.board);
          const blocks = calculateExplosionBlocks(bomb, room.gameState.board);
          destroyedBlocks.push(...blocks);
          
          // Check for chain reactions: find bombs in the explosion range
          room.gameState.bombs.forEach(otherBomb => {
            // Skip if this is the same bomb, already processed, or already exploded
            if (otherBomb.id === bomb.id || processedBombIds.has(otherBomb.id)) {
              return;
            }
            
            // Check if this bomb is within the explosion tiles
            const isInExplosion = explosionTiles.some(tile => tile.x === otherBomb.x && tile.y === otherBomb.y);
            
            if (isInExplosion) {
              // Trigger chain reaction: set bomb's timer to 0 so it explodes immediately
              otherBomb.placedAt = now - otherBomb.duration; // Set elapsed time to duration (triggers explosion)
              hasMoreExplosions = true; // Continue processing chain reactions
              console.log(`💣 Chain reaction: Bomb at (${otherBomb.x}, ${otherBomb.y}) triggered by explosion at (${bomb.x}, ${bomb.y})`);
            }
          });
        });
      }
      
      // Remove exploded bombs from active bombs list (after processing all chain reactions)
      room.gameState.bombs = room.gameState.bombs.filter(bomb => !processedBombIds.has(bomb.id));
      
      // Process exploded bombs (damage, block destruction, etc.)
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
                  
                  console.log(`NPC ${npc.name} caught in explosion at (${tile.x}, ${tile.y}). Lives: ${npc.lives}, Alive: ${npc.alive}`);
                  
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
            y: bomb.y,
            range: bomb.range
          });
        });
        
        // Sync game state after applying damage (to update player/NPC states)
        syncRoomGameState(room);
        
        // Update server board state for destroyed blocks and spawn power-ups
        if (destroyedBlocks.length > 0) {
          const spawnedPowerups = [];
          
          destroyedBlocks.forEach(block => {
            if (room.gameState.board[block.x] && room.gameState.board[block.x][block.y] === 1) {
              room.gameState.board[block.x][block.y] = 0; // 0 = walkable
              
              // Spawn power-up randomly (30% chance per destroyed block)
              // Only spawn if we haven't reached the max power-ups yet
              const maxPowerups = room.players.size * 4; // players * 4
              const currentPowerups = room.gameState.powerups ? room.gameState.powerups.length : 0;
              
              // Only spawn if we haven't exceeded the max and random chance succeeds
              if (currentPowerups < maxPowerups && Math.random() < 0.3) {
                const powerupId = `powerup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                const powerup = {
                  id: powerupId,
                  type: 'bomb_range',
                  x: block.x,
                  y: block.y
                };
                
                if (!room.gameState.powerups) {
                  room.gameState.powerups = [];
                }
                room.gameState.powerups.push(powerup);
                spawnedPowerups.push(powerup);
                
                console.log(`💎 Power-up spawned at (${block.x}, ${block.y}) in room ${roomId}`);
              }
            }
          });
          
          // Broadcast block destruction to clients
          io.to(roomId).emit('blocks:destroyed', {
            blocks: destroyedBlocks,
            timestamp: now
          });
          
          // Broadcast power-up spawns
          if (spawnedPowerups.length > 0) {
            io.to(roomId).emit('powerup:spawned', {
              powerups: spawnedPowerups
            });
          }
          
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
}