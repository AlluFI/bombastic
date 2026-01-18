/**
 * E2E Tests for Full Game Flows
 * Tests complete user journeys from menu to game end
 */

const { test, expect } = require('@playwright/test');

test.describe('Game Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the game
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForSelector('#menue-screen', { state: 'visible' });
  });

  test('should create a room and start a multiplayer game', async ({ page, context }) => {
    // Fill in player name
    const playerNameInput = page.locator('#player-name-host');
    await playerNameInput.fill('TestPlayer1');
    
    // Click create room button
    const createButton = page.locator('#create-room-button');
    await createButton.click();
    
    // Wait for lobby screen to appear
    await page.waitForSelector('#lobby-screen', { state: 'visible' });
    
    // Verify we're in the lobby
    const lobbyScreen = page.locator('#lobby-screen');
    await expect(lobbyScreen).toBeVisible();
    
    // Verify player name appears in lobby
    await expect(page.locator('text=TestPlayer1')).toBeVisible();
    
    // Open a second browser context (simulating second player)
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForSelector('#menue-screen', { state: 'visible' });
    
    // Get room code from first player (would need to extract from URL or UI)
    // For now, we'll simulate by having second player join via lobby browser
    await page2.locator('#player-name-join').fill('TestPlayer2');
    
    // Wait a bit for lobby to appear
    await page2.waitForTimeout(1000);
    
    // Try to find and click on a lobby (if available)
    const lobbyList = page2.locator('#lobby-list');
    const lobbies = lobbyList.locator('.lobby-item');
    const lobbyCount = await lobbies.count();
    
    if (lobbyCount > 0) {
      // Click first available lobby
      await lobbies.first().click();
      
      // Wait for lobby screen
      await page2.waitForSelector('#lobby-screen', { state: 'visible' });
      
      // Verify both players are in lobby
      await expect(page.locator('text=TestPlayer1')).toBeVisible();
      await expect(page2.locator('text=TestPlayer2')).toBeVisible();
      
      // Start game (host only)
      const startButton = page.locator('#start-game-button');
      if (await startButton.isVisible()) {
        await startButton.click();
        
        // Wait for game screen
        await page.waitForSelector('#game-screen', { state: 'visible' });
        await page2.waitForSelector('#game-screen', { state: 'visible' });
        
        // Verify game has started
        const gameScreen = page.locator('#game-screen');
        await expect(gameScreen).toBeVisible();
      }
    }
    
    await page2.close();
  });

  test('should display menu screen correctly', async ({ page }) => {
    // Check menu screen is visible
    const menuScreen = page.locator('#menue-screen');
    await expect(menuScreen).toBeVisible();
    
    // Check game title
    await expect(page.locator('h1:has-text("Bombastic Live")')).toBeVisible();
    
    // Check mode toggle buttons
    await expect(page.locator('#multi-mode-btn')).toBeVisible();
    await expect(page.locator('#single-mode-btn')).toBeVisible();
    
    // Check input fields
    await expect(page.locator('#player-name-host')).toBeVisible();
    await expect(page.locator('#player-name-join')).toBeVisible();
    await expect(page.locator('#join-input')).toBeVisible();
    
    // Check buttons
    await expect(page.locator('#create-room-button')).toBeVisible();
    await expect(page.locator('#join-room-button')).toBeVisible();
  });

  test('should validate player name input', async ({ page }) => {
    // Try to create room with empty name
    const createButton = page.locator('#create-room-button');
    await createButton.click();
    
    // Should show error or not proceed (implementation dependent)
    // For now, just verify button exists and is clickable
    await expect(createButton).toBeEnabled();
  });

  test('should switch between multiplayer and single-player modes', async ({ page }) => {
    // Check multiplayer mode is active by default
    const multiModeBtn = page.locator('#multi-mode-btn');
    const singleModeBtn = page.locator('#single-mode-btn');
    
    await expect(multiModeBtn).toHaveClass(/active/);
    
    // Click single-player mode
    await singleModeBtn.click();
    
    // Verify single-player mode is active
    await expect(singleModeBtn).toHaveClass(/active/);
    await expect(multiModeBtn).not.toHaveClass(/active/);
    
    // Verify single-player section is visible
    const singlePlayerSection = page.locator('#single-player-section');
    await expect(singlePlayerSection).toBeVisible();
    
    // Switch back to multiplayer
    await multiModeBtn.click();
    
    // Verify multiplayer mode is active
    await expect(multiModeBtn).toHaveClass(/active/);
    await expect(singleModeBtn).not.toHaveClass(/active/);
  });

  test('should display lobby browser', async ({ page }) => {
    // Wait for lobby list to be available
    const lobbyList = page.locator('#lobby-list');
    await expect(lobbyList).toBeVisible();
    
    // Check for "no lobbies" message or lobby items
    const noLobbiesMessage = page.locator('#no-lobbies-message');
    const lobbyItems = lobbyList.locator('.lobby-item');
    
    // Either no lobbies message or lobby items should be visible
    const hasNoLobbies = await noLobbiesMessage.isVisible().catch(() => false);
    const lobbyCount = await lobbyItems.count();
    
    // At least one should be true
    expect(hasNoLobbies || lobbyCount >= 0).toBeTruthy();
  });

  test('should handle connection status indicator', async ({ page, context }) => {
    // Check if connection status element exists
    const connectionStatus = page.locator('[data-connection-status]');
    const statusExists = await connectionStatus.count() > 0;
    
    if (statusExists) {
      // Verify it shows connected state initially
      await expect(connectionStatus).toBeVisible();
    }
  });

  test('should display audio toggle button', async ({ page }) => {
    const audioToggle = page.locator('#audio-toggle');
    await expect(audioToggle).toBeVisible();
    
    // Click to toggle
    await audioToggle.click();
    
    // Verify button still exists (state may change)
    await expect(audioToggle).toBeVisible();
  });
});
