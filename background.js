chrome.action.onClicked.addListener(async (tab) => {
  try {
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
    
    // Send message to toggle overlay
    await chrome.tabs.sendMessage(tab.id, { action: "toggleOverlay" });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Listen for messages from content script to capture screenshots
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === "captureScreenshot") {
    captureScreenshot(request.url, sender.tab.id);
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

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