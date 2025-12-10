export const keys = {
    up: false,
    down: false,
    left: false,
    right: false
}

window.addEventListener('keydown', (e) =>{
    if (e.repeat) return //avoid long press issues

    if (e.key === 'ArrowUp') keys.up = true
    if (e.key === 'ArrowDown') keys.down = true
    if (e.key === 'ArrowLeft') keys.left = true
    if (e.key === 'ArrowRight') keys.right = true
})

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') keys.up = false
    if (e.key === 'ArrowDown') keys.down = false
    if (e.key === 'ArrowLeft') keys.left = false
    if (e.key === 'ArrowRight') keys.right = false
})