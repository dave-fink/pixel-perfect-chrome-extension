// Global error state management
let currentError = null;

// Show error in settings panel
function showErrorInSettings(url, errorDetails = '') {
  currentError = {url, errorDetails};

  // Open settings menu to show error
  const settingsMenu = document.getElementById('settings-menu');
  if (settingsMenu) {
    settingsMenu.classList.add('active');
  }

  // Add error class to overlay if it exists
  const overlay = document.getElementById('pxp-overlay');
  if (overlay) overlay.classList.add('error');

  // Update error display in settings
  updateSettingsErrorDisplay(url, errorDetails);
}

// Update error display in settings panel
function updateSettingsErrorDisplay(url, errorDetails) {
  // Remove existing error message
  const existingError = document.querySelector('.url-error-message');
  if (existingError) existingError.remove();

  // Add error class to input wrapper
  const urlInput = document.querySelector('#url-input');
  const inputWrapper = urlInput?.parentNode;
  if (inputWrapper) inputWrapper.classList.add('error'); 

  // Create new error message
  const errorElement = div({class: 'url-error-message'},
    span({class: 'error-title'}, errorDetails),
  );

  // Insert error message inside the URL input container as the last item
  const urlInputContainer = document.querySelector('.url-input-container');
  if (urlInputContainer) urlInputContainer.appendChild(errorElement);
}

// Clear error display
function clearSettingsError() {
  currentError = null;

  // Remove error message
  const existingError = document.querySelector('.url-error-message');
  if (existingError) existingError.remove();

  // Remove error class from input wrapper
  const urlInput = document.querySelector('#url-input');
  const inputWrapper = urlInput?.parentNode;
  if (inputWrapper) inputWrapper.classList.remove('error');

  // Remove error class from overlay
  const overlay = document.getElementById('pxp-overlay');
  if (overlay) overlay.classList.remove('error');
}

// Legacy function for backward compatibility
function showErrorMessage(url, errorDetails = '') {
  showErrorInSettings(url, errorDetails);
}

// Check if content script is already running
if (window.pixelPerfectScriptLoaded) {
  throw new Error('Content script already loaded');
}

window.pixelPerfectScriptLoaded = true;

// Constants
const URL_PLACEHOLDER = 'Enter overlay URL';
const CACHE_BUSTER_PARAM = 'cb';
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
const HEIGHT_CHECK_DELAY = 100;
const SCROLL_SYNC_THROTTLE = 16;

let pxpOverlay = null;
let pxpControls = null;
let pxpIframe = null;
let pxpIsInverted = false;
let pxpLastOpacityValue = 100;
let pxpScrollMode = 'both'; // Will be initialized from storage in createOverlay()
let pxpIsActive = false;
let originalFavicon = null;

function updateBrowserTab(isActive) {
  // Store original favicon on first call
  if (!originalFavicon) {
    const existingFavicon = document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel="apple-touch-icon"]');
    originalFavicon = existingFavicon ? existingFavicon.href : null;
  }

  if (isActive) {
    // Update page title to show extension is active
    const originalTitle = document.title;
    if (!originalTitle.includes('(px)')) {
      document.title = '(px) ' + originalTitle;
    }

    // Create canvas for favicon overlay
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 32;
    canvas.height = 32;

    // Load original favicon or create a default one
    const originalFaviconImg = new Image();
    originalFaviconImg.crossOrigin = 'anonymous';

    originalFaviconImg.onload = () => {
      // Draw original favicon in grayscale
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(originalFaviconImg, 0, 0, 32, 32);
      ctx.filter = 'none';

      // Load extension icon
      const extensionIcon = new Image();
      extensionIcon.crossOrigin = 'anonymous';
      extensionIcon.onload = () => {
        ctx.drawImage(extensionIcon, 10, 10, 22, 22);

        // Create new favicon link with overlay
        const overlayFavicon = canvas.toDataURL();
        const existingFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        existingFavicons.forEach(favicon => favicon.remove());

        const newFavicon = link({rel: 'icon', href: overlayFavicon, id: 'pixel-perfect-favicon'});
        document.head.appendChild(newFavicon);
      };
      extensionIcon.src = chrome.runtime.getURL('icons/favicon-dot.png');
    };

    originalFaviconImg.onerror = () => {
      // Try current page favicon
      const currentFavicon = document.querySelector('link[rel="icon"]') ||
        document.querySelector('link[rel="shortcut icon"]') ||
        document.querySelector('link[rel="apple-touch-icon"]');

      if (currentFavicon && currentFavicon.href !== originalFavicon) {
        originalFaviconImg.src = currentFavicon.href;
        return;
      }

      // Try root favicon.ico
      fetch(window.location.origin + '/favicon.ico', {method: 'HEAD'})
        .then(response => {
          if (response.ok) {
            originalFaviconImg.src = window.location.origin + '/favicon.ico';
          } else {
            throw new Error('Root favicon not found');
          }
        })
        .catch(() => updateFavicon());
    };

    function updateFavicon() {
      const domain = window.location.hostname;
      const initial = domain.charAt(0).toUpperCase();

      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#666';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(initial, 16, 22);

      const extensionIcon = new Image();
      extensionIcon.crossOrigin = 'anonymous';
      extensionIcon.onload = () => {
        ctx.drawImage(extensionIcon, 10, 10, 22, 22);

        const overlayFavicon = canvas.toDataURL();
        const existingFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        existingFavicons.forEach(favicon => favicon.remove());

        const newFavicon = link({rel: 'icon', href: overlayFavicon, id: 'pixel-perfect-favicon'});
        document.head.appendChild(newFavicon);
      };
      extensionIcon.src = chrome.runtime.getURL('icons/favicon-dot.png');
    }

    if (originalFavicon) {
      originalFaviconImg.src = originalFavicon;
    } else {
      const anyFavicon = document.querySelector('link[rel="icon"]') ||
        document.querySelector('link[rel="shortcut icon"]') ||
        document.querySelector('link[rel="apple-touch-icon"]');

      if (anyFavicon) {
        originalFaviconImg.src = anyFavicon.href;
      } else {
        originalFaviconImg.onerror();
      }
    }

  } else {
    // Restore original page title
    const currentTitle = document.title;
    if (currentTitle.includes('(px)')) {
      document.title = currentTitle.replace('(px) ', '');
    }

    // Remove extension favicon
    const extensionFavicon = document.getElementById('pixel-perfect-favicon');
    if (extensionFavicon) extensionFavicon.remove();

    // Restore original favicon by recreating the link
    if (originalFavicon) {
      const originalFaviconLink = link({rel: 'icon', href: originalFavicon});
      document.head.appendChild(originalFaviconLink);
    }
  }
}


// Debounced scroll sync for better performance
let scrollSyncTimeout;
let lastScrollY = 0; // Cache last scroll position to avoid unnecessary updates

function syncIframeScroll() {
  if (pxpIframe && pxpScrollMode === 'both') {
    const mainScrollY = window.scrollY;
    // Only update if scroll position actually changed
    if (mainScrollY !== lastScrollY) {
      pxpIframe.style.transform = `translateY(-${mainScrollY}px)`;
      lastScrollY = mainScrollY;
    }
  }
}

function globalWheelHandler(e) {
  if (pxpIframe && pxpIframe.style.opacity !== '0') {
    const scrollAmount = e.deltaY;

    if (pxpScrollMode === 'both') {
      // Use throttled sync for smooth performance
      clearTimeout(scrollSyncTimeout);
      scrollSyncTimeout = setTimeout(syncIframeScroll, 16); // ~60fps
    } else if (pxpScrollMode === 'original') {
      // Only scroll main page, iframe stays at current position
      // Don't change iframe position - let it stay where it is
    } else if (pxpScrollMode === 'overlay') {
      // Only scroll iframe, prevent main page scroll completely
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Use requestAnimationFrame for smooth iframe scrolling
      requestAnimationFrame(() => {
        const storedMainScrollY = pxpIframe.dataset.mainPageScrollY || '0';
        window.scrollTo(0, parseInt(storedMainScrollY));

        const currentTransform = pxpIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        const newY = currentY - scrollAmount;

        if (newY <= 0 && newY >= -10000) { // Simple boundary check
          pxpIframe.style.transform = `translateY(${newY}px)`;
        }
      });
      return false; // Prevent event from bubbling up
    }
  }
}

// Add arrow key handler for fine-tuned scrolling
function arrowKeyHandler(e) {
  if (pxpIframe && pxpIframe.style.opacity !== '0') {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); // Prevent default arrow key behavior

      const scrollAmount = e.key === 'ArrowUp' ? -1 : 1; // 1px at a time

      if (pxpScrollMode === 'both') {
        // Scroll both together
        const mainScrollY = window.scrollY - scrollAmount;
        window.scrollTo(0, Math.max(0, mainScrollY));
        pxpIframe.style.transform = `translateY(-${Math.max(0, mainScrollY)}px)`;
      } else if (pxpScrollMode === 'original') {
        // Only scroll main page
        const mainScrollY = window.scrollY - scrollAmount;
        window.scrollTo(0, Math.max(0, mainScrollY));
      } else if (pxpScrollMode === 'overlay') {
        // Only scroll iframe
        const currentTransform = pxpIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        const newY = currentY - scrollAmount;

        if (newY <= 0 && newY >= -10000) {
          pxpIframe.style.transform = `translateY(${newY}px)`;
        }
      }
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({status: 'ok'});
  } else if (request.action === "toggleOverlay") {
    toggleOverlay();
  } else if (request.action === "autoCreateOverlay") {

    // Auto-create overlay without toggling state
    if (!pxpOverlay) {
      createOverlay();
      pxpIsActive = true;
      // Store active state
      pxp.settings.setActive(true);
      // Update toolbar icon to colored
      chrome.runtime.sendMessage({action: 'updateIcon', active: true}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending updateIcon message:', chrome.runtime.lastError);
        }
      });

      updateBrowserTab(true);
    }
  } else if (request.action === "showInstructions") {
    showInstructions();
  }
});

// Function to show instructions overlay
function showInstructions() {
  // Create overlay if it doesn't exist
  if (!pxpOverlay) createOverlay();

  // Add instructions class to overlay
  pxpOverlay.classList.add('instructions');

  // Remove any existing instructions overlay first
  const existingInstructions = document.getElementById('pxp-instructions-overlay');
  if (existingInstructions) existingInstructions.remove();

  // Check if this is first-time user
  const isFirstTimeForInstructions = pxp.settings.isFirstTime();

  // Create and show instructions overlay
  const instructionsOverlay = div({id: 'pxp-instructions-overlay'});

  const instructionsContent = div({id: 'pxp-instructions'},
    div({class: 'pxp-title'},
      img({
        src: chrome.runtime.getURL('icons/pixel-perfect.svg'),
        style: 'width: 34px; height: 34px; margin-right: 12px; vertical-align: middle;'
      }),
      'Pixel Perfect Overlay'
    ),
    div({class: 'pxp-description'},
      'Overlay your local development page over any live page to quickly identify layout differences and adjust with precision.'
    ),
    div({class: 'pxp-steps'},
      ol({},
        li('Enter your development ', b('Overlay URL')),
        li('Play with the ', b('opacity'), ' and ', b('invert'), ' colors'),
        li(b('Align'), ' elements ', b('instantly'), ' as you develop'),
        li(b('Toggle on/off'), ' to compare - ', b('no more tab switching!')),
      )
    ),
    div({class: 'pxp-button'}, 'Get started!'),
  );

  instructionsOverlay.appendChild(instructionsContent);
  document.body.appendChild(instructionsOverlay);

  // Close instructions when clicking the button
  instructionsContent.querySelector('.pxp-button').addEventListener('click', () => {
    instructionsOverlay.remove();
    if (pxpOverlay) pxpOverlay.classList.remove('instructions');

    // For first-time users, show settings menu and ensure extension is OFF
    if (isFirstTimeForInstructions) {
      const settingsMenuElement = document.getElementById('settings-menu');
      if (settingsMenuElement) settingsMenuElement.classList.add('active');
    }
  });
}

// Check if we should auto-create overlay on page load
function autoRestoreOverlay() {
  const storedUrl = pxp.urls.getStoredUrl();
  const isActive = pxp.settings.getActive();

  // If no active state is stored, default to active (true)
  // This ensures the extension works when localStorage is cleared
  const shouldBeActive = isActive;



  if (shouldBeActive) {
    // Longer delay to ensure page is fully loaded and extension is ready
    setTimeout(() => {
      if (!pxpOverlay) {

        createOverlay();
        pxpIsActive = true;
        // Store active state
        pxp.settings.setActive(true);
        // Update toolbar icon to colored
        chrome.runtime.sendMessage({action: 'updateIcon', active: true}, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending updateIcon message:', chrome.runtime.lastError);
          }
        });

        // Update favicon to show extension is active
        updateBrowserTab(true);
      }
    }, 500);
  }
}

// Try multiple events to ensure we catch the page load
document.addEventListener('DOMContentLoaded', autoRestoreOverlay);
window.addEventListener('load', autoRestoreOverlay);

// Also try on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoRestoreOverlay);
} else {
  // Document is already loaded, try immediately
  autoRestoreOverlay();
}

function toggleOverlay() {
  // Check if overlay actually exists in DOM
  const overlayInDOM = document.getElementById('pxp-overlay');
  const controlsInDOM = document.getElementById('pxp-controls');

  if (pxpOverlay || overlayInDOM || controlsInDOM) {
    if (pxpOverlay) pxpOverlay.remove();
    if (overlayInDOM) overlayInDOM.remove();
    if (controlsInDOM) controlsInDOM.remove();

    // Remove error message if it exists
    clearSettingsError();

    // Reset iframe display in case it was hidden due to error
    if (pxpIframe) pxpIframe.style.display = '';

    // Remove error class from overlay
    if (pxpOverlay) pxpOverlay.classList.remove('error');

    pxpControls = null;
    pxpIframe = null;
    pxpOverlay = null;
    pxpIsInverted = false;
    pxpLastOpacityValue = 100;
    pxpIsActive = false;

    // Remove event listeners
    document.removeEventListener('wheel', globalWheelHandler);
    document.removeEventListener('keydown', arrowKeyHandler);

    window.removeEventListener('scroll', throttle(syncIframeScroll, 16));

    // Store inactive state
    pxp.settings.setActive(false);
    // Update toolbar icon to gray
    chrome.runtime.sendMessage({action: 'updateIcon', active: false}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });

    // Restore original favicon
    updateBrowserTab(false);
  } else {
    // Create overlay and restore previous state
    createOverlay();
    pxpIsActive = true;
    // Store active state
    pxp.settings.setActive(true);
    // Update toolbar icon to colored
    chrome.runtime.sendMessage({action: 'updateIcon', active: true}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });

    // Update favicon to show extension is active
    updateBrowserTab(true);
  }
}

function loadOverlayIframe() {
  // Get URL with cache buster
  const overlayURL = pxp.urls.getIframeUrl();

  // Ensure DOM is ready (especially for hard refreshes)
  const initialHeight = getPageHeight();
  pxpIframe = domEl('iframe', {
    src: overlayURL,
    style: 'height: ' + initialHeight + 'px;',
    sandbox: IFRAME_SANDBOX,
    'data-cache-buster': Date.now().toString()
  });

  // Add iframe load event to sync scroll position
  pxpIframe.addEventListener('load', () => {
    // Sync iframe scroll position with main page scroll position
    const mainScrollY = window.scrollY;
    pxpIframe.style.transform = `translateY(-${mainScrollY}px)`;
  });

  // Add iframe error event to catch loading failures
  pxpIframe.addEventListener('error', () => {
    showErrorInSettings(pxpIframe.src.split('?')[0], 'Failed to load overlay URL');
  });

  // Apply invert filter if previously saved
  if (pxp.settings.getInverted()) {
    pxpIsInverted = true;
    pxpIframe.style.filter = 'invert(1)';
    pxpIframe.style.backgroundColor = 'white'; // Add white background for inversion
  }

  // Apply stored opacity to iframe
  const iframeOpacity = pxp.settings.getOpacity();
  if (iframeOpacity !== 100) {
    const opacity = iframeOpacity / 100;
    pxpIframe.style.opacity = opacity;
    pxpLastOpacityValue = iframeOpacity;
  }

  return pxpIframe;
}

function createOverlay() {
  // Restore stored state values
  pxpLastOpacityValue = pxp.settings.getOpacity();
  pxpIsInverted = pxp.settings.getInverted();
  pxpScrollMode = pxp.settings.getScrollMode();



  // Save initial values to localStorage if they don't exist (ensures defaults are persisted)
  if (!pxp.settings.hasOpacity()) {
  
    pxp.settings.setOpacity(pxpLastOpacityValue);
  }
  if (!pxp.settings.hasInverted()) {
  
    pxp.settings.setInverted(pxpIsInverted);
  }
  if (!pxp.settings.hasScrollMode()) {
  
    pxp.settings.setScrollMode(pxpScrollMode);
  }

  // Get URL with path syncing applied
  const iframeUrl = pxp.urls.getUrlWithPathSync();

  pxpOverlay = div({id: 'pxp-overlay'});

  // Load the iframe using the reusable function
  pxpIframe = loadOverlayIframe();


  // IFRAME HEIGHT MANAGEMENT
  // ========================
  // The overlay iframe must cover the entire document height, not just the viewport.
  // This ensures the overlay is visible when scrolling beyond the initial viewport.
  
  // Get initial document height (includes content below fold)
  const initialHeight = getPageHeight();
  
  // Watch for document size changes (content loading, dynamic elements, etc.)
  const resizeObserver = new ResizeObserver(() => {
    if (pxpIframe) {
      const newHeight = getPageHeight();
      
      // CRITICAL: Only allow height to INCREASE, never decrease
      // This prevents infinite shrinking loops where:
      // 1. iframe shrinks → document height decreases
      // 2. ResizeObserver fires → iframe shrinks more
      // 3. Repeat until iframe disappears
      if (newHeight > initialHeight) pxpIframe.style.height = newHeight + 'px';
    }
  });
  
  // Observe document.body for size changes (most reliable element for height detection)
  resizeObserver.observe(document.body);
  
  // FALLBACK: Double-check height after initial load
  // Some pages load content asynchronously, so we recheck after a delay
  // This ensures we catch any content that loads after initial DOM creation
  setTimeout(() => {
    if (pxpIframe) {
      const currentHeight = getPageHeight();
      pxpIframe.style.height = currentHeight + 'px';
    }
  }, HEIGHT_CHECK_DELAY);


  pxpControls = div({id: 'pxp-controls', class: 'top'}); // Default to top positioning

  const pxpIcon = div({id: 'pixel-perfect-icon'});
  pxpIcon.innerHTML = `
    <svg viewBox="0 0 217.95 218.4">
      <text class="txt" transform="translate(62 130.14) scale(.97 1)"><tspan x="0" y="0">px</tspan></text>
      <path class="ring" d="M217.95,104.2h-11.9c-2.52-49.7-42.37-89.56-92.07-92.07V0h-10v12.12C54.27,14.64,14.42,54.5,11.9,104.2H0v10h11.9c2.52,49.7,42.37,89.56,92.07,92.07v12.12h10v-12.12c49.7-2.52,89.56-42.37,92.07-92.07h11.9v-10ZM113.97,196.25v-26.4h-10v26.4c-44.11-2.51-79.55-37.94-82.05-82.05h26.53v-10h-26.53C24.43,60.09,59.86,24.65,103.97,22.14v26.4h10v-26.4c44.11,2.51,79.55,37.94,82.05,82.05h-26.53v10h26.53c-2.51,44.11-37.94,79.55-82.05,82.05Z"/>
    </svg>
  `;

  // Add click handler to toggle overlay state
  pxpIcon.addEventListener('click', function () {
    const currentState = pxp.settings.getOverlayState();
    setOverlayState(!currentState);
  });


  // Set input value to stored URL or default
  const inputStoredUrl = pxp.urls.getStoredUrl();
  let inputUrl = inputStoredUrl;


  // Check if Sync URL Path is enabled
  const syncUrlPathEnabled = pxp.settings.getSyncUrlPath();
  if (syncUrlPathEnabled) {
    // Get current page URL path
    const currentUrl = window.location.href;
    const currentPath = new URL(currentUrl).pathname;

    // Parse the base URL to get domain and port
    try {
      const inputUrlObj = new URL(inputUrl);
      // Update the path while keeping domain and port
      inputUrlObj.pathname = currentPath;
      inputUrl = inputUrlObj.href;
    } catch (e) {
      // If inputUrl is not a valid URL, try to construct it
      if (inputUrl.includes('localhost')) {
        const portMatch = inputUrl.match(/localhost:(\d+)/);
        const port = portMatch ? portMatch[1] : '3000';
        inputUrl = `http://localhost:${port}${currentPath}`;
      } else {
        // Fallback to localhost:3000 with current path
        inputUrl = `http://localhost:3000${currentPath}`;
      }
    }
  }

  const urlInput = input({
    id: 'url-input',
    type: 'text',
    placeholder: URL_PLACEHOLDER,
    value: inputUrl || '',
    title: 'Overlay URL',
    autocomplete: 'off'
  });

  // Add focus class only when input is empty (placeholder shown)
  if (!inputUrl) urlInput.classList.add('focus');

  const urlGoIcon = div({id: 'url-go-icon'});
  urlGoIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12.293 5.293a1 1 0 011.414 1.414L10.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4z" transform="rotate(180 10 10)"/></svg>';
  
  const urlErrorIcon = div({id: 'url-error-icon'});
  urlErrorIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M10 2C5.6 2 2 5.6 2 10s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm1 13H9v-2h2v2zm0-3H9V6h2v6z"/></svg>';

  const urlLockIcon = div({ id: 'url-lock-icon' });
  urlLockIcon.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 10V8C6 5.79 7.79 4 10 4H14C16.21 4 18 5.79 18 8V10H19C19.55 10 20 10.45 20 11V19C20 19.55 19.55 20 19 20H5C4.45 20 4 19.55 4 19V11C4 10.45 4.45 10 5 10H6ZM8 8V10H16V8C16 6.9 15.1 6 14 6H10C8.9 6 8 6.9 8 8Z"/></svg>';

  const urlNewWindowIcon = div({ class: 'url-new-window-icon' });
  urlNewWindowIcon.innerHTML = '<svg viewBox="0 0 358.05 355.34" xmlns="http://www.w3.org/2000/svg"><path d="M22.04,57.84v276.49h276v-188.15c0-7.87,16.35-12.88,20.24-3.24l.21,206.31c-1.9,3.82-5.55,6.05-9.9,6.09l-300.58-.52c-3.99-1.48-6.2-3.52-7.29-7.7L0,50.31c-.01-5.4,1.38-10,6.3-12.68h206.49c9.66,3.89,4.64,20.21-3.24,20.21H22.04Z"/><path d="M335.04,36.88l-167.96,167.23c-10.59,7.64-23.19-4.39-15.05-15.02L320.04,20.9h-73.5c-.69,0-4.56-2.71-5.36-3.63-4.72-5.48-2.25-16.06,5.42-17.27l104.18.7c4.22,2.29,6.1,7.05,6.3,11.68-2.52,29.69,3.28,64.7-.15,93.76-.74,6.29-3.58,11.12-10.51,11.56-4.78.3-11.37-4.69-11.37-9.45V36.88Z"/></svg>';

   // Centralized URL validation and state management
  const urlInputHandler = {
    // State tracking
    lastUrlValue: '',

    // Update all icons (URL input icons + new-window icon)
    updateUrlInputIcons(url) {
      const storedUrl = pxp.urls.getStoredUrl();
      const hasChanged = url.trim() !== storedUrl;
      const isEmpty = !url.trim();
      const hasErrorMessage = document.querySelector('.url-error-message');

      // Add 'changed' class to wrapper when URL has changed
      const inputWrapper = urlInput.parentNode;
      if (hasChanged && !isEmpty) inputWrapper.classList.add('changed');
      else inputWrapper.classList.remove('changed');

      // Update new-window icon
      this.newWindowIcon(url);
    },

    // Show hide new-window icon
    newWindowIcon(url) {
      const storedUrl = pxp.urls.getStoredUrl();
      const hasStoredUrl = storedUrl && storedUrl.trim();
      const urlMatchesStored = url && url.trim() === storedUrl;
      
      // Show new-window icon when we have a stored URL and input matches it
      if (hasStoredUrl && urlMatchesStored && url !== URL_PLACEHOLDER) urlNewWindowIcon.classList.add('active');
      else urlNewWindowIcon.classList.remove('active');
    },

    // Handle URL submission (Enter key or go icon click)
    submitUrl(url) {
      if (!url.trim()) return;

      // Save URL and update all icons
      pxp.urls.setStoredUrl(url);
      this.updateUrlInputIcons(url);

      // Check for errors and show message below input
      chrome.runtime.sendMessage({action: "errorCheckURL", url}, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && !response.accessible) {
          // Hide existing iframe when URL is bad
          if (pxpIframe) pxpIframe.style.display = 'none';
          
          // Show error in settings panel (menu stays open)
          showErrorInSettings(url, response.error || 'Unable to access URL');
          // Update icons with error state
          this.updateUrlInputIcons(url);
        } else {
          // Clear any existing errors
          clearSettingsError();
          
          // Hide settings menu if it was open due to error
          const settingsMenu = document.getElementById('settings-menu');
          if (settingsMenu) settingsMenu.classList.remove('active');
          
          // Update iframe with new URL without reloading page
          if (pxpIframe) pxpIframe.remove();
          pxpIframe = loadOverlayIframe();
          pxpOverlay.appendChild(pxpIframe);

          // Ensure iframe is visible (in case it was hidden from previous error)
          pxpIframe.style.display = '';

          // Turn overlay ON after successful URL submission
          setOverlayState(true);
        }
      });
    },

    // Handle input changes
    handleInput(url) {
      // Handle empty input
      if (!url.trim()) {
        const inputWrapper = urlInput.parentNode;
        if (inputWrapper) inputWrapper.classList.remove('error');
        urlInput.classList.add('focus');
        urlInput.title = '';
        clearSettingsError();
        this.updateUrlInputIcons('');
        return;
      }

      // Remove focus and clear error message
      urlInput.classList.remove('focus');
      const existingError = document.querySelector('.url-error-message');
      if (existingError) existingError.remove();

      // Track URL changes
      this.lastUrlValue = url;

      // Check URL for errors using background script
      chrome.runtime.sendMessage({action: "errorCheckURL", url}, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && !response.accessible) {
          // Show error state on wrapper
          const inputWrapper = urlInput.parentNode;
          if (inputWrapper) inputWrapper.classList.add('error');
          // Add error tooltip
          // urlInput.title = `Error: ${response.error || 'Unable to access URL'}`;
        } else {
          // Only clear error state if validation passes
          const inputWrapper = urlInput.parentNode;
          if (inputWrapper) inputWrapper.classList.remove('error');
          // urlInput.title = '';
        }

        // Update icons after error check is complete
        this.updateUrlInputIcons(url);
      });
    },

    // Initialize error state for stored URL if invalid
    initIconState() {
      const storedUrl = pxp.urls.getStoredUrl();
      if (storedUrl && storedUrl.trim()) {
        // Check if stored URL is valid and set error state if needed
        chrome.runtime.sendMessage({action: "errorCheckURL", url: storedUrl}, (response) => {
          if (chrome.runtime.lastError) return;
          
          if (response && !response.accessible) {
            // Set error state AND update icons to show error icon
            showErrorInSettings(storedUrl, response.error || 'Unable to access URL');
            this.updateUrlInputIcons(storedUrl);
          }
        });
      }
    }
  };

  
  // Update lock icon visibility and input state
  const updateUrlPathSyncState = () => {
    const syncUrlPathEnabled = pxp.settings.getSyncUrlPath();
    const inputWrapper = urlInput.parentNode;
    
    if (syncUrlPathEnabled) {
      inputWrapper.classList.add('locked');
      urlInput.readOnly = true;
    } else {
      inputWrapper.classList.remove('locked');
      urlInput.readOnly = false;
    }
  };
  
  urlInputHandler.initIconState();

  // Input change handler
  urlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    urlInputHandler.handleInput(url);
  });

  // Enter key handler
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const url = urlInput.value.trim();
      urlInputHandler.submitUrl(url);
    }
  });

  // Go icon click handler
  urlGoIcon.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) urlInputHandler.submitUrl(url);
  });

  // Error icon click handler
  // urlErrorIcon.addEventListener('click', () => {
  //   if (pxpIframe?.src) {
  //     const baseUrl = pxpIframe.src.split('?')[0];
  //     window.open(baseUrl, '_blank');
  //   }
  // });

  // Label icon click handler (open URL in new tab)
  urlNewWindowIcon.addEventListener('click', () => {
    const storedUrl = pxp.urls.getStoredUrl();
    if (storedUrl) window.open(storedUrl, '_blank');
  });

  // Get stored opacity value or default to 100
  const initialValue = pxp.settings.getOpacity();

  const sliderContainer = div({id: 'opacity-slider'},
    div({id: 'slider-track'}),
    div({id: 'slider-fill'}),
    div({id: 'slider-thumb'})
  );

  // Get references to slider elements
  const sliderThumb = sliderContainer.querySelector('#slider-thumb');
  const sliderFill = sliderContainer.querySelector('#slider-fill');

  // Set percentage text to match stored opacity
  const opacityValue = pxp.settings.getOpacity().toString();
  const value = span({id: 'opacity-value', title: 'Current opacity value'}, opacityValue + '%');

  // Add invert toggle button
  const invertBtn = div({class: 'invert btn'}, 'Invert');

  // Restore invert state from localStorage
  if (pxp.settings.getInverted()) {
    pxpIsInverted = true;
    invertBtn.classList.add('active');
  }

  // Add scroll mode custom dropdown
  const options = [
    {value: 'both', text: 'Scroll Both', selected: pxpScrollMode === 'both'},
    {value: 'original', text: 'Scroll Page', selected: pxpScrollMode === 'original'},
    {value: 'overlay', text: 'Scroll Overlay', selected: pxpScrollMode === 'overlay'}
  ];

  const scrollModeDropdown = div({id: 'scroll-mode-dropdown'},
    ...options.map(option =>
      div({
          class: `pxp-dropdown-option ${option.selected ? 'selected' : ''}`,
          'data-value': option.value
        },
        span({class: 'checkmark'}, option.selected ? '✓' : ''),
        span({}, option.text)
      )
    )
  );

  // Get the text for the selected scroll mode
  const selectedOption = options.find(option => option.selected);
  const selectedText = selectedOption ? selectedOption.text : 'Scroll Both';

  const scrollModeSelect = div({
      class: 'scroll-mode-select btn',
      title: 'Select scroll mode'
    },
    span({}, selectedText),
    scrollModeDropdown
  );

  // Add on/off toggle switch
  // Start in OFF state initially - will be set to ON when valid URL is submitted
  const onOffToggle = label({
      class: 'on-off switch',
      title: 'Toggle overlay on/off',
      style: 'margin-right: 8px;'
    },
    input({type: 'checkbox', checked: false}),
    span({class: 'slider round'})
  );

  // Add on/off class based on toggle state
  const toggleInput = onOffToggle.querySelector('input');

  const updateControlsClass = () => {
    if (pxpControls && toggleInput) {
      pxpControls.classList.remove('on', 'off');
      pxpControls.classList.add(toggleInput.checked ? 'on' : 'off');
    }
  };

  // Centralized function to handle overlay state changes
  const setOverlayState = (isOn) => {
    // Update toggle input
    toggleInput.checked = isOn;

    // Update control classes
    updateControlsClass();

    if (isOn) {
      // Show overlay and restore opacity
      pxpOverlay.classList.remove('off');

      // Re-enable all controls
      sliderContainer.classList.remove('disabled');
      sliderContainer.style.pointerEvents = 'auto';
      urlInput.disabled = false;
      scrollModeSelect.disabled = false;

      // Restore last opacity (default to 100% for first time)
      const targetOpacity = pxpLastOpacityValue || 100;
      sliderThumb.style.left = targetOpacity + '%';
      sliderFill.style.width = targetOpacity + '%';
      const opacity = targetOpacity / 100;
      pxpIframe.style.opacity = opacity;
      value.textContent = targetOpacity + '%';

      // Update the global variable to ensure consistency
      pxpLastOpacityValue = targetOpacity;

      // Check if URL is blank or has error - if so, open settings menu
      const storedUrl = pxp.urls.getStoredUrl();
      const hasBlankUrl = !storedUrl || !storedUrl.trim();
      const hasErrorMessage = document.querySelector('.url-error-message');
      
      if (hasBlankUrl || hasErrorMessage) {
        // Open settings menu
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu) settingsMenu.classList.add('active');
      }

      // Check server status when turning ON
      if (pxpIframe && pxpIframe.src) {
        const baseUrl = pxpIframe.src.split('?')[0];
        chrome.runtime.sendMessage({action: "errorCheckURL", url: baseUrl}, (response) => {
          if (chrome.runtime.lastError) return;

          if (response && !response.accessible) {
            pxpIframe.classList.add('off');
            showErrorInSettings(baseUrl, response.error);
          } else {
            pxpIframe.classList.remove('off');
            clearSettingsError();
          }
        });
      }
    } else {
      // Store current opacity before turning off
      const currentLeft = parseFloat(sliderThumb.style.left) || 0;
      pxpLastOpacityValue = Math.round(currentLeft);

      // Hide overlay
      pxpOverlay.classList.add('off');

      // Disable slider functionality but keep other controls enabled
      sliderContainer.classList.add('disabled');
      sliderContainer.style.pointerEvents = 'none';
      urlInput.disabled = false;
      scrollModeSelect.disabled = false;

      // Move slider to 0 and set 50% opacity for OFF state
      sliderThumb.style.left = '0%';
      sliderFill.style.width = '0%';
      // TESTING pxpIframe.style.opacity = '0.5';
      value.textContent = 'OFF';

      // Hide error message if it exists
      const errorOverlay = document.getElementById('pxp-error-message');
      if (errorOverlay) errorOverlay.remove();
    }

    // Save state to localStorage
    pxp.settings.setOverlayState(isOn);
  };

  // Add toggle event handler
  toggleInput.addEventListener('change', function () {
    setOverlayState(toggleInput.checked);
  });


  // Settings burger icon
  const settingsBtn = div({class: 'settings-burger', title: 'Settings'});
  settingsBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  settingsBtn.addEventListener('click', function () {
    const isVisible = settingsMenu.classList.contains('active');
    settingsMenu.classList.toggle('active', !isVisible);
  });

  // Add close button
  const closeBtn = div({id: 'close-btn', title: 'Close overlay'}, '×');
  closeBtn.addEventListener('click', function () {
    toggleOverlay();
  });

  // Add open overlay button
  const openOverlay = div({
    id: 'open-overlay',
    title: 'Open overlay in new tab',
    innerHTML: innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15,3 21,3 21,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    onclick: () => {
      if (pxpIframe && pxpIframe.src) {
        window.open(pxpIframe.src, '_blank');
      }
    }
  });

  // Set initial position
  sliderThumb.style.left = initialValue + '%';
  sliderFill.style.width = initialValue + '%';

  let isSliderDragging = false;
  let sliderStartX = 0;
  let sliderStartLeft = 0;

  sliderThumb.addEventListener('mousedown', function (e) {
    isSliderDragging = true;
    sliderStartX = e.clientX;
    sliderStartLeft = parseFloat(sliderThumb.style.left) || 0;
    document.addEventListener('mousemove', onSliderMouseMove);
    document.addEventListener('mouseup', onSliderMouseUp);
  });

  // Add touch support for slider thumb
  sliderThumb.addEventListener('touchstart', function (e) {
    e.preventDefault();
    isSliderDragging = true;
    const touch = e.touches[0];
    sliderStartX = touch.clientX;
    sliderStartLeft = parseFloat(sliderThumb.style.left) || 0;
    document.addEventListener('touchmove', onSliderTouchMove, {passive: false});
    document.addEventListener('touchend', onSliderTouchEnd, {passive: false});
  });

  sliderContainer.addEventListener('click', function (e) {
    if (!isSliderDragging) {
      const rect = sliderContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = (clickX / rect.width) * 100;
      const clampedPercentage = Math.max(0, Math.min(100, percentage));

      sliderThumb.style.left = clampedPercentage + '%';
      sliderFill.style.width = clampedPercentage + '%';
      updateOpacity(clampedPercentage);
    }
  });

  // Add touch support for slider container
  sliderContainer.addEventListener('touchstart', function (e) {
    if (!isSliderDragging) {
      e.preventDefault();
      const rect = sliderContainer.getBoundingClientRect();
      const touch = e.touches[0];
      const touchX = touch.clientX - rect.left;
      const percentage = (touchX / rect.width) * 100;
      const clampedPercentage = Math.max(0, Math.min(100, percentage));

      sliderThumb.style.left = clampedPercentage + '%';
      sliderFill.style.width = clampedPercentage + '%';
      updateOpacity(clampedPercentage);
    }
  }, {passive: false});

  // Snap function - snaps to 50% if within 3% range
  function snapToFifty(value) {
    const snapTarget = 50;
    const snapRange = 3;
    
    if (Math.abs(value - snapTarget) <= snapRange) {
      return snapTarget;
    }
    return value;
  }

  function onSliderMouseMove(e) {
    if (!isSliderDragging) return;

    const rect = sliderContainer.getBoundingClientRect();
    const deltaX = e.clientX - sliderStartX;
    const newLeft = sliderStartLeft + (deltaX / rect.width) * 100;
    const clampedLeft = Math.max(0, Math.min(100, newLeft));
    
    // Apply snap to 50% if within range
    const snappedLeft = snapToFifty(clampedLeft);

    sliderThumb.style.left = snappedLeft + '%';
    sliderFill.style.width = snappedLeft + '%';
    updateOpacity(snappedLeft);
  }

  function onSliderMouseUp() {
    isSliderDragging = false;
    document.removeEventListener('mousemove', onSliderMouseMove);
    document.removeEventListener('mouseup', onSliderMouseUp);
  }

  function onSliderTouchMove(e) {
    if (!isSliderDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = sliderContainer.getBoundingClientRect();
    const deltaX = touch.clientX - sliderStartX;
    const newLeft = sliderStartLeft + (deltaX / rect.width) * 100;
    const clampedLeft = Math.max(0, Math.min(100, newLeft));
    
    // Apply snap to 50% if within range
    const snappedLeft = snapToFifty(clampedLeft);

    sliderThumb.style.left = snappedLeft + '%';
    sliderFill.style.width = snappedLeft + '%';
    updateOpacity(snappedLeft);
  }

  function onSliderTouchEnd() {
    isSliderDragging = false;
    document.removeEventListener('touchmove', onSliderTouchMove);
    document.removeEventListener('touchend', onSliderTouchEnd);
  }

  function updateOpacity(percentage) {
    const opacity = percentage / 100;
    pxpIframe.style.opacity = opacity;
    value.textContent = Math.round(percentage) + '%';
    pxpLastOpacityValue = Math.round(percentage);
    pxp.settings.setOpacity(Math.round(percentage));
  }

  // Toggle event handler is now set up above with setOverlayState function

  invertBtn.addEventListener('click', function () {
    pxpIsInverted = !pxpIsInverted;

    if (pxpIsInverted) {
      pxpIframe.style.filter = 'invert(1)';
      pxpIframe.style.backgroundColor = 'white'; // Add white background for inversion
      this.classList.add('active');
    } else {
      pxpIframe.style.filter = 'none';
      pxpIframe.style.backgroundColor = 'transparent'; // Remove any background
      this.classList.remove('active');
    }

    // Save invert setting to localStorage
    pxp.settings.setInverted(pxpIsInverted);
  });

  // Add scroll mode custom dropdown functionality
  scrollModeSelect.addEventListener('click', function (e) {
    e.stopPropagation();
    const dropdown = this.querySelector('#scroll-mode-dropdown');
    const isVisible = dropdown.classList.contains('show');

    // Close all other dropdowns
    document.querySelectorAll('#scroll-mode-dropdown.show').forEach(d => {
      if (d !== dropdown) d.classList.remove('show');
    });

    // Toggle this dropdown
    dropdown.classList.toggle('show');
  });

  // Handle dropdown option clicks
  scrollModeDropdown.addEventListener('click', function (e) {
    // Find the dropdown option that was clicked (could be the target or a parent)
    const dropdownOption = e.target.closest('.pxp-dropdown-option');

    if (dropdownOption) {
      e.stopPropagation(); // Prevent event from bubbling up to button click

      const newMode = dropdownOption.dataset.value;
      pxpScrollMode = newMode;
      pxp.settings.setScrollMode(newMode);

      // Update button text
      const buttonText = scrollModeSelect.querySelector('span');
      buttonText.textContent = dropdownOption.querySelector('span:last-child').textContent;

      // Update selected state
      this.querySelectorAll('.pxp-dropdown-option').forEach(option => {
        option.classList.remove('selected');
        option.querySelector('.checkmark').textContent = '';
      });
      dropdownOption.classList.add('selected');
      dropdownOption.querySelector('.checkmark').textContent = '✓';

      // Close dropdown
      this.classList.remove('show');

      // Apply scroll mode
      if (newMode === 'both') {
        // Both scroll together - sync iframe with current page scroll
        const mainScrollY = window.scrollY;
        pxpIframe.style.transform = `translateY(-${mainScrollY}px)`;
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } else if (newMode === 'original') {
        // Only original page scrolls - keep iframe at current position
        const currentTransform = pxpIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        pxpIframe.style.transform = `translateY(${currentY}px)`;
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } else if (newMode === 'overlay') {
        // Only iframe scrolls - fix main page scroll position
        pxpIframe.dataset.mainPageScrollY = window.scrollY.toString();
        // Calculate scrollbar width and compensate to prevent layout jump
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = scrollbarWidth + 'px';
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!scrollModeSelect.contains(e.target)) {
      scrollModeDropdown.classList.remove('show');
    }
  });

  // Create settings menu
  const settingsMenu = div({ id: 'settings-menu' });

  // Add URL input setting (first option)
  const urlOption = div({class: 'settings-option url-option'},
    div({class: 'url-label'}, 
      'Overlay URL',
      urlNewWindowIcon
    ),
    div({class: 'url-input-container'},
      div({class: 'input-wrapper'},
        urlInput,
        urlGoIcon,
        urlErrorIcon,
        urlLockIcon
      )
    )
  );

  // Add dock setting
  const dockOption = div({class: 'settings-option'},
    span({class: 'settings-text'}, 'Dock'),
    div({class: 'dock-buttons'},
      div({class: 'dock-btn', 'data-position': 'top'}, '⊤'),
      div({class: 'dock-btn', 'data-position': 'bottom'}, '⊥')
    )
  );


  // dark theme setting
  const darkThemeToggle = input({type: 'checkbox', id: 'dark-theme-toggle', checked: pxp.settings.getDarkTheme()});
  const darkThemeOption = div({class: 'settings-option'},
    span({class: 'settings-text'}, 'Dark theme'),
    label({class: 'switch'},
      darkThemeToggle,
      span({class: 'slider round'})
    )
  );

  // Dark theme toggle event listener
  darkThemeToggle.addEventListener('change', function() {
    const isDark = this.checked;
    pxp.settings.setDarkTheme(isDark);

    // Apply theme to controls
    if (isDark) {
      pxpControls.classList.add('dark-theme');
      pxpControls.classList.remove('light-theme');
    } else {
      pxpControls.classList.add('light-theme');
      pxpControls.classList.remove('dark-theme');
    }
  });

  // Sync URL path setting
  const syncUrlPathToggle = input({type: 'checkbox', id: 'sync-url-path-toggle', checked: pxp.settings.getSyncUrlPath()});
  const syncUrlPathOption = div({class: 'settings-option'},
    span({class: 'settings-text'}, 'Sync URL path'),
    label({class: 'switch'},
      syncUrlPathToggle,
      span({class: 'slider round'})
    )
  );

  // Sync URL path toggle event listener
  syncUrlPathToggle.addEventListener('change', function() {
    const isSyncEnabled = this.checked;
    pxp.settings.setSyncUrlPath(isSyncEnabled);
    updateUrlPathSyncState();

    if (isSyncEnabled) {
      // Check if current overlay URL path matches the page URL path
      const currentPageUrl = window.location.href;
      const currentPagePath = new URL(currentPageUrl).pathname;

      const storedOverlayUrl = pxp.urls.getStoredUrl();
      let overlayUrlPath;

      try {
        const overlayUrlObj = new URL(storedOverlayUrl);
        overlayUrlPath = overlayUrlObj.pathname;
      } catch (e) {
        // If stored URL is not valid, default to root path
        overlayUrlPath = '/';
      }

      // Compare paths (normalize by removing trailing slash)
      const normalizedPagePath = currentPagePath.replace(/\/$/, '') || '/';
      const normalizedOverlayPath = overlayUrlPath.replace(/\/$/, '') || '/';

      if (normalizedPagePath !== normalizedOverlayPath) {
        // Update the URL input field to show the synced path
        const newOverlayUrl = pxp.urls.getUrlWithPathSync();
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
          urlInput.value = newOverlayUrl;
          pxp.urls.setStoredUrl(newOverlayUrl);
        }

        // Update the iframe URL to match the current page path
        // Reload the iframe
        pxpIframe.remove();
        pxpIframe = loadOverlayIframe();
        pxpOverlay.appendChild(pxpIframe);
      }
    } else {
      // Sync is enabled but paths already match - still need to check if stored URL needs updating
      const currentStoredUrl = pxp.urls.getStoredUrl();
      const syncedUrl = pxp.urls.getUrlWithPathSync();
      if (syncedUrl !== currentStoredUrl) {
        pxp.urls.setStoredUrl(syncedUrl);
        
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
          urlInput.value = syncedUrl;
        }
      }
    }
  });


  settingsMenu.append(urlOption, syncUrlPathOption, dockOption, darkThemeOption);
  pxpControls.appendChild(settingsMenu);
  
  // Initialize lock state and icon state after DOM is created
  updateUrlPathSyncState();
  urlInputHandler.initIconState();

  // Check if this is the first time user and show instructions
  const isFirstTime = pxp.settings.isFirstTime();
  if (isFirstTime) showInstructions();

  // Close settings menu when clicking outside
  document.addEventListener('click', function (e) {
    // Don't close if clicking on the settings button itself
    if (e.target === settingsBtn || settingsBtn.contains(e.target)) return;

    // Don't close if clicking on instructions overlay elements
    if (e.target.closest('#pxp-instructions-overlay')) return;

    // Close if clicking outside the settings menu
    if (!settingsMenu.contains(e.target)) {
      settingsMenu.classList.remove('active');
    }
  });

  // Dock functionality
  function dockControls(position) {
    pxpControls.classList.remove('top', 'bottom');
    if (position === 'top') pxpControls.classList.add('top');
    else if (position === 'bottom') pxpControls.classList.add('bottom');

    // Save dock position to localStorage
    pxp.settings.setDockPosition(position);
  }

  // Add dock button event listeners
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('dock-btn')) {
      const position = e.target.dataset.position;
      dockControls(position);

      // Close settings menu after selection
      settingsMenu.classList.remove('active');
    }
  });


  pxpControls.append(
    pxpIcon,
    onOffToggle,
    sliderContainer,
    value,
    invertBtn,
    scrollModeSelect,
    settingsBtn,
    closeBtn
  );

  pxpOverlay.appendChild(pxpIframe);

  // Restore dock position
  const savedDockPosition = pxp.settings.getDockPosition();
  dockControls(savedDockPosition);

  // Apply initial theme
  if (pxp.settings.getDarkTheme()) {
    pxpControls.classList.add('dark-theme');
    pxpControls.classList.remove('light-theme');
  } else {
    pxpControls.classList.add('light-theme');
    pxpControls.classList.remove('dark-theme');
  }

  const storedUrl = pxp.urls.getStoredUrl();
  const hasValidUrl = storedUrl && storedUrl.trim();
  const storedOverlayState = pxp.settings.getOverlayState();
  const shouldShowOverlay = hasValidUrl && storedOverlayState;

  setOverlayState(shouldShowOverlay);

  document.addEventListener('wheel', globalWheelHandler, {passive: false});
  document.addEventListener('keydown', arrowKeyHandler);
  window.addEventListener('scroll', throttle(syncIframeScroll, 10), {passive: true});

  document.body.append(pxpOverlay, pxpControls);


  // Show simple update link in settings menu
  function showUpdateLink(latestVersion) {
    const settingsMenu = document.getElementById('settings-menu');
    if (!settingsMenu || document.getElementById('update-link')) return;
    
    const updateLink = div({class: 'settings-option'},
      a({
        href: 'https://github.com/dave-fink/pixel-perfect-chrome-extension/releases',
        target: '_blank',
        id: 'update-link'
      }, `Update available (v${latestVersion})`)
    );
    
    // Add to bottom of settings menu
    settingsMenu.appendChild(updateLink);
  }

  // Check for updates after UI creation and show simple link if available
  setTimeout(() => {
    pxp.updates.checkForUpdates((latestVersion) => {
      if (latestVersion) showUpdateLink(latestVersion);
    });
  }, 3000);
}
