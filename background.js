// Service worker for JSON Forge
// Minimal — handles install and context menu (Pro feature)

const INSTALL_URL = 'https://connorarutherford-create.github.io/json-forge/';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set install date for trial
    chrome.storage.sync.set({ installDate: Date.now() });
    // Open landing page on install
    chrome.tabs.create({ url: INSTALL_URL });
  }
});
