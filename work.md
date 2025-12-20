11.12 - Hasitha

Implemented functional structure for the main menu screen & pause menu screen
Player name need to have min 2 characters to start the game
pause game manue pops on escape key, hides on second escape press or resume
These functions are currently only implemented on client side need to be connected to socket and server.

12.12 - Joel
- fixed a bug where remote players would spawn at 0,0 to the new player.
- Pause is now synchronized between clients.
- Player can quit to main menu from pause menu.
- When lobby exceeds 4 player limit, the server alerts 'lobby is full' and does -not allow new players to join.

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

19.12- Hasitha
- Bomb placement implemented across local and remote player
- Prevention implemented to avoid placing another bomb when a bomb is already placed.
- extra security layer added to validate tiles before placing bombs

18.12. - Aleksi
- HTML (client/index.html):
  - Added single-player-section container for NPC count and difficulty
  - Added NPC count selector (1–3 bots)
  - Updated button text to "Start Single-Player Game"
- Menu logic (client/public/js/ui/menu.js):
  - Added NPC count selector handling
  - Updated handleStartGame() to emit room:host for single-player
  - Updated handleModeChange() to show/hide single-player UI
  - Added handleNPCCountChange() handler
  - Updated playerData to include npcCount
- Main game logic (client/public/js/main.js):
  - Updated room:created handler to configure NPCs after room creation
  - Emits set-game-mode and configure-npcs events
  - Updated room:updated handler to handle NPCs
  - Added handlers for npcs-configured and game-mode-changed events
- Scoreboard (client/public/js/ui/scoreboard.js):
  - Added "(Bot)" label for NPCs in the scoreboard
  - Added npc-player CSS class for styling
- Server (server/server.js):
  - Updated configure-npcs handler to emit room:updated after NPC configuration

19.12. - Aleksi
- Endgame screens implementation:
  - Added checkGameEnd function in server/utils.js to detect winner
  - Integrated winner detection in game loop (server/server.js)
  - Added game:end event emission when winner detected
  - Implemented client-side game:end handler to display winner screen
  - Added restart button functionality to return to menu
  - Support for both multiplayer and single-player modes
  - Handles draw scenario (all players eliminated)

20.12. - Aleksi
- Files changed:
  - client/public/js/main.js - Added game:end handler
  - client/public/js/ui/menu.js - Added restart button functionality
  - server/server.js - Integrated winner detection in game loop
  - server/utils.js - Added checkGameEnd function
