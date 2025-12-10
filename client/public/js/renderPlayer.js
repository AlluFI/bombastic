export function updatePlayerRender(player) {
    if(!player || !player.element) return

    player.updatePosition()
}