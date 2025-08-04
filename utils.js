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
  const syncUrlPathEnabled = localStorage.getItem('pixelPerfectSyncUrlPath') === 'true';
  
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

// Utility function to remove error message
function removeErrorMessage() {
  const errorOverlay = document.getElementById('pxp-error-message');
  if (errorOverlay) errorOverlay.remove();
}

// Centralized URL management
const pxpUrls = {
  getStoredUrl() {
    return localStorage.getItem('pixelPerfectUrl') || DEFAULT_URL;
  },
  setStoredUrl(url) {
    localStorage.setItem('pixelPerfectUrl', url);
  },
  getUrlWithPathSync() {
    const baseUrl = this.getStoredUrl();
    const syncUrlPath = pxpSettings.getSyncUrlPath();
    return syncUrlPath ? processUrlWithPathSync(baseUrl, window.location.pathname) : baseUrl;
  },
  getIframeUrl() {
    const url = this.getUrlWithPathSync();
    return url + (url.includes('?') ? '&' : '?') + CACHE_BUSTER_PARAM + '=' + Date.now();
  },
  getBaseUrl() {
    return this.getStoredUrl();
  }
};

// Centralized settings management
const pxpSettings = {
  getActive() {
    return localStorage.getItem('pixelPerfectActive') === 'true';
  },
  setActive(active) {
    localStorage.setItem('pixelPerfectActive', active.toString());
  },
  getOpacity() {
    return parseInt(localStorage.getItem('pixelPerfectOpacity')) || 100;
  },
  setOpacity(opacity) {
    localStorage.setItem('pixelPerfectOpacity', opacity.toString());
  },
  getInverted() {
    return localStorage.getItem('pixelPerfectInverted') === 'true';
  },
  setInverted(inverted) {
    localStorage.setItem('pixelPerfectInverted', inverted.toString());
  },
  getToggleState() {
    return localStorage.getItem('pixelPerfectOn') !== 'false'; // Default to true
  },
  setToggleState(state) {
    localStorage.setItem('pixelPerfectOn', state.toString());
  },
  getScrollMode() {
    return localStorage.getItem('pixelPerfectScrollMode') || 'both';
  },
  setScrollMode(mode) {
    localStorage.setItem('pixelPerfectScrollMode', mode);
  },
  getDockPosition() {
    return localStorage.getItem('pixelPerfectDockPosition') || 'top';
  },
  setDockPosition(position) {
    localStorage.setItem('pixelPerfectDockPosition', position);
  },
  getDarkTheme() {
    const saved = localStorage.getItem('pixelPerfectDarkTheme');
    return saved !== null ? saved === 'true' : true; // Default to true
  },
  setDarkTheme(dark) {
    localStorage.setItem('pixelPerfectDarkTheme', dark.toString());
  },
  getSyncUrlPath() {
    return localStorage.getItem('pixelPerfectSyncUrlPath') === 'true';
  },
  setSyncUrlPath(sync) {
    localStorage.setItem('pixelPerfectSyncUrlPath', sync.toString());
  }
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
    getPageHeight,
    processUrlWithPathSync,
    removeErrorMessage,
    throttle,
    pxpUrls,
    pxpSettings
  };
} 