/**
 * NPC Action Processing Utilities
 * Functions for processing NPC actions (movement, bomb placement)
 */

const { syncRoomGameState } = require('./game-state-utils')
const CONSTANTS = require('../constants')
const { logNPCAction } = require('../logger')

/**
 * Processes an NPC action and updates room state
 * @param {Object} io - Socket.io server instance
 * @param {Object} room - Room object
 * @param {string} roomId - Room ID
 * @param {string} npcId - NPC ID
 * @param {Object} action - Action object { type, direction? }
 */
function handleNPCAction(io, room, roomId, npcId, action) {
  const npc = room.npcs.get(npcId)
  if (!npc) return
  
  if (action.type === 'MOVE') {
    // Update NPC position
    // Coordinate system: x = row (vertical), y = col (horizontal)
    // UP = decrease x (move up in rows), DOWN = increase x (move down in rows)
    // LEFT = decrease y (move left in cols), RIGHT = increase y (move right in cols)
    const direction = action.direction
    let newX = npc.position.x
    let newY = npc.position.y
    
    if (direction === 'UP') newX--      // Move up = decrease row
    else if (direction === 'DOWN') newX++ // Move down = increase row
    else if (direction === 'LEFT') newY-- // Move left = decrease col
    else if (direction === 'RIGHT') newY++ // Move right = increase col
    
    // Validate move (check board bounds)
    // Grid is 13 rows (0-12) × 15 cols (0-14)
    // x = row (0-12), y = col (0-14)
    if (newX < 0 || newX >= 13 || newY < 0 || newY >= 15) {
      // Invalid move - don't update position
      return
    }
    
    // Sync game state before validation to ensure we have current player positions and bombs
    syncRoomGameState(room)
    
    // Validate that target position is walkable (server-side validation)
    // Check if tile is walkable (0 = walkable, 1 = block, 2 = wall)
    if (!room.gameState.board || room.gameState.board[newX][newY] !== 0) {
      // Blocked by wall or block
      return
    }
    
    // CRITICAL: Check if there's a bomb at the target position
    // This must check room.gameState.bombs directly (not NPC's cached gameState)
    // because bombs can be placed by other NPCs/players in the same cycle
    if (room.gameState.bombs && room.gameState.bombs.length > 0) {
      const blockingBomb = room.gameState.bombs.find(bomb => bomb.x === newX && bomb.y === newY)
      if (blockingBomb) {
        // Blocked by bomb - don't move
        return
      }
    }
    
    // Check if there's another player or NPC at the target position
    // Check both gameState.players and room.npcs to ensure we catch all entities
    // IMPORTANT: Only check ALIVE players - dead players don't block movement
    // Filter out dead players/NPCs first to avoid any edge cases
    if (room.gameState.players && room.gameState.players.length > 0) {
      // Filter to only alive players/NPCs at valid on-board positions
      const alivePlayers = room.gameState.players.filter(p => 
        p.alive === true && 
        p.x >= 0 && 
        p.y >= 0
      )
      
      const hasPlayer = alivePlayers.some(p => 
        p.id !== npcId && 
        p.x === newX && 
        p.y === newY
      )
      
      if (hasPlayer) {
        // Blocked by another player/NPC in gameState
        return
      }
    }
    
    // Also check NPCs directly to catch any that might not be in gameState yet
    // IMPORTANT: Only check ALIVE NPCs - dead NPCs don't block movement
    if (room.npcs) {
      for (const [otherNpcId, otherNpc] of room.npcs.entries()) {
        // Only block if NPC is alive AND at valid on-board position
        if (otherNpcId !== npcId && 
            otherNpc.alive === true && 
            otherNpc.position.x === newX && 
            otherNpc.position.y === newY &&
            otherNpc.position.x >= 0 && otherNpc.position.y >= 0) { // Exclude off-board positions
          // Blocked by another NPC
          return
        }
      }
    }
    
    // Also check human players directly (exclude NPCs from this check)
    // IMPORTANT: Only check ALIVE players - dead players don't block movement
    if (room.players) {
      for (const [playerId, player] of room.players.entries()) {
        // Skip NPCs (they're checked above) and the current NPC
        if (playerId !== npcId && 
            !player.isNPC && 
            player.alive === true && // Explicitly check for true (only alive players block)
            player.x === newX && 
            player.y === newY &&
            player.x >= 0 && player.y >= 0) { // Exclude off-board positions
          // Blocked by a human player
          return
        }
      }
    }
    
    npc.position.x = newX
    npc.position.y = newY
    
    // Update room.players Map
    const npcPlayer = room.players.get(npcId)
    if (npcPlayer) {
      npcPlayer.x = newX
      npcPlayer.y = newY
    }
    
    // Check if NPC stepped on a powerup
    if (room.gameState.powerups && room.gameState.powerups.length > 0) {
      const powerupIndex = room.gameState.powerups.findIndex(p => p.x === newX && p.y === newY)
      if (powerupIndex !== -1) {
        const powerup = room.gameState.powerups[powerupIndex]
        
        // Remove powerup from game state
        room.gameState.powerups.splice(powerupIndex, 1)
        
        // Update NPC stats (bombRange and maxBombs)
        if (!npcPlayer.bombRange) {
          npcPlayer.bombRange = CONSTANTS.DEFAULT_BOMB_RANGE
        }
        if (!npcPlayer.maxBombs) {
          npcPlayer.maxBombs = 1
        }
        
        if (powerup.type === 'bomb_range') {
          npcPlayer.bombRange += 1
          logNPCAction(npcId, npc.name, 'picked up bomb range power-up', {
            roomId,
            powerupType: powerup.type,
            newRange: npcPlayer.bombRange,
            position: { x: newX, y: newY }
          })
        } else if (powerup.type === 'bomb_count') {
          npcPlayer.maxBombs += 1
          logNPCAction(npcId, npc.name, 'picked up bomb count power-up', {
            roomId,
            powerupType: powerup.type,
            newMaxBombs: npcPlayer.maxBombs,
            position: { x: newX, y: newY }
          })
        } else if (powerup.type === 'immortal') {
          // Initialize immortal state if not exists
          if (npcPlayer.immortal === undefined) {
            npcPlayer.immortal = false
            npcPlayer.immortalEnd = 0
          }
          
          // Grant 5 seconds of immortality (matches human players)
          const IMMORTAL_DURATION = 5000
          npcPlayer.immortal = true
          npcPlayer.immortalEnd = Date.now() + IMMORTAL_DURATION
          
          logNPCAction(npcId, npc.name, 'picked up immortal power-up', {
            roomId,
            powerupType: powerup.type,
            duration: IMMORTAL_DURATION,
            position: { x: newX, y: newY }
          })
        }
        
        // Broadcast power-up pickup to all clients
        io.to(roomId).emit('powerup:picked', {
          powerupId: powerup.id,
          playerId: npcId,
          x: newX,
          y: newY,
          type: powerup.type
        })
      }
    }
    
    // Sync game state immediately after NPC moves to ensure positions are current for collision detection
    syncRoomGameState(room)
    
    // Broadcast to room
    io.to(roomId).emit('player:moved', {
      id: npcId,
      x: newX,
      y: newY,
    })
    
  } else if (action.type === 'BOMB') {
    // Place bomb for NPC (same as player bomb placement)
    const BOMB_DURATION = CONSTANTS.BOMB_TIMER_MS // 3 seconds, matching client
    
    // Get NPC's stats (from powerups)
    const npcPlayer = room.players.get(npcId)
    const maxBombs = npcPlayer?.maxBombs || 1
    const bombRange = npcPlayer?.bombRange || CONSTANTS.DEFAULT_BOMB_RANGE
    
    // Check if NPC already has max bombs (dynamic based on power-ups)
    const existingBombs = (room.gameState.bombs || []).filter(b => b.playerId === npcId)
    if (existingBombs.length >= maxBombs) {
      // NPC already has max bombs, skip placement
      return
    }
    
    // Generate unique bomb ID for NPC
    const bombId = `${npcId}-bomb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    
    // Create bomb object
    const bomb = {
      id: bombId,
      bombId: bombId,
      playerId: npcId,
      x: npc.position.x,
      y: npc.position.y,
      range: bombRange, // Use NPC's bomb range (upgraded via powerups)
      timer: BOMB_DURATION,
      placedAt: Date.now(),
      duration: BOMB_DURATION
    }
    
    // Add bomb to game state
    if (!room.gameState.bombs) {
      room.gameState.bombs = []
    }
    room.gameState.bombs.push(bomb)
    
    // Broadcast bomb placement to all clients in the room
    io.to(roomId).emit('bomb:placed', {
      bombId: bombId,
      playerId: npcId,
      x: bomb.x,
      y: bomb.y,
      duration: BOMB_DURATION,
      range: bombRange // Include range in broadcast
    })
    
    logNPCAction(npcId, npc.name, 'placed bomb', {
      roomId,
      position: { x: bomb.x, y: bomb.y },
      bombId: bombId,
      range: bombRange
    })
  }
}

module.exports = {
  handleNPCAction
}
