// DOM Helper Functions
function domEl(tag, ...items) {
  const element = document.createElement(tag);
  if (!items?.length) return element;
  const [first, ...rest] = items;
  if (first && typeof first === 'object' && !(first instanceof Element)) {
    Object.entries(first).forEach(([key, value]) =>
      key.startsWith('on')
        ? element.addEventListener(key.slice(2).toLowerCase(), value)
        : element.setAttribute(key, Array.isArray(value) ? value.join(' ') : value)
    );
    items = rest;
  }
  items.forEach(item => item != null && element.appendChild(item instanceof Element ? item : document.createTextNode(item)));
  return element;
}

function div(...items) { return domEl('div', ...items); }
function span(...items) { return domEl('span', ...items); }
function label(...items) { return domEl('label', ...items); }
function input(...items) { return domEl('input', ...items); }
function img(...items) { return domEl('img', ...items); }
function link(...items) { return domEl('link', ...items); }
function a(...items) { return domEl('a', ...items); }
function b(...items) { return domEl('b', ...items); }
function ol(...items) { return domEl('ol', ...items); }
function li(...items) { return domEl('li', ...items); }

// Utility function to get page height
function getPageHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight,
    window.innerHeight
  );
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





// Centralized pxp namespace object
const pxp = {
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
    setSyncUrlPath: (sync) => localStorage.setItem('pxpSyncUrlPath', sync.toString())
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
    div,
    span,
    label,
    input,
    img,
    link,
    a,
    b,
    ol,
    li,
    getPageHeight,
    processUrlWithPathSync,
    throttle,
    pxp
  };
} 