import { createLocalPlayer,updatePlayerMovement } from "./player.js";

const player = createLocalPlayer()


function gameLoop() {
    updatePlayerMovement(player)
    requestAnimationFrame(gameLoop)
}

gameLoop()