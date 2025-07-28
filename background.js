// Initialize icon state when extension loads
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up, checking icon state');
  // Default to inactive state
  await updateToolbarIcon(false);
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed, setting default icon state');
  // Default to inactive state
  await updateToolbarIcon(false);
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check if content script is already injected by trying to send a message
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
      console.log('Content script already injected, sending toggle message');
    } catch (error) {
      console.log('Content script not found, injecting...');
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
      console.log('Skipping auto-injection for restricted URL:', tab.url);
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
      if (data?.url && data?.active === 'true') {
        console.log('Found stored URL and active state, auto-injecting content script');
        
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
        await chrome.tabs.sendMessage(tabId, { action: "toggleOverlay" });
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
  console.log('Background received message:', request);
  
  if (request.action === "captureScreenshot") {
    captureScreenshot(request.url, sender.tab.id);
    // Return true to indicate we'll send a response asynchronously
    return true;
  } else if (request.action === "updateIcon") {
    console.log('Background: Updating toolbar icon to:', request.active ? 'colored' : 'gray');
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
          "16": "pixel-perfect.png",
          "32": "pixel-perfect.png",
          "48": "pixel-perfect.png",
          "128": "pixel-perfect.png"
        }
      });
    } else {
      // Set gray icon globally
      await chrome.action.setIcon({
        path: {
          "16": "pixel-perfect-gray.png",
          "32": "pixel-perfect-gray.png",
          "48": "pixel-perfect-gray.png",
          "128": "pixel-perfect-gray.png"
        }
      });
    }
    console.log('Icon updated globally, extension is now:', active ? 'active' : 'inactive');
  } catch (error) {
    console.error('Error updating toolbar icon:', error);
  }
}

async function captureScreenshot(url, originalTabId) {
  console.log('Starting screenshot capture for:', url);
  
  try {
    // Create a new tab with the target URL
    const newTab = await chrome.tabs.create({
      url: url,
      active: false // Open in background
    });
    
    console.log('Created new tab:', newTab.id);
    
    // Wait for the page to load
    await new Promise(resolve => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          console.log('Tab loaded completely');
          resolve();
        }
      });
    });
    
    // Wait a bit more for any dynamic content to load
    console.log('Waiting for dynamic content...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Capture the screenshot
    console.log('Capturing screenshot...');
    const screenshotUrl = await chrome.tabs.captureVisibleTab(newTab.windowId, {
      format: 'png',
      quality: 100
    });
    
    console.log('Screenshot captured, URL length:', screenshotUrl.length);
    
    // Close the temporary tab
    await chrome.tabs.remove(newTab.id);
    console.log('Temporary tab closed');
    
    // Send the screenshot back to the content script
    console.log('Sending screenshot to content script...');
    await chrome.tabs.sendMessage(originalTabId, {
      action: "screenshotCaptured",
      imageUrl: screenshotUrl
    });
    
    console.log('Screenshot sent successfully');
    
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    // Send error back to content script
    try {
      await chrome.tabs.sendMessage(originalTabId, {
        action: "screenshotError",
        error: error.message
      });
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
  }
} 