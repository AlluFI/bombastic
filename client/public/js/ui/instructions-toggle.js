/**
 * Instructions Toggle Module
 * Handles showing/hiding the instructions panel via info icon
 */

let isInitialized = false

/**
 * Initialize instructions toggle
 */
export function initializeInstructionsToggle() {
  if (isInitialized) return
  
  const infoToggle = document.getElementById('info-toggle')
  const instructionsPanel = document.getElementById('ins')
  
  if (!infoToggle || !instructionsPanel) {
    return
  }
  
  infoToggle.addEventListener('click', () => {
    const isExpanded = infoToggle.getAttribute('aria-expanded') === 'true'
    
    if (isExpanded) {
      // Hide instructions
      instructionsPanel.classList.add('hidden')
      infoToggle.setAttribute('aria-expanded', 'false')
    } else {
      // Show instructions
      instructionsPanel.classList.remove('hidden')
      infoToggle.setAttribute('aria-expanded', 'true')
    }
  })
  
  isInitialized = true
}
