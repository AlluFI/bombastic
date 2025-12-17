11.12 - Hasitha

Implemented functional structure for the main menu screen & pause menu screen
Player name need to have min 2 characters to start the game
pause game manue pops on escape key, hides on second escape press or resume
These functions are currently only implemented on client side need to be connected to socket and server.

12.12 - Joel
-fixed a bug where remote players would spawn at 0,0 to the new player.
-Pause is now synchronized between clients.
-Player can quit to main menu from pause menu.
-When lobby exceeds 4 player limit, the server alerts 'lobby is full' and does -not allow new players to join.

13.12 - Hasitha
- Implemented Heads up display with timer
- Time pausing and resuming implemented -> 
    -To be implemented
    * Tyme syncing across players
    * Reset time on quitting
- Scoreboard initialized but need to optimize for socket  

15.12
- implemented css for bombs
- bomb rendering and explosion implemented
- Test bomb placed in main.js at line 51

17.12 - Joel
- Implemented a room system on the server to allow multiple games to be played simultaneously.
- If client hosts a new game, a new room is created and the host is placed in that room and room ID is displayed on the game screen.
- Other players can join the host's game by entering the room ID on the main menu screen
- Added chat functionality for players in the same room to communicate with each other.

17.12. - Aleksi
- Copied npc folder to main branch.
  - Folder contains:
    - NPC.js - Main NPC class
    - DifficultyProfiles.js - Difficulty configurations
    - BehaviorStrategies.js - Behavior strategies
    - index.js - Module exports
    - test-npc.js - Test script
    - utils/Pathfinder.js - Pathfinding utilities
    - utils/DangerDetector.js - Danger detection utilities
    - utils/ItemEvaluator.js - Item evaluation utilities
- added config.js for feature flags
- Game state sync helper function (syncRoomGameState)
- Sync calls after room creation, player join, and player movement
- set-game-mode event handler
- configure-npcs event handler
- NPC Action Handler Function (handleNPCAction)
  - Processes NPC MOVE and BOMB actions
  - Updates NPC positions and broadcasts to room
  - Handles bomb placement (currently logs, TODO for integration)
- Room Join Handler Update
  - Added check to reject joins when room is in single-player mode
- Disconnect Handler Update
  - Added room cleanup logic
  - Removes player from room.players Map
  - Cleans up NPCs when host disconnects
  - Syncs game state and notifies room
- Game Loop (60 FPS)
  - Processes all running games
  - Syncs player state (Map → Array)
  - Updates NPCs in single-player mode
  - Calls NPC decision-making and action processing
  - Broadcasts game state to rooms
