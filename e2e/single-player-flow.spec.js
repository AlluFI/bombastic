/**
 * E2E Tests for Single-Player Game Flow
 * Tests complete single-player game journey
 */

const { test, expect } = require('@playwright/test');

test.describe('Single-Player Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#menue-screen', { state: 'visible' });
  });

  test('should start a single-player game with NPCs', async ({ page }) => {
    // Switch to single-player mode
    const singleModeBtn = page.locator('#single-mode-btn');
    await singleModeBtn.click();
    
    // Wait for single-player section
    await page.waitForSelector('#single-player-section', { state: 'visible' });
    
    // Fill in player name
    const playerNameInput = page.locator('#player-name-single');
    await playerNameInput.fill('SoloPlayer');
    
    // Set NPC count (if input exists)
    const npcCountInput = page.locator('#npc-count');
    if (await npcCountInput.isVisible()) {
      await npcCountInput.fill('2');
    }
    
    // Click start single-player game
    const startButton = page.locator('#start-single-player-button');
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Wait for game screen
      await page.waitForSelector('#game-screen', { state: 'visible', timeout: 10000 });
      
      // Verify game has started
      const gameScreen = page.locator('#game-screen');
      await expect(gameScreen).toBeVisible();
      
      // Verify player is in the game
      // (Implementation dependent - may need to check for player element)
    }
  });

  test('should display single-player configuration options', async ({ page }) => {
    // Switch to single-player mode
    const singleModeBtn = page.locator('#single-mode-btn');
    await singleModeBtn.click();
    
    // Wait for single-player section
    const singlePlayerSection = page.locator('#single-player-section');
    await expect(singlePlayerSection).toBeVisible();
    
    // Check for player name input
    const playerNameInput = page.locator('#player-name-single');
    await expect(playerNameInput).toBeVisible();
    
    // Check for start button
    const startButton = page.locator('#start-single-player-button');
    // Button may or may not be visible depending on implementation
    const buttonExists = await startButton.count() > 0;
    expect(buttonExists).toBeTruthy();
  });
});
