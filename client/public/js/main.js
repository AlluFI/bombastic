import { createLocalPlayer,updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";

const player = createLocalPlayer()

function gameLoop() {
    updatePlayerMovement(player)
    updatePlayerRender(player)
    requestAnimationFrame(gameLoop)
}

gameLoop()