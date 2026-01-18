/**
 * Keyboard Navigation Support
 * Ensures all interactive elements are accessible via keyboard
 */

/**
 * Initialize keyboard navigation support
 */
export function initializeKeyboardNavigation() {
  // Ensure all buttons are focusable and have proper tabindex
  const buttons = document.querySelectorAll('button')
  buttons.forEach(button => {
    if (!button.hasAttribute('tabindex')) {
      button.setAttribute('tabindex', '0')
    }
  })

  // Ensure all inputs are properly accessible
  const inputs = document.querySelectorAll('input, select, textarea')
  inputs.forEach(input => {
    if (!input.hasAttribute('tabindex')) {
      input.setAttribute('tabindex', '0')
    }
  })

  // Add Enter key support for buttons (in case they're not in forms)
  document.addEventListener('keydown', (e) => {
    // Enter key activates focused button
    if (e.key === 'Enter' && document.activeElement.tagName === 'BUTTON') {
      const button = document.activeElement
      if (!button.disabled) {
        button.click()
        e.preventDefault()
      }
    }

    // Space key activates focused button (when not in input)
    if (e.key === ' ' && document.activeElement.tagName === 'BUTTON') {
      const button = document.activeElement
      if (!button.disabled && document.activeElement.tagName !== 'INPUT') {
        button.click()
        e.preventDefault()
      }
    }
  })

  // Add keyboard support for mode toggle buttons
  const modeToggle = document.querySelector('.mode-toggle')
  if (modeToggle) {
    const tabs = modeToggle.querySelectorAll('[role="tab"]')
    tabs.forEach((tab, index) => {
      tab.addEventListener('keydown', (e) => {
        let targetIndex = index

        // Arrow key navigation
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault()
          if (e.key === 'ArrowRight') {
            targetIndex = (index + 1) % tabs.length
          } else {
            targetIndex = (index - 1 + tabs.length) % tabs.length
          }
          tabs[targetIndex].focus()
          tabs[targetIndex].click()
        }

        // Home/End keys
        if (e.key === 'Home') {
          e.preventDefault()
          tabs[0].focus()
          tabs[0].click()
        }
        if (e.key === 'End') {
          e.preventDefault()
          tabs[tabs.length - 1].focus()
          tabs[tabs.length - 1].click()
        }
      })
    })
  }
}

/**
 * Make an element focusable and add keyboard support
 * @param {HTMLElement} element - Element to make accessible
 * @param {string} role - ARIA role
 */
export function makeAccessible(element, role = null) {
  if (element.tagName !== 'BUTTON' && element.tagName !== 'INPUT' && element.tagName !== 'SELECT' && element.tagName !== 'TEXTAREA') {
    element.setAttribute('tabindex', '0')
    element.setAttribute('role', role || 'button')
    
    // Add keyboard event listener
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        element.click()
      }
    })
  }
}
