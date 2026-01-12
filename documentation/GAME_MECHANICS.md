# Game Mechanics Documentation

## Overview

This document describes the game mechanics, rules, and systems implemented in the Bomberman-style multiplayer game.

## Core Gameplay

### Grid System

- **Grid Size**: 13 rows × 15 columns
- **Tile Types**:
  - `0` = Walkable/Empty (players can move here)
  - `1` = Destructible Block (can be destroyed by bombs)
  - `2` = Indestructible Wall (permanent obstacle)

### Player Mechanics

#### Starting Conditions
- **Spawn Points**: 4 corners of the map
  - Top-left: (1, 1)
  - Top-right: (1, 13)
  - Bottom-left: (11, 1)
  - Bottom-right: (11, 13)
- **Lives**: 3 lives per player
- **Bomb Range**: Default 2 tiles
- **Bomb Limit**: 1 bomb at a time (initially)

#### Movement
- **Grid-based**: Players move one tile at a time
- **Animation**: Smooth CSS transitions (200ms per tile)
- **Controls**: Arrow keys or WASD
- **Collision**: Cannot move through blocks, walls, bombs, or other players

#### Damage System
- **Explosion Damage**: Players take 1 damage when hit by explosion
- **Invincibility**: 2 seconds after taking damage
- **Death**: Player eliminated when lives reach 0
- **Visual Feedback**: Flashing animation during invincibility

### Bomb Mechanics

#### Bomb Placement
- **Key**: Space bar
- **Cooldown**: Can only place 1 bomb at a time
- **Validation**: 
  - Must be on walkable tile
  - Cannot place on existing bomb
  - Cannot place on blocks or walls

#### Bomb Timer
- **Duration**: 3 seconds
- **Visual**: Bomb animation with countdown
- **Audio**: Ticking sound (optional)

#### Explosion
- **Shape**: Cross-shaped (up, down, left, right)
- **Range**: Default 2 tiles in each direction
- **Expansion**: Stops at indestructible walls
- **Block Destruction**: Destroys destructible blocks
- **Chain Reactions**: Explosions can trigger other bombs

#### Explosion Effects
- **Player Damage**: Players in explosion area take damage
- **Block Destruction**: Destructible blocks are destroyed
- **Power-up Spawning**: 30% chance per destroyed block
- **Visual**: Explosion animation (0.5 seconds)
- **Audio**: Explosion sound effect

### Block System

#### Block Types

**Destructible Blocks** (`1`):
- Can be destroyed by bomb explosions
- 30% chance to spawn power-up when destroyed
- Blocks player movement until destroyed

**Indestructible Walls** (`2`):
- Permanent obstacles
- Cannot be destroyed
- Blocks explosions and movement
- Arranged in checkerboard pattern

#### Block Destruction
- Triggered by bomb explosions
- Explosion stops at first block hit
- Block removed from board (becomes walkable)
- Server updates board state
- Broadcasts destruction to all clients

### Power-up System

#### Power-up Types

**Bomb Range** (`bomb_range`):
- Increases explosion range by 1 tile
- Stacks (can collect multiple)
- Visual: 💣 emoji

#### Power-up Spawning
- **Chance**: 30% per destroyed block
- **Max Power-ups**: `players × 4` (prevents overcrowding)
- **Position**: Spawns at destroyed block location
- **Visual**: Floating animation

#### Power-up Collection
- **Automatic**: Collected when player steps on it
- **Effect**: Immediately applied to player
- **Server Sync**: Server updates player stats
- **Visual**: Power-up removed from map
- **Audio**: Collection sound effect

#### NPC Power-up Collection
- NPCs detect power-ups when moving
- Server-side collection detection
- NPCs upgrade bomb range same as players
- NPCs prioritize power-ups based on difficulty

### Winning System

#### Winner Determination
- **Win Condition**: Last player standing (survival-based)
- **Ranking**: Based on elimination order
  - Winner = Last player eliminated (or last alive) = 1st place
  - Second-to-last eliminated = 2nd place
  - Third-to-last eliminated = 3rd place
  - First eliminated = Last place
- **Draw Condition**: All players eliminated simultaneously

#### Scoreboard Display
- Real-time scoreboard shows all players' lives
- Updates when players take damage or are eliminated
- Final rankings displayed on endgame screen (1st, 2nd, 3rd, 4th)

### Game Flow

#### Game Start
1. Players join room (2-4 players)
2. Host clicks "Start Game"
3. Server generates board
4. Players spawn at corners
5. Timer starts
6. Game loop begins

#### During Gameplay
- Players move and place bombs
- Bombs explode after 3 seconds
- Blocks are destroyed
- Power-ups spawn and are collected
- Players take damage and can be eliminated

#### Game End
- **Win Condition**: Last player standing (survival-based)
- **Draw Condition**: All players eliminated simultaneously
- **End Screen**: Shows winner and final rankings (1st, 2nd, 3rd, 4th based on elimination order)
- **Restart**: Return to main menu

### Timer System

- **Type**: Count-up timer
- **Display**: MM:SS format
- **Synchronization**: Server-authoritative
- **Pause**: Timer pauses when game is paused
- **Reset**: Timer resets on new game

### Pause System

#### Pause Mechanics
- **Key**: Escape key
- **Synchronization**: Pause state synced across all players
- **Display**: Shows player name who paused
- **Effects**: 
  - Game loop continues (no frame drops)
  - Player movement disabled
  - Timer paused
  - NPCs continue (cannot pause)

#### Resume
- **Key**: Escape key again, or click "Resume"
- **Synchronization**: All players resume together
- **Timer**: Resumes counting

#### Quit
- **Action**: Click "Quit" in pause menu
- **Effect**: Player leaves game, returns to main menu
- **Server**: Removes player from room
- **Other Players**: See "Player left" notification

## Multiplayer Mechanics

### Room System

#### Room Creation
- **Host**: First player creates room
- **Room Code**: 6-character alphanumeric (e.g., "ABC123")
- **Max Players**: 4 players per room
- **Lobby**: Waiting room before game starts

#### Room Joining
- **Room Code**: Enter code to join
- **Validation**: 
  - Room must exist
  - Room must not be full
  - Game must not have started
  - Single-player mode must not be active

#### Room State
- **Players**: Map of player IDs to player data
- **Game State**: Current game state (players, bombs, powerups, board)
- **Chat History**: Messages in the room
- **NPCs**: NPC instances (single-player mode only)

### Synchronization

#### Client-Side Prediction
- Players see their own movement immediately
- Server validates and corrects if needed
- Reduces perceived latency

#### Server Authority
- Server is authoritative for game state
- All actions validated server-side
- Server broadcasts state changes
- Prevents cheating

#### State Sync
- Full state sync on join
- Delta updates during gameplay
- Periodic full sync for consistency

## Single-Player Mechanics

### NPC System

#### NPC Behavior
- **Decision Making**: Every 100-300ms (based on difficulty)
- **Actions**: Move or place bomb
- **Targets**: Players, power-ups, blocks
- **Safety**: Avoids danger zones
- **Pathfinding**: Uses BFS algorithm

#### Difficulty Levels

**Easy**:
- Slow decisions (300ms interval)
- Low aggression (30%)
- High mistake rate (30%)
- Low power-up priority (40%)

**Medium**:
- Normal decisions (400ms interval)
- Balanced aggression (60%)
- Moderate mistake rate (15%)
- Moderate power-up priority (70%)

**Hard**:
- Fast decisions (300ms interval)
- High aggression (90%)
- Low mistake rate (5%)
- High power-up priority (95%)

#### NPC Power-up Collection
- NPCs detect power-ups when moving
- Server-side collection (same as players)
- NPCs upgrade bomb range
- NPCs prioritize power-ups based on strategy

### Single-Player Mode

#### Setup
- Select number of bots (1-3)
- Select difficulty level
- Game starts immediately (no lobby)

#### Gameplay
- Same rules as multiplayer
- NPCs behave like players
- NPCs cannot pause/quit
- Human player can pause/quit

## Visual Effects

### Animations

#### Player Movement
- Smooth CSS transitions
- 200ms per tile movement
- Direction-based sprites

#### Bomb
- Pulsing animation
- Countdown visual
- Ticking sound (optional)

#### Explosion
- Cross-shaped expansion
- Flash effect
- 0.5 second duration
- Sound effect

#### Power-up
- Floating animation
- Continuous loop
- Spawn sound effect

#### Damage
- Flashing animation during invincibility
- Death effect (grayscale, transparency)

### UI Animations
- Menu transitions
- Button hover effects
- Scoreboard updates
- Timer updates

## Audio System

### Sound Effects

See [Sound Manager Documentation](client/public/js/audio/README.md) for complete list.

**Key Sounds**:
- Bomb placement
- Explosion
- Player hit/death
- Power-up spawn/pickup
- UI interactions
- Game start/end

### Volume Controls
- Master volume
- SFX volume
- Music volume (if added)
- Mute toggle
- Persistent settings (localStorage)

## Performance

### Target Metrics
- **Frame Rate**: 60 FPS minimum
- **Network Updates**: 20 updates/second
- **Input Latency**: < 50ms
- **State Sync Latency**: < 100ms

### Optimization
- GPU-accelerated CSS transforms
- Minimal DOM reflows
- Audio object pooling
- Efficient state updates
- Server-side NPC decision intervals

## Future Enhancements

### Potential Features
- Additional power-up types (speed, bomb count, kick)
- Multiple game modes (time attack, team mode)
- Customizable controls
- Replay system
- Statistics tracking
- Leaderboards
