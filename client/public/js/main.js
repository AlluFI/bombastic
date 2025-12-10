import { createLocalPlayer,updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { intializeMenu } from "./ui/menu.js";

intializeMenu()

const player = createLocalPlayer()

function gameLoop() {
    updatePlayerMovement(player)
    updatePlayerRender(player)
    requestAnimationFrame(gameLoop)
}

gameLoop()