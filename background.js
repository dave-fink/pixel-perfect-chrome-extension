// remove screenshot stuff

// Initialize icon state when extension loads
chrome.runtime.onStartup.addListener(async () => {
  
  // Default to inactive state
  await updateToolbarIcon(false);
});

chrome.runtime.onInstalled.addListener(async () => {
  
  // Default to inactive state
  await updateToolbarIcon(false);
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Skip chrome:// URLs and other restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      console.log('Extension cannot run on this page type:', tab.url);
      return;
    }
    
    // Check if content script is already injected by trying to send a message
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    } catch (error) {
      // Inject the CSS first
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['pixel-perfect.css']
      });
      
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    }
    
    // Send message to toggle overlay
    await chrome.tabs.sendMessage(tab.id, { action: "toggleOverlay" });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Auto-inject content script when page loads with stored URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Skip chrome:// URLs and other restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      return;
    }
    
    try {
      // Check if this page has stored URL data and active state
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return {
            url: localStorage.getItem('pixelPerfectUrl'),
            active: localStorage.getItem('pixelPerfectActive')
          };
        }
      });
      
      const data = results[0]?.result;
      console.log('Auto-injection check for tab', tabId, ':', data);
      
      if (data?.active === 'true') {
        console.log('Auto-injecting content script for active extension');
        
        // Inject CSS and content script
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['pixel-perfect.css']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        // Send message to auto-create overlay
        await chrome.tabs.sendMessage(tabId, { action: "autoCreateOverlay" });
      } else {
        console.log('Extension not active or no data found');
      }
    } catch (error) {
      // Only log errors that aren't about restricted URLs
      if (!error.message.includes('chrome://') && !error.message.includes('Cannot access')) {
        console.error('Error auto-injecting:', error);
      }
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "updateIcon") {
    updateToolbarIcon(request.active);
    // Send response back to content script
    sendResponse({ success: true });
    return true; // Keep message channel open for response
  }
});

// Function to update toolbar icon
async function updateToolbarIcon(active) {
  try {
    if (active) {
      // Set colored icon globally
      await chrome.action.setIcon({
        path: {
          "16": "icons/pixel-perfect.png",
          "32": "icons/pixel-perfect.png",
          "48": "icons/pixel-perfect.png",
          "128": "icons/pixel-perfect.png"
        }
      });
    } else {
      // Set gray icon globally
      await chrome.action.setIcon({
        path: {
          "16": "icons/pixel-perfect-gray.png",
          "32": "icons/pixel-perfect-gray.png",
          "48": "icons/pixel-perfect-gray.png",
          "128": "icons/pixel-perfect-gray.png"
        }
      });
    }

  } catch (error) {
    console.error('Error updating toolbar icon:', error);
  }
}

 