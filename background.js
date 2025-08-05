// Initialize icon state when extension loads
chrome.runtime.onStartup.addListener(async () => {
  await updateToolbarIcon(false);
});

chrome.runtime.onInstalled.addListener(async () => {
  await updateToolbarIcon(false);
  
  // Create context menu
  chrome.contextMenus.create({
    id: "showInstructions",
    title: "Show Instructions",
    contexts: ["action"]
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Skip restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      return;
    }
    
    // Check if content script is already injected
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    } catch (error) {
      // Inject the CSS and content scripts
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['pixel-perfect.css']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils.js', 'pixel-perfect.js']
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
    // Skip restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      return;
    }
    
    try {
      // Check if this page has stored URL data and active state
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return {
            url: localStorage.getItem('pxpUrl'),
            active: localStorage.getItem('pxpActive')
          };
        }
      });
      
      const data = results[0]?.result;
      
      if (data?.active === 'true') {
        
        // Inject CSS and content scripts
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['pixel-perfect.css']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['utils.js', 'pixel-perfect.js']
        });
        
        // Send message to auto-create overlay
        await chrome.tabs.sendMessage(tabId, { action: "autoCreateOverlay" });
      }
    } catch (error) {
      // Only log errors that aren't about restricted URLs or error pages
      if (!error.message.includes('chrome://') && 
          !error.message.includes('Cannot access') &&
          !error.message.includes('Frame with ID') &&
          !error.message.includes('showing error page')) {
        console.error('Error auto-injecting:', error);
      }
    }
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "showInstructions") {
    // Skip restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      return;
    }
    
    try {
      // Inject scripts if needed
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['pixel-perfect.css']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils.js', 'pixel-perfect.js']
      });
      
      // Send message to show instructions
      await chrome.tabs.sendMessage(tab.id, { action: "showInstructions" });
    } catch (error) {
      console.error('Error showing instructions:', error);
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "updateIcon") {
    updateToolbarIcon(request.active);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "errorCheckURL") {
    errorCheckURL(request.url).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('❌ Background: Error checking URL:', error);
      sendResponse({ 
        accessible: false, 
        error: 'Network error - Unable to reach server',
        type: 'network_error'
      });
    });
    return true;
  }
});

// Error check overlay URL
async function errorCheckURL(url) {
  try {
    // Add cache buster to prevent cached responses
    const cacheBusterUrl = url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now();
    
    // Try HEAD request first, fallback to GET if 502
    let response = await fetch(cacheBusterUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    // If HEAD returns 502, try GET request
    if (response.status === 502) {
      response = await fetch(cacheBusterUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    }
    
    // Success case
    if (response.status === 200) return { accessible: true };
    
    // HTTP error - server responded but with error status
    const errorMessages = {
      400: 'Bad Request - Invalid URL or parameters',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Access denied',
      404: '404 - Page Not Found',
      405: 'Method Not Allowed - Invalid request method',
      408: 'Request Timeout - Server took too long to respond',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Server Error - Internal server problem',
      502: 'Server Error - 502 Bad Gateway',
      503: 'Service Unavailable - Server maintenance',
      504: 'Gateway Timeout - Server response timeout'
    };
    
    const errorMessage = errorMessages[response.status] || `HTTP ${response.status} - ${response.statusText || 'Unknown error'}`;
    
    return { 
      accessible: false, 
      error: errorMessage,
      status: response.status,
      type: 'http_error'
    };
    
  } catch (error) {
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    const errorMessage = error.message.toLowerCase();
    
    // SSL/TLS certificate errors
    if (errorMessage.includes('err_cert_') || errorMessage.includes('ssl certificate') || 
        errorMessage.includes('cert_') || (url.startsWith('https://') && isLocalhost)) {
      return { 
        accessible: false, 
        error: url.startsWith('https://') && isLocalhost 
          ? 'HTTPS not working - Try HTTP instead'
          : 'SSL Certificate Error - HTTPS connection failed',
        type: 'ssl_error'
      };
    }
    
    // Connection refused - server is down
    if (errorMessage.includes('err_connection_refused') || 
        errorMessage.includes('err_name_not_resolved') ||
        errorMessage.includes('connection refused')) {
      return { 
        accessible: false, 
        error: 'Server not running - connection refused',
        type: 'connection_refused'
      };
    }
    
    // For localhost, handle special cases
    if (isLocalhost) {
      // CORS errors mean server is working
      if (errorMessage.includes('cors') || errorMessage.includes('access-control')) {
        return { accessible: true };
      }
      
      // Failed to fetch - check if it's a server error vs connection refused
      if (errorMessage.includes('failed to fetch')) {
        const fullError = error.toString();
        if (fullError.includes('502') || fullError.includes('Bad Gateway')) {
          return { 
            accessible: false, 
            error: 'Server Error - 502 Bad Gateway',
            type: 'http_error'
          };
        }
        return { 
          accessible: false, 
          error: 'Server not running - connection refused',
          type: 'connection_refused'
        };
      }
      
      // Any other localhost error - assume working
      return { accessible: true };
    }
    
    // Any other network error for non-localhost
    return { 
      accessible: false, 
      error: 'Network Error - Unable to reach server',
      type: 'network_error'
    };
  }
}

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

 