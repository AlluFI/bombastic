/**
 * Game State Management Utilities
 * Functions for synchronizing game state and checking game end conditions
 */

const { logger } = require('../logger')

/**
 * Syncs room.players Map to room.gameState.players Array
 * This makes the room state compatible with NPCs
 */
function syncRoomGameState(room) {
  // Initialize elimination order if it doesn't exist
  if (!room.eliminationOrder) {
    room.eliminationOrder = []
  }
  
  // Sync human players (exclude NPCs from room.players Map)
  room.gameState.players = Array.from(room.players.values())
    .filter(p => !p.isNPC) // Exclude NPCs that might be in the Map
    .map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      color: p.color,
      alive: p.alive !== false,  // Default: true
      lives: p.lives || 1,
      isNPC: false,  // Human players
    }))
  
  // Add/update NPCs in the players array
  room.npcs.forEach((npc, npcId) => {
    const npcPlayer = room.gameState.players.find(p => p.id === npcId)
    
    // Determine the correct position - dead NPCs should be off-board
    let npcX = npc.position.x
    let npcY = npc.position.y
    if (!npc.alive && (npcX >= 0 || npcY >= 0)) {
      // NPC is dead but still on-board - move off-board
      npcX = -1
      npcY = -1
      npc.position.x = -1
      npc.position.y = -1
    }
    
    if (!npcPlayer) {
      room.gameState.players.push({
        id: npcId,
        name: npc.name,
        x: npcX, // Use corrected position
        y: npcY, // Use corrected position
        color: room.players.get(npcId)?.color || '#888888', // Get color from Map if available
        alive: npc.alive,
        lives: npc.lives || 1,
        isNPC: true,
      })
    } else {
      // Update existing NPC player
      // IMPORTANT: Always sync position and alive status, even for dead NPCs
      // Dead NPCs should have position at (-1, -1) to avoid blocking tiles
      npcPlayer.x = npcX // Use corrected position
      npcPlayer.y = npcY // Use corrected position
      npcPlayer.alive = npc.alive
      npcPlayer.lives = npc.lives || 1
      npcPlayer.isNPC = true // Ensure flag is set
    }
  })
}

/**
 * Checks if the game has ended and returns winner information
 * @param {Object} gameState - Current game state
 * @param {Object} room - Room object
 * @returns {Object|null} Winner info { winner: player object, isDraw: boolean } or null if game continues
 */
function checkGameEnd(gameState, room) {
  if (!gameState || !gameState.players) return null
  
  const alivePlayers = gameState.players.filter(p => p.alive !== false)
  
  // Game ends when only one player is alive (or no players)
  if (alivePlayers.length <= 1) {
    // Initialize elimination order if it doesn't exist
    if (!room.eliminationOrder) {
      room.eliminationOrder = []
    }
    
    // Add winner to elimination order (they're last, so highest rank)
    // IMPORTANT: Remove winner from eliminationOrder first if they're already in it,
    // then add them at the end to ensure they have the highest index
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0]
      // Remove winner from eliminationOrder if they're already in it (shouldn't happen, but safety check)
      const winnerIndex = room.eliminationOrder.indexOf(winner.id)
      if (winnerIndex !== -1) {
        room.eliminationOrder.splice(winnerIndex, 1)
      }
      // Add winner at the end (highest index = best rank)
      room.eliminationOrder.push(winner.id)
      
      // Sort players by elimination order (last eliminated = winner = rank 1)
      // Players eliminated first have higher rank numbers (worse placement)
      const sortedPlayers = [...gameState.players].sort((a, b) => {
        // Use lastIndexOf to get the last occurrence (most recent position)
        // This handles edge cases where a player might appear multiple times
        const aIndex = room.eliminationOrder.lastIndexOf(a.id)
        const bIndex = room.eliminationOrder.lastIndexOf(b.id)
        
        // If not in elimination order, they're still alive (winner) - rank 1
        if (aIndex === -1) return -1 // Winner comes first
        if (bIndex === -1) return 1   // Winner comes first
        
        // Higher index = eliminated later = better rank (lower number)
        // Sort descending: highest index (winner) first
        return bIndex - aIndex
      })
      
      // Debug: Verify sorting is correct
      logger.debug({
        eliminationOrder: room.eliminationOrder,
        sortedPlayers: sortedPlayers.map(p => {
          const idx = room.eliminationOrder.lastIndexOf(p.id)
          return { name: p.name, id: p.id, lastIndex: idx }
        })
      }, 'Game end - Players sorted by elimination order')
      
      return {
        winner: winner,
        isDraw: false,
        allPlayers: sortedPlayers // Sorted by elimination order (winner first)
      }
    } else {
      // All players dead - draw
      // Sort by elimination order (last eliminated = better rank)
      const sortedPlayers = [...gameState.players].sort((a, b) => {
        // Use lastIndexOf to get the last occurrence (most recent position)
        const aIndex = room.eliminationOrder.lastIndexOf(a.id)
        const bIndex = room.eliminationOrder.lastIndexOf(b.id)
        
        // If not in elimination order, something went wrong - put them last
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        
        // Higher index = eliminated later = better rank (lower number)
        return bIndex - aIndex
      })
      
      return {
        winner: null,
        isDraw: true,
        allPlayers: sortedPlayers
      }
    }
  }
  
  return null // Game continues
}

module.exports = {
  syncRoomGameState,
  checkGameEnd
}
