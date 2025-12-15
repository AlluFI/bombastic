11.12 - Hasitha

Implemented functional structure for the main menu screen & pause menu screen
Player name need to have min 2 characters to start the game
pause game manue pops on escape key, hides on second escape press or resume
These functions are currently only implemented on client side need to be connected to socket and server.

12.12 - Joel
-fixed a bug where remote players would spawn at 0,0 to the new player.
-Pause is now synchronized between clients.
-Player can quit to main menu from pause menu.
-When lobby exceeds 4 player limit, the server alerts 'lobby is full' and does -not allow new players to join.¨

-next up: room system.
