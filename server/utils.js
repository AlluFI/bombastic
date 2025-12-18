 function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

 const startPos = [
    { x: 1, y: 1, },
    { x: 1, y: 13 },
    { x: 11, y: 1 },
    { x: 11, y: 13 },
]
 const colors =[
    'blue',
    'red',
    'green',
    'yellow',
    'purple',
    'orange']

/**
 * Syncs room.players Map to room.gameState.players Array
 * This makes the room state compatible with NPCs
 */
 function syncRoomGameState(room) {
  room.gameState.players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    color: p.color,
    alive: p.alive !== false,  // Default: true
    score: p.score || 0,
    lives: p.lives || 1,
    isNPC: false,  // Human players
  }));
  
  // Also include NPCs in the players array
  room.npcs.forEach((npc, npcId) => {
    const npcPlayer = room.gameState.players.find(p => p.id === npcId);
    if (!npcPlayer) {
      room.gameState.players.push({
        id: npcId,
        name: npc.name,
        x: npc.position.x,
        y: npc.position.y,
        alive: npc.alive,
        score: npc.score,
        isNPC: true,
      });
    } else {
      // Update existing NPC player
      npcPlayer.x = npc.position.x;
      npcPlayer.y = npc.position.y;
      npcPlayer.alive = npc.alive;
      npcPlayer.score = npc.score;
    }
  });
}

/**
 * Processes an NPC action and updates room state
 */
 function handleNPCAction(room, roomId, npcId, action) {
  const npc = room.npcs.get(npcId);
  if (!npc) return;
  
  if (action.type === 'MOVE') {
    // Update NPC position
    const direction = action.direction;
    let newX = npc.position.x;
    let newY = npc.position.y;
    
    if (direction === 'UP') newY--;
    else if (direction === 'DOWN') newY++;
    else if (direction === 'LEFT') newX--;
    else if (direction === 'RIGHT') newX++;
    
    // Validate move (check board bounds, walls, etc.)
    // TODO: Add board validation when board is implemented
    
    npc.position.x = newX;
    npc.position.y = newY;
    
    // Update room.players Map
    const npcPlayer = room.players.get(npcId);
    if (npcPlayer) {
      npcPlayer.x = newX;
      npcPlayer.y = newY;
    }
    
    // Broadcast to room
    io.to(roomId).emit('player:moved', {
      id: npcId,
      x: newX,
      y: newY,
    });
    
  } else if (action.type === 'BOMB') {
    // Place bomb (same as player bomb placement)
    // TODO: Integrate with bomb system when implemented
    // For now, just log
    console.log(`NPC ${npcId} placed bomb at (${npc.position.x}, ${npc.position.y})`);
  }
 }

module.exports = {
  generateRoomCode,
  startPos,
  colors,
  syncRoomGameState,
  handleNPCAction
 }
