const {syncRoomGameState, calculateExplosionBlocks, calculateExplosionTiles, handleNPCAction, checkGameEnd} = require('./utils')
const {ENABLE_NPC} = require('./config')
const CONSTANTS = require('./constants')
// const { logRoomEvent, logPlayerAction, logNPCAction, logGameEvent, logger } = require('./logger')

module.exports = function gameLoop(io, rooms) {
    // Room cleanup loop (runs every minute)
    setInterval(() => {
      const now = Date.now();
      const roomsToDelete = [];
      
      rooms.forEach((room, roomId) => {
        // Skip if room has players
        if (room.players && room.players.size > 0) {
          return;
        }
        
        // Skip if room was just created (give it time)
        if (!room.createdAt) {
          room.createdAt = now;
          return;
        }
        
        // Delete room if it's been empty for too long
        const timeSinceEmpty = now - (room.lastEmptyTime || room.createdAt);
        if (timeSinceEmpty > CONSTANTS.ROOM_CLEANUP_DELAY_MS) {
          roomsToDelete.push(roomId);
        } else if (!room.lastEmptyTime) {
          room.lastEmptyTime = now;
        }
      });
      
      // Delete empty rooms
      roomsToDelete.forEach(roomId => {
        // logRoomEvent(roomId, 'Cleaning up empty room');
        rooms.delete(roomId);
      });
    }, 60 * 1000); // Check every minute
    
    // Game loop (runs at 60 FPS)
    setInterval(() => {
      rooms.forEach((room, roomId) => {
    // Only process running games
    if (!room.gameState.isRunning) return;
    
    // Check and expire immortal states
    const now = Date.now();
    room.players.forEach((player, playerId) => {
      if (player.immortal && player.immortalEnd && now >= player.immortalEnd) {
        player.immortal = false;
        player.immortalEnd = 0;
        // logPlayerAction(playerId, player.name, 'immortality expired', { roomId, type: 'immortal' });
        // Broadcast expiration to clients
        io.to(roomId).emit('powerup:expired', {
          playerId: playerId,
          type: 'immortal'
        });
      }
    });
    
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
      
      // Process chain reactions: process all bombs that should explode in one pass
      // Start with bombs that have expired timers
      const bombsToExplode = [];
      const bombsToExplodeIds = new Set();
      
      // Initial collection: find bombs with expired timers
      room.gameState.bombs.forEach(bomb => {
        if (processedBombIds.has(bomb.id)) {
          return; // Already processed
        }
        
        const elapsed = now - bomb.placedAt;
        if (elapsed >= bomb.duration) {
          bombsToExplode.push(bomb);
          bombsToExplodeIds.add(bomb.id);
          // logGameEvent('Bomb timer expired - added to queue', {
          //   roomId,
          //   bombId: bomb.id,
          //   position: { x: bomb.x, y: bomb.y },
          //   elapsed,
          //   duration: bomb.duration
          // });
        }
      });
      
      // Only log initial queue if there are bombs to process
      if (bombsToExplode.length > 0) {
        // logGameEvent('Initial bomb queue', {
        //   roomId,
        //   queueSize: bombsToExplode.length,
        //   queueIds: bombsToExplode.map(b => b.id),
        //   totalBombs: room.gameState.bombs.length,
        //   allBombsInRoom: room.gameState.bombs.map(b => ({ id: b.id, x: b.x, y: b.y, placedAt: b.placedAt, duration: b.duration }))
        // });
      }
      
      // Process bombs and trigger chain reactions
      // Use index-based loop so we can add bombs during iteration
      let bombIndex = 0;
      while (bombIndex < bombsToExplode.length) {
        const bomb = bombsToExplode[bombIndex];
        bombIndex++;
        
        // Skip if already processed (safety check)
        if (processedBombIds.has(bomb.id)) {
          // logGameEvent('Skipping already processed bomb', {
          //   roomId,
          //   bombId: bomb.id,
          //   processedIds: Array.from(processedBombIds)
          // });
          continue;
        }
        
        // logGameEvent('Processing bomb explosion', {
        //   roomId,
        //   bombId: bomb.id,
        //   position: { x: bomb.x, y: bomb.y },
        //   queueSize: bombsToExplode.length,
        //   queueIndex: bombIndex - 1,
        //   totalBombsInRoom: room.gameState.bombs.length
        // });
        
        // Mark as processed
        processedBombIds.add(bomb.id);
        explodedBombs.push(bomb);
        
        // Calculate explosion tiles for this bomb
        const explosionTiles = calculateExplosionTiles(bomb, room.gameState.board);
        const blocks = calculateExplosionBlocks(bomb, room.gameState.board);
        destroyedBlocks.push(...blocks);
        
        // Check for chain reactions: find bombs in the explosion range
        // Check ALL bombs in room.gameState.bombs to catch any bombs in range
        // Iterate backwards to avoid issues if array is modified
        // logGameEvent('Checking for chain reactions', {
        //   roomId,
        //   bombId: bomb.id,
        //   explosionTilesCount: explosionTiles.length,
        //   totalBombsToCheck: room.gameState.bombs.length,
        //   processedCount: processedBombIds.size,
        //   queuedCount: bombsToExplodeIds.size
        // });
        
        // IMPORTANT: Check the LIVE array directly, not a snapshot
        // This ensures we catch all bombs that are currently in the room,
        // including any that might have been added during processing
        // We need to check the live array because bombs can be added/removed
        // during the game loop, and we want to catch all bombs that exist NOW
        
        const explosionTilePositions = explosionTiles.map(t => ({ x: t.x, y: t.y }));
     
        
        // Iterate over the LIVE array directly, but iterate backwards to avoid issues
        // if bombs are removed during iteration
        // CRITICAL: We need to check ALL bombs in the room, including ones that might have been
        // added during the chain reaction processing. The live array should contain all active bombs.
        const bombsToCheck = Array.from(room.gameState.bombs); // Create a snapshot to iterate safely
        // logGameEvent('Iterating over bombs for chain reaction', {
        //   roomId,
        //   triggeringBomb: { id: bomb.id, x: bomb.x, y: bomb.y },
        //   totalBombsInLiveArray: room.gameState.bombs.length,
        //   bombsToCheckCount: bombsToCheck.length,
        //   allBombPositions: bombsToCheck.map(b => ({ id: b.id, x: b.x, y: b.y, placedAt: b.placedAt }))
        // });
        
        for (let i = 0; i < bombsToCheck.length; i++) {
          const otherBomb = bombsToCheck[i];
          
          // Safety check: verify bomb still exists in live array (might have been removed)
          if (!otherBomb) {
            continue;
          }
          
          // Verify bomb still exists in live array (double-check)
          const bombStillExists = room.gameState.bombs.some(b => b.id === otherBomb.id);
          if (!bombStillExists) {
            // logGameEvent('Bomb no longer exists in live array (skipped)', {
            //   roomId,
            //   bombId: otherBomb.id,
            //   position: { x: otherBomb.x, y: otherBomb.y }
            // });
            continue;
          }
          
          // Skip if same bomb, already processed, or already queued
          if (otherBomb.id === bomb.id || processedBombIds.has(otherBomb.id) || bombsToExplodeIds.has(otherBomb.id)) {
            // if (otherBomb && otherBomb.id !== bomb.id) {
            //   logGameEvent('Bomb skipped in chain check', {
            //     roomId,
            //     bombId: otherBomb.id,
            //     position: { x: otherBomb.x, y: otherBomb.y },
            //     reason: !otherBomb ? 'null' : 
            //             otherBomb.id === bomb.id ? 'same bomb' :
            //             processedBombIds.has(otherBomb.id) ? 'already processed' :
            //             bombsToExplodeIds.has(otherBomb.id) ? 'already queued' : 'unknown'
            //   });
            // }
            continue;
          }
          
          // Check if this bomb is within the explosion tiles
          const isInExplosion = explosionTiles.some(tile => tile.x === otherBomb.x && tile.y === otherBomb.y);
          
          if (isInExplosion) {
            // Trigger chain reaction: add to queue immediately
            // Find the actual bomb object from room.gameState.bombs to ensure we have the latest reference
            const liveBomb = room.gameState.bombs.find(b => b.id === otherBomb.id);
            if (liveBomb) {
              // Double-check: make sure this bomb isn't already processed or queued
              if (!processedBombIds.has(liveBomb.id) && !bombsToExplodeIds.has(liveBomb.id)) {
                bombsToExplode.push(liveBomb);
                bombsToExplodeIds.add(liveBomb.id);
                // logGameEvent('Chain reaction triggered', {
                //   roomId,
                //   triggeredBomb: { id: liveBomb.id, x: liveBomb.x, y: liveBomb.y, range: liveBomb.range },
                //   triggeringBomb: { id: bomb.id, x: bomb.x, y: bomb.y, range: bomb.range },
                //   queueSize: bombsToExplode.length,
                //   queueIds: bombsToExplode.map(b => b.id),
                //   totalBombsInRoom: room.gameState.bombs.length,
                //   processedIds: Array.from(processedBombIds),
                //   queuedIds: Array.from(bombsToExplodeIds),
                //   distance: Math.abs(liveBomb.x - bomb.x) + Math.abs(liveBomb.y - bomb.y)
                // });
              } else {
                // logGameEvent('Chain reaction skipped - bomb already processed/queued', {
                //   roomId,
                //   bombId: liveBomb.id,
                //   alreadyProcessed: processedBombIds.has(liveBomb.id),
                //   alreadyQueued: bombsToExplodeIds.has(liveBomb.id)
                // });
              }
            }
          } else {
            // logGameEvent('Bomb not in explosion range', {
            //   roomId,
            //   bombId: otherBomb.id,
            //   position: { x: otherBomb.x, y: otherBomb.y },
            //   explosionTiles: explosionTilePositions
            // });
          }
        }
      }
      
      // Remove exploded bombs from active bombs list (after processing all chain reactions)
      room.gameState.bombs = room.gameState.bombs.filter(bomb => !processedBombIds.has(bomb.id));
      
      // Log all exploded bombs for debugging
      if (explodedBombs.length > 0) {
        // logGameEvent('All bombs processed in chain', {
        //   roomId,
        //   totalExploded: explodedBombs.length,
        //   explodedBombIds: explodedBombs.map(b => b.id),
        //   explodedBombPositions: explodedBombs.map(b => ({ id: b.id, x: b.x, y: b.y }))
        // });
      }
      
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
                  const wasAlive = npc.alive;
                  npc.lives = Math.max(0, npc.lives - 1);
                  npc.alive = npc.lives > 0;
                  
                  // logNPCAction(npcId, npc.name, 'caught in explosion', {
                  //   roomId,
                  //   position: { x: tile.x, y: tile.y },
                  //   lives: npc.lives,
                  //   alive: npc.alive
                  // });
                  
                  // Track elimination order
                  if (wasAlive && !npc.alive) {
                    // NPC was eliminated - track elimination order
                    if (!room.eliminationOrder) {
                      room.eliminationOrder = [];
                    }
                    const npcPlayer = room.players.get(npcId);
                    if (npcPlayer && !room.eliminationOrder.includes(npcId)) {
                      room.eliminationOrder.push(npcId);
                      // logNPCAction(npcId, npc.name, 'eliminated', {
                      //   roomId,
                      //   eliminationOrder: room.eliminationOrder.length
                      // });
                    }
                  }
                  
                  // Broadcast damage to all players in room
                  io.to(roomId).emit('player:damaged', {
                    playerId: npcId,
                    lives: npc.lives,
                    died: !npc.alive
                  });
                  
                  // Grant immortal power-up to bomb owner when their bomb hits an NPC
                  // Only grant if bomb owner is different from hit NPC and bomb owner is alive
                  if (bomb.playerId && bomb.playerId !== npcId) {
                    const bombOwner = room.players.get(bomb.playerId);
                    if (bombOwner && bombOwner.alive) {
                      // Initialize immortal state if not exists
                      if (bombOwner.immortal === undefined) {
                        bombOwner.immortal = false;
                        bombOwner.immortalEnd = 0;
                      }
                      
                      // Grant 15 seconds of immortality
                      const IMMORTAL_DURATION = 15000;
                      bombOwner.immortal = true;
                      bombOwner.immortalEnd = Date.now() + IMMORTAL_DURATION;
                      
                      // logPlayerAction(bombOwner.id, bombOwner.name, 'gained immortality after hitting NPC', {
                      //   roomId,
                      //   target: npc.name,
                      //   duration: IMMORTAL_DURATION,
                      //   type: 'immortal'
                      // });
                      
                      // Broadcast immortal power-up to all clients
                      io.to(roomId).emit('powerup:granted', {
                        playerId: bombOwner.id,
                        type: 'immortal',
                        duration: IMMORTAL_DURATION
                      });
                    }
                  }
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
                  // Initialize immortal state if not exists
                  if (playerObj.immortal === undefined) {
                    playerObj.immortal = false;
                    playerObj.immortalEnd = 0;
                  }
                  
                  // Initialize invincibility state if not exists (short-term after taking damage)
                  if (playerObj.invincible === undefined) {
                    playerObj.invincible = false;
                    playerObj.invincibilityEnd = 0;
                  }
                  
                  // Check if player is immortal (power-up)
                  const isImmortal = playerObj.immortal && Date.now() < playerObj.immortalEnd;
                  
                  // Check if player is invincible (recently took damage)
                  const isInvincible = playerObj.invincible && Date.now() < playerObj.invincibilityEnd;
                  
                  if (isImmortal) {
                    // logPlayerAction(playerObj.id, playerObj.name, 'damage blocked (immortal)', { roomId, position: { x: tile.x, y: tile.y } });
                    // Skip damage but still grant immortal to bomb owner
                  } else if (isInvincible) {
                    // logPlayerAction(playerObj.id, playerObj.name, 'damage blocked (invincible)', { roomId, position: { x: tile.x, y: tile.y } });
                    // Skip damage - player is still invincible from recent hit
                  } else {
                    const wasAlive = playerObj.alive;
                    playerObj.lives = Math.max(0, playerObj.lives - 1);
                    playerObj.alive = playerObj.lives > 0;
                    
                    // Start invincibility period (2 seconds)
                    playerObj.invincible = true;
                    playerObj.invincibilityEnd = Date.now() + 2000;
                    
                    // logPlayerAction(playerObj.id, playerObj.name, 'caught in explosion', {
                    //   roomId,
                    //   position: { x: tile.x, y: tile.y },
                    //   lives: playerObj.lives,
                    //   alive: playerObj.alive
                    // });
                    
                    // Track elimination order
                    if (wasAlive && !playerObj.alive) {
                      // Player was eliminated - track elimination order
                      if (!room.eliminationOrder) {
                        room.eliminationOrder = [];
                      }
                      if (!room.eliminationOrder.includes(playerObj.id)) {
                        room.eliminationOrder.push(playerObj.id);
                        // logPlayerAction(playerObj.id, playerObj.name, 'eliminated', {
                        //   roomId,
                        //   eliminationOrder: room.eliminationOrder.length
                        // });
                      }
                    }
                    
                    // Broadcast damage to all players in room
                    io.to(roomId).emit('player:damaged', {
                      playerId: playerObj.id,
                      lives: playerObj.lives,
                      died: !playerObj.alive
                    });
                  }
                  
                  // Grant immortal power-up to bomb owner when their bomb hits another player
                  // Only grant if bomb owner is different from hit player and bomb owner is alive
                  if (bomb.playerId && bomb.playerId !== playerObj.id) {
                    const bombOwner = room.players.get(bomb.playerId);
                    if (bombOwner && bombOwner.alive) {
                      // Initialize immortal state if not exists
                      if (bombOwner.immortal === undefined) {
                        bombOwner.immortal = false;
                        bombOwner.immortalEnd = 0;
                      }
                      
                      // Grant 15 seconds of immortality
                      const IMMORTAL_DURATION = 15000;
                      bombOwner.immortal = true;
                      bombOwner.immortalEnd = Date.now() + IMMORTAL_DURATION;
                      
                      // logPlayerAction(bombOwner.id, bombOwner.name, 'gained immortality after hitting player', {
                      //   roomId,
                      //   target: playerObj.name,
                      //   duration: IMMORTAL_DURATION,
                      //   type: 'immortal'
                      // });
                      
                      // Broadcast immortal power-up to all clients
                      io.to(roomId).emit('powerup:granted', {
                        playerId: bombOwner.id,
                        type: 'immortal',
                        duration: IMMORTAL_DURATION
                      });
                    }
                  }
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
              const maxPowerups = room.players.size * CONSTANTS.MAX_POWERUPS_MULTIPLIER
              const currentPowerups = room.gameState.powerups ? room.gameState.powerups.length : 0;
              
              // Only spawn if we haven't exceeded the max and random chance succeeds
              if (currentPowerups < maxPowerups && Math.random() < CONSTANTS.POWERUP_SPAWN_CHANCE) {
                const powerupId = `powerup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                // Randomly choose power-up type: 50% bomb_range, 30% bomb_count, 20% immortal
                const powerupTypes = ['bomb_range', 'bomb_range', 'bomb_range', 'bomb_range', 'bomb_range', 'bomb_count', 'bomb_count', 'bomb_count', 'immortal', 'immortal'];
                const powerupType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
                const powerup = {
                  id: powerupId,
                  type: powerupType,
                  x: block.x,
                  y: block.y
                };
                
                if (!room.gameState.powerups) {
                  room.gameState.powerups = [];
                }
                room.gameState.powerups.push(powerup);
                spawnedPowerups.push(powerup);
                
                // logGameEvent('Power-up spawned', {
                //   roomId,
                //   powerupId: powerupId,
                //   type: powerup.type,
                //   position: { x: block.x, y: block.y }
                // });
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
          
          // logGameEvent('Blocks destroyed by bomb explosions', {
          //   roomId,
          //   blockCount: destroyedBlocks.length,
          //   powerupsSpawned: spawnedPowerups.length
          // });
        }
      }
    }
    
    // Send timer sync update (every second, only if game is running and not paused)
    if (room.gameStartTime && !room.gameState.isPaused) {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - room.gameStartTime) / 1000);
      
      // Send timer update every second (throttle to avoid spam)
      if (!room.lastTimerUpdate || (now - room.lastTimerUpdate) >= 1000) {
        room.lastTimerUpdate = now;
        io.to(roomId).emit('timer:sync', {
          elapsedSeconds: elapsedSeconds,
          timestamp: now
        });
      }
    }
    
    // Check for game end (winner detection)
    const gameEndResult = checkGameEnd(room.gameState, room);
    if (gameEndResult) {
      // Game has ended - stop the game and notify all players
      room.gameState.isRunning = false;
      room.gameStartTime = null; // Clear timer
      
      // Emit game end event to all players in the room
      io.to(roomId).emit('game:end', {
        winner: gameEndResult.winner,
        isDraw: gameEndResult.isDraw,
        players: gameEndResult.allPlayers, // All players with final scores
      });
      
      // logRoomEvent(roomId, 'Game ended', {
      //   isDraw: gameEndResult.isDraw,
      //   winner: gameEndResult.isDraw ? null : {
      //     id: gameEndResult.winner.id,
      //     name: gameEndResult.winner.name
      //   },
      //   totalPlayers: gameEndResult.allPlayers?.length || 0
      // });
    } else {
      // Broadcast updated game state to room
      io.to(roomId).emit('game:state', room.gameState);
    }
  });
}, 1000 / 60); // 60 FPS
}