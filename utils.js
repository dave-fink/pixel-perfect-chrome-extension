// DOM Helper Functions
function domEl(tag, ...items) {
  const element = document.createElement(tag);
  if (!items?.length) return element;
  const [first, ...rest] = items;
  if (first && typeof first === 'object' && !(first instanceof Element)) {
    Object.entries(first).forEach(([key, value]) => {
      if (key === 'html') {
        element.innerHTML = value;
      } else if (key in element && typeof element[key] === 'boolean') {
        element[key] = value; // Use property for boolean attributes
      } else {
        element.setAttribute(key, Array.isArray(value) ? value.join(' ') : value);
      }
    });
    items = rest;
  }
  items.forEach(item => item != null && element.appendChild(item instanceof Element ? item : document.createTextNode(item)));
  return element;
}

function pxpEl(...items) { return domEl('pxp', ...items); }
function label(...items) { return domEl('label', ...items); }
function input(...items) { return domEl('input', ...items); }
function link(...items) { return domEl('link', ...items); }
function a(...items) { return domEl('a', ...items); }

// Utility function to get page height
function getPageHeight() {
  // DOCUMENT HEIGHT CALCULATION
  // ===========================
  // Different browsers and page layouts require checking multiple properties
  // to get the true document height (content that extends beyond viewport)
  
  const documentHeight = Math.max(
    document.body.scrollHeight,           // Total scrollable content height
    document.body.offsetHeight,           // Rendered height including borders
    document.documentElement.clientHeight, // Viewport height (visible area)
    document.documentElement.scrollHeight, // Total scrollable height (html element)
    document.documentElement.offsetHeight  // Rendered height including borders (html)
  );
  
  // SAFETY FALLBACK: Ensure we never return less than viewport height
  // This prevents the overlay from being smaller than what the user can see
  const viewportHeight = window.innerHeight || 1000; // 1000px fallback for edge cases
  
  return Math.max(documentHeight, viewportHeight);
}

// Utility function to process URLs with path syncing
function processUrlWithPathSync(baseUrl, currentPath) {
  const syncUrlPathEnabled = localStorage.getItem('pxpSyncUrlPath') === 'true';
  
  if (!syncUrlPathEnabled) {
    return baseUrl;
  }
  
  try {
    const urlObj = new URL(baseUrl);
    urlObj.pathname = currentPath;
    return urlObj.href;
  } catch (e) {
    // If baseUrl is not a valid URL, try to construct it
    if (baseUrl.includes('localhost')) {
      const portMatch = baseUrl.match(/localhost:(\d+)/);
      const port = portMatch ? portMatch[1] : '3000';
      return `http://localhost:${port}${currentPath}`;
    } else {
      // Fallback to localhost:3000 with current path
      return `http://localhost:3000${currentPath}`;
    }
  }
}

// Suppress noisy CORS errors in console (they're expected for iframe embedding)
function suppressCorsErrors() {
  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    
    // Filter out common CORS and iframe-related errors that are expected
    const corsPatterns = [
      'CORS',
      'Access to fetch',
      'blocked by CORS policy',
      'Access-Control-Allow-Origin',
      'Response to preflight request',
      'chrome-extension://'
    ];
    
    const shouldIgnore = corsPatterns.some(pattern => 
      message.includes(pattern)
    );
    
    if (!shouldIgnore) {
      originalError.apply(console, args);
    }
  };
}

// Auto-suppress CORS errors when utils.js loads
suppressCorsErrors();

const pxp = {
  // Update checking with caching
  updates: {
    async checkForUpdates(callback) {
      try {
        const cacheKey = 'pxpVersionCheck';
        const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        
        // Check cache first
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { timestamp, latestVersion, currentVersion } = JSON.parse(cached);
          
          // Use cached result if less than 24 hours old and same current version
          if (now - timestamp < cacheExpiry && currentVersion === chrome.runtime.getManifest().version) {
            const isNewer = this.compareVersions(latestVersion, currentVersion) > 0;
            callback(isNewer ? latestVersion : null);
            return;
          }
        }
        
        const currentVersion = chrome.runtime.getManifest().version;
        
        // Fetch latest version from GitHub
        const response = await fetch('https://raw.githubusercontent.com/dave-fink/pixel-perfect-chrome-extension/main/manifest.json');
        if (!response.ok) throw new Error('Failed to fetch latest version');
        
        const latestManifest = await response.json();
        const latestVersion = latestManifest.version;
        
        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: now,
          latestVersion,
          currentVersion
        }));
        
        const isNewer = this.compareVersions(latestVersion, currentVersion) > 0;
        
        // Console message for developers when new version is available
        if (isNewer) {
          console.log(`🚀 Pixel Perfect Extension: New version ${latestVersion} available! Download: https://github.com/dave-fink/pixel-perfect-chrome-extension`);
        }
        
        callback(isNewer ? latestVersion : null);
        
      } catch (error) {
    
        callback(null); // Return null on error
      }
    },
    
    compareVersions(a, b) {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      const maxLength = Math.max(aParts.length, bParts.length);
      
      for (let i = 0; i < maxLength; i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart > bPart) return 1;
        if (aPart < bPart) return -1;
      }
      return 0;
    }
  },

  // URL management
  urls: {
    getStoredUrl: () => localStorage.getItem('pxpUrl') || '',
    setStoredUrl: (url) => localStorage.setItem('pxpUrl', url),
    getUrlWithPathSync: () => {
      const baseUrl = pxp.urls.getStoredUrl();
      const syncUrlPath = pxp.settings.getSyncUrlPath();
      return syncUrlPath ? processUrlWithPathSync(baseUrl, window.location.pathname) : baseUrl;
    },
    getIframeUrl: () => {
      const url = pxp.urls.getUrlWithPathSync();
      return url + (url.includes('?') ? '&' : '?') + CACHE_BUSTER_PARAM + '=' + Date.now();
    },
    getBaseUrl: () => pxp.urls.getStoredUrl()
  },

  // Settings management
  settings: {
    getActive: () => localStorage.getItem('pxpActive') === 'true',
    setActive: (active) => localStorage.setItem('pxpActive', active.toString()),
    getOpacity: () => parseInt(localStorage.getItem('pxpOpacity')) || 100,
    setOpacity: (opacity) => localStorage.setItem('pxpOpacity', opacity.toString()),
    getInverted: () => localStorage.getItem('pxpInverted') === 'true',
    setInverted: (inverted) => localStorage.setItem('pxpInverted', inverted.toString()),
    getOverlayState: () => localStorage.getItem('pxpOverlayOn') !== 'false',
    setOverlayState: (state) => localStorage.setItem('pxpOverlayOn', state.toString()),
    getScrollMode: () => localStorage.getItem('pxpScrollMode') || 'both',
    setScrollMode: (mode) => localStorage.setItem('pxpScrollMode', mode),
    getDockPosition: () => localStorage.getItem('pxpDockPosition') || 'top',
    setDockPosition: (position) => localStorage.setItem('pxpDockPosition', position),
    getDarkTheme: () => {
      const saved = localStorage.getItem('pxpDarkTheme');
      return saved !== null ? saved === 'true' : true;
    },
    setDarkTheme: (dark) => localStorage.setItem('pxpDarkTheme', dark.toString()),
    getSyncUrlPath: () => localStorage.getItem('pxpSyncUrlPath') === 'true',
    setSyncUrlPath: (sync) => localStorage.setItem('pxpSyncUrlPath', sync.toString()),
    // for initial setup
    isFirstTime: () => localStorage.getItem('pxpActive') === null,
    hasOpacity: () => localStorage.getItem('pxpOpacity') !== null,
    hasInverted: () => localStorage.getItem('pxpInverted') !== null,
    hasScrollMode: () => localStorage.getItem('pxpScrollMode') !== null
  },

};

// Throttle function for performance
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    domEl,
    pxpEl,
    label,
    input,
    link,
    a,
    getPageHeight,
    processUrlWithPathSync,
    throttle,
    pxp
  };
} 