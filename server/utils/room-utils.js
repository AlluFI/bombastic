/**
 * Room Management Utilities
 * Functions for room code generation, player positioning, colors, and lobby management
 */

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const startPos = [
  { x: 1, y: 1, },
  { x: 1, y: 13 },
  { x: 11, y: 1 },
  { x: 11, y: 13 },
]

const colors = [
  'blue',
  'red',
  'green',
  'yellow',
  'purple',
  'orange'
]

/**
 * Find the next available color index that's not already taken
 * @param {Map} players - Map of existing players
 * @returns {number} - Index of the next available color
 */
function getNextAvailableColorIndex(players) {
  const usedColors = new Set(Array.from(players.values()).map(p => p.color))
  for (let i = 0; i < colors.length; i++) {
    if (!usedColors.has(colors[i])) {
      return i
    }
  }
  // Fallback: if all colors are used, return the count (will wrap around)
  return players.size % colors.length
}

/**
 * Find the next available starting position index that's not already taken
 * @param {Map} players - Map of existing players
 * @returns {number} - Index of the next available position
 */
function getNextAvailablePositionIndex(players) {
  const usedPositions = new Set(
    Array.from(players.values()).map(p => `${p.x},${p.y}`)
  )
  for (let i = 0; i < startPos.length; i++) {
    const posKey = `${startPos[i].x},${startPos[i].y}`
    if (!usedPositions.has(posKey)) {
      return i
    }
  }
  // Fallback: if all positions are used, return the count
  return players.size % startPos.length
}

function getActiveLobbies(rooms) {
  const activeLobbies = []
  
  rooms.forEach((room, roomCode) => {
    // Only include multiplayer lobbies that haven't started
    if (room.gameState.gameMode === 'multiplayer' && !room.gameState.isRunning) {
      const playerCount = room.players.size
      const maxPlayers = 4 // Max players per room
      
      // Only show if not full
      if (playerCount < maxPlayers) {
        activeLobbies.push({
          roomCode: roomCode,
          playerCount: playerCount,
          maxPlayers: maxPlayers
        })
      }
    }
  })
  
  return activeLobbies
}

function broadcastLobbyUpdate(io, rooms) {
  const activeLobbies = getActiveLobbies(rooms)
  io.emit('lobby:updated', { lobbies: activeLobbies })
}

module.exports = {
  generateRoomCode,
  startPos,
  colors,
  getNextAvailableColorIndex,
  getNextAvailablePositionIndex,
  getActiveLobbies,
  broadcastLobbyUpdate
}
