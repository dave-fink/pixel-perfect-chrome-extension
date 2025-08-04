// INSPECTING - add a button to inspect the iframe
// vh measurement issue, when changing viewport sync scrollign is a problem
// custom scrollbars when using chrome mobile view can cause problems


// Global error state management
let currentError = null;

// Show error in settings panel
function showErrorInSettings(url, errorDetails = '') {
  currentError = { url, errorDetails };
  
  // Open settings menu to show error
  const settingsMenu = document.getElementById('settings-menu');
  if (settingsMenu) {
    settingsMenu.style.display = 'block';
  }
  
  // Update error display in settings
  updateSettingsErrorDisplay(url, errorDetails);
}

  // Update error display in settings panel
  function updateSettingsErrorDisplay(url, errorDetails) {
    // Remove existing error message
    const existingError = document.querySelector('.url-error-message');
    if (existingError) existingError.remove();
    
    // Add error class to input field
    const urlInput = document.querySelector('#url-input');
    if (urlInput) {
      urlInput.classList.add('error');
      console.log('Added error class to input, classes:', urlInput.className);
    } else {
      console.log('URL input not found');
    }
    
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
  
  // Remove error class from input field
  const urlInput = document.querySelector('#url-input');
  if (urlInput) urlInput.classList.remove('error');
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
let pxpScrollMode = pxpSettings.getScrollMode();
let pxpIsActive = false;
let originalFavicon = null;

function updateTab(isActive) {
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
        .catch(() => createDefaultFavicon());
    };

    function createDefaultFavicon() {
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
      pxpSettings.setActive(true);
      // Update toolbar icon to colored
      chrome.runtime.sendMessage({action: 'updateIcon', active: true}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending updateIcon message:', chrome.runtime.lastError);
        }
      });

      updateTab(true);
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
  const isFirstTimeForInstructions = localStorage.getItem('pxpActive') === null;
  
  // Create and show instructions overlay
  const instructionsOverlay = div({id: 'pxp-instructions-overlay'});
  
  const instructionsContent = div({id: 'pxp-instructions'}, 
    div({class: 'pxp-title'}, 
      img({
        src: chrome.runtime.getURL('icons/pixel-perfect.svg'),
        style: 'width: 34px; height: 34px; margin-right: 12px; vertical-align: middle;'
      }),
      'Pixel Perfect Overlay (FIRST TIME)'
    ),
    div({class: 'pxp-message'}, 
      'Overlay your local dev page on any live page to quickly identify layout differences and adjust with precision.'
    ),
    div({class: 'pxp-steps'}, 
      ol({},
        li('Enter your local dev URL in the ', b('Overlay URL'), ' field'),
        li('Adjust the ', b('opacity'), ' slider and ', b('invert'), ' button'),
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
      if (settingsMenuElement) settingsMenuElement.style.display = 'block';
    }
  });
}

// Check if we should auto-create overlay on page load
function autoRestoreOverlay() {
  const storedUrl = pxpUrls.getStoredUrl();
  const isActive = pxpSettings.getActive();

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
        pxpSettings.setActive(true);
        // Update toolbar icon to colored
        chrome.runtime.sendMessage({action: 'updateIcon', active: true}, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending updateIcon message:', chrome.runtime.lastError);
          }
        });

        // Update favicon to show extension is active
        updateTab(true);
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
    ppLastOpacityValue = 100;
    pxpIsActive = false;

    // Remove event listeners
    document.removeEventListener('wheel', globalWheelHandler);
    document.removeEventListener('keydown', arrowKeyHandler);
    // TODO: revisit scroll positon when refreshing  window.removeEventListener('resize', adjustOverlayPosition);
    window.removeEventListener('scroll', throttle(syncIframeScroll, 16));

    // Store inactive state
    pxpSettings.setActive(false);
    // Update toolbar icon to gray
    chrome.runtime.sendMessage({action: 'updateIcon', active: false}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });

    // Restore original favicon
    updateTab(false);
  } else {
    // Set overlay to OFF state when extension is first activated
    pxpSettings.setOverlayState(false);
    createOverlay();
    pxpIsActive = true;
    // Store active state
    pxpSettings.setActive(true);
    // Update toolbar icon to colored
    chrome.runtime.sendMessage({action: 'updateIcon', active: true}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });

    // Update favicon to show extension is active
    updateTab(true);
  }
}

function loadOverlayIframe() {
  // Get URL with cache buster
  const overlayURL = pxpUrls.getIframeUrl();

  // Ensure DOM is ready (especially for hard refreshes)
  const initialHeight = getPageHeight();
  pxpIframe = domEl('iframe', {
    src: overlayURL, 
    style: 'height: ' + initialHeight + 'px; display: none;',
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
    pxpIframe.style.display = 'none';
    showErrorInSettings(pxpIframe.src.split('?')[0], 'Failed to load overlay URL');
  });

  // Error check using background script
  chrome.runtime.sendMessage({ action: "errorCheckURL", url: overlayURL.split('?')[0] }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (response && !response.accessible) {
      // Server is down - hide iframe and show error message
      pxpIframe.style.display = 'none';
      showErrorInSettings(overlayURL.split('?')[0], response.error);
    } else {
      // Server is up - show iframe and clear any existing error message
      pxpIframe.style.display = '';
      clearSettingsError();
    }
  });

  // Apply invert filter if previously saved
  if (pxpSettings.getInverted()) {
    pxpIsInverted = true;
    pxpIframe.style.filter = 'invert(1)';
    pxpIframe.style.backgroundColor = 'white'; // Add white background for inversion
  }

  // Apply stored opacity to iframe
  const iframeOpacity = pxpSettings.getOpacity();
  if (iframeOpacity !== 100) {
    const opacity = iframeOpacity / 100;
    pxpIframe.style.opacity = opacity;
    ppLastOpacityValue = iframeOpacity;
  }

  return pxpIframe;
}

function createOverlay() {
  // Get URL with path syncing applied
  const iframeUrl = pxpUrls.getUrlWithPathSync();

  pxpOverlay = div({id: 'pxp-overlay'});
  
  // Load the iframe using the reusable function
  pxpIframe = loadOverlayIframe();

  // Add resize observer to handle dynamic content changes
  const resizeObserver = new ResizeObserver(() => {
    if (pxpIframe) pxpIframe.style.height = getPageHeight() + 'px';
  });
  resizeObserver.observe(document.body);

  // Double-check height after a short delay for hard refresh scenarios
  const initialHeight = getPageHeight();
  setTimeout(() => {
    if (pxpIframe) {
      const newHeight = getPageHeight();
      if (newHeight > initialHeight) pxpIframe.style.height = newHeight + 'px';
    }
  }, HEIGHT_CHECK_DELAY);

  pxpControls = div({id: 'pxp-controls', class: 'top'}); // Default to top positioning

  const ppIcon = div({id: 'pixel-perfect-icon'},
    img({src: chrome.runtime.getURL('icons/pixel-perfect.svg'), alt: 'Pixel Perfect'}),
  );



  // Set input value to stored URL or default
  const inputStoredUrl = pxpUrls.getStoredUrl();
  let inputUrl = inputStoredUrl;
  

  // Check if Sync URL Path is enabled
  const syncUrlPathEnabled = pxpSettings.getSyncUrlPath();
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
    title: 'Overlay URL'
  });
  
  // Add focus class only when input is empty (placeholder shown)
  if (!inputUrl) urlInput.classList.add('focus');


  // Add smart URL input icon
  const urlInputIcon = div({ id: 'url-input-icon' });
  
  // ===== OPTIMIZED URL INPUT HANDLING =====
  
  // Centralized URL validation and state management
  const urlInputHandler = {
    // State tracking
    showNewWindow: false,
    lastUrlValue: '',
    
    // Update icon based on current state
    updateIcon(url, validationResult = null) {
      const { isValid, error } = validationResult || {};
      const hasErrorMessage = document.querySelector('.url-error-message');
      const hasFocus = urlInput.classList.contains('focus');
      const hasError = urlInput.classList.contains('error');
      
      // Icon state priority: new-window > error-message > focus/empty > error > valid
      if (this.showNewWindow) {
        this.setNewWindowIcon();
      } else if (hasErrorMessage) {
        this.setErrorIcon();
      } else if (!url || hasFocus) {
        this.setGoIcon('default');
      } else if (hasError) {
        this.setGoIcon('error');
      } else {
        this.setGoIcon('valid');
      }
    },
    
    // Icon setters (cached for performance)
    setNewWindowIcon() {
      if (urlInputIcon.className !== 'url-input-icon new-window-icon') {
        urlInputIcon.innerHTML = this.newWindowSvg;
        urlInputIcon.className = 'url-input-icon new-window-icon';
      }
    },
    
    setErrorIcon() {
      if (urlInputIcon.className !== 'url-input-icon error-icon') {
        urlInputIcon.innerHTML = this.getErrorSvg();
        urlInputIcon.className = 'url-input-icon error-icon';
      }
    },
    
    getErrorSvg() {
      return `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="none" stroke="#ff4444" stroke-width="1"/><text x="10" y="14" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#ff4444">!</text></svg>`;
    },
    
    setGoIcon(type) {
      const className = `url-input-icon go-icon${type !== 'default' ? ` ${type}` : ''}`;
      if (urlInputIcon.className !== className) {
        const color = type === 'error' ? '#ff4444' : type === 'valid' ? '#4a9eff' : '#666';
        urlInputIcon.innerHTML = this.getGoSvg(color);
        urlInputIcon.className = className;
      }
    },
    
    getGoSvg(color) {
      return `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="none" stroke="${color}" stroke-width="1"/><text x="10" y="10.5" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${color}">go</text></svg>`;
    },
    
    // Cached SVG templates
    newWindowSvg: '<svg width="16" height="16" viewBox="0 0 358.05 355.34" xmlns="http://www.w3.org/2000/svg"><path d="M22.04,57.84v276.49h276v-188.15c0-7.87,16.35-12.88,20.24-3.24l.21,206.31c-1.9,3.82-5.55,6.05-9.9,6.09l-300.58-.52c-3.99-1.48-6.2-3.52-7.29-7.7L0,50.31c-.01-5.4,1.38-10,6.3-12.68h206.49c9.66,3.89,4.64,20.21-3.24,20.21H22.04Z"/><path d="M335.04,36.88l-167.96,167.23c-10.59,7.64-23.19-4.39-15.05-15.02L320.04,20.9h-73.5c-.69,0-4.56-2.71-5.36-3.63-4.72-5.48-2.25-16.06,5.42-17.27l104.18.7c4.22,2.29,6.1,7.05,6.3,11.68-2.52,29.69,3.28,64.7-.15,93.76-.74,6.29-3.58,11.12-10.51,11.56-4.78.3-11.37-4.69-11.37-9.45V36.88Z"/></svg>',
    
    // Handle URL submission (Enter key or go icon click)
    submitUrl(url) {
      if (!url.trim()) return;
      
      // Save URL and show new window icon
      pxpUrls.setStoredUrl(url);
      this.showNewWindow = true;
      this.updateIcon(url);
      
      // Check for errors and show message below input
      chrome.runtime.sendMessage({ action: "errorCheckURL", url }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        
        if (response && !response.accessible) {
          // Show error in settings panel
          showErrorInSettings(url, response.error || 'Unable to access URL');
          // Update icon back to go icon with error state
          this.showNewWindow = false;
          this.updateIcon(url);
        } else {
          // Update iframe with new URL without reloading page
          if (pxpIframe) pxpIframe.remove();
          pxpIframe = loadOverlayIframe();
          pxpOverlay.appendChild(pxpIframe);

          // Turn overlay ON after successful URL submission
          console.log('submitUrl: Valid URL submitted, turning overlay ON');
          setOverlayState(true);
        }
      });
    },
    
    // Handle input changes
    handleInput(url) {
      // Handle empty input
      if (!url.trim()) {
        urlInput.classList.remove('error');
        urlInput.classList.add('focus');
        urlInput.title = '';
        clearSettingsError();
        this.showNewWindow = false; // Reset new window flag
        this.updateIcon('');
        return;
      }
      
      // Remove focus and clear error message
      urlInput.classList.remove('focus');
      const existingError = document.querySelector('.url-error-message');
      if (existingError) existingError.remove();
      
      // Only reset new window flag if user is actually typing (not just initial load)
      if (this.lastUrlValue !== url) {
        this.showNewWindow = false;
      }
      this.lastUrlValue = url;
      
      // Check URL for errors using background script
      chrome.runtime.sendMessage({ action: "errorCheckURL", url }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        
        if (response && !response.accessible) {
          // Show error state on input
          urlInput.classList.add('error');
          // Add error tooltip
          urlInput.title = `Error: ${response.error || 'Unable to access URL'}`;
        } else {
          // Only clear error state if validation passes
          urlInput.classList.remove('error');
          urlInput.title = '';
        }
        
        // Update icon after error check is complete
        this.updateIcon(url);
      });
    },
    
    // Initialize icon state based on stored URL
    initIconState() {
      const storedUrl = pxpUrls.getStoredUrl();
      if (storedUrl && storedUrl.trim()) {
        // Check if stored URL is valid
        chrome.runtime.sendMessage({ action: "errorCheckURL", url: storedUrl }, (response) => {
          if (chrome.runtime.lastError) {
            return;
          }
          
          if (response && response.accessible) {
            // Valid stored URL - show new window icon
            this.showNewWindow = true;
            this.updateIcon(storedUrl);
          } else {
            // Invalid stored URL - show go icon with error
            this.showNewWindow = false;
            this.updateIcon(storedUrl);
          }
        });
      } else {
        // No stored URL - show go icon
        this.showNewWindow = false;
        this.updateIcon('');
      }
    }
  };
  
  // Initialize handler with proper icon state
  urlInputHandler.initIconState();
  
  // ===== OPTIMIZED EVENT HANDLERS =====
  
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
  
  // Icon click handler
  urlInputIcon.addEventListener('click', () => {
    const url = urlInput.value.trim();
    const isNewWindowIcon = urlInputIcon.classList.contains('new-window-icon');
    const isErrorIcon = urlInputIcon.classList.contains('error-icon');
    
    if ((isNewWindowIcon || isErrorIcon) && pxpIframe?.src) {
      // Open in new tab
      const baseUrl = pxpIframe.src.split('?')[0];
      window.open(baseUrl, '_blank');
    } else if (!isNewWindowIcon && !isErrorIcon && url) {
      // Trigger URL submission
      urlInputHandler.submitUrl(url);
    }
  });

  // Get stored opacity value or default to 100
  const initialValue = pxpSettings.getOpacity();

  const sliderContainer = div({id: 'opacity-slider'},
    div({id: 'slider-track'}),
    div({id: 'slider-fill'}),
    div({id: 'slider-thumb'})
  );

  // Get references to slider elements
  const sliderThumb = sliderContainer.querySelector('#slider-thumb');
  const sliderFill = sliderContainer.querySelector('#slider-fill');

  // Set percentage text to match stored opacity
  const opacityValue = pxpSettings.getOpacity().toString();
  const value = span({id: 'opacity-value', title: 'Current opacity value'}, opacityValue + '%');

  // Add invert toggle button
  const invertBtn = div({class: 'invert btn'}, 'Invert');

  // Restore invert state from localStorage
  if (pxpSettings.getInverted()) {
    pxpIsInverted = true;
    invertBtn.classList.add('active');
  }

  // Add scroll mode custom dropdown
  const options = [
    {value: 'both', text: 'Scroll Both', selected: true},
    {value: 'original', text: 'Scroll Page', selected: false},
    {value: 'overlay', text: 'Scroll Overlay', selected: false}
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

  const scrollModeSelect = div({
      class: 'scroll-mode-select btn',
      title: 'Select scroll mode'
    },
    span({}, 'Scroll Both'),
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
    console.log('setOverlayState: Setting overlay to', isOn ? 'ON' : 'OFF');
    
    // Update toggle input
    toggleInput.checked = isOn;
    
    // Update control classes
    updateControlsClass();
    
    if (isOn) {
      // Show overlay and restore opacity
      pxpOverlay.style.zIndex = '999999';
      pxpOverlay.style.opacity = '1';

      // Re-enable all controls
      sliderContainer.classList.remove('disabled');
      sliderContainer.style.pointerEvents = 'auto';
      urlInput.disabled = false;
      scrollModeSelect.disabled = false;

      // Restore last opacity
      sliderThumb.style.left = ppLastOpacityValue + '%';
      sliderFill.style.width = ppLastOpacityValue + '%';
      const opacity = ppLastOpacityValue / 100;
      pxpIframe.style.opacity = opacity;
      value.textContent = ppLastOpacityValue + '%';

      // Check server status when turning ON
      if (pxpIframe && pxpIframe.src) {
        const baseUrl = pxpIframe.src.split('?')[0];
        chrome.runtime.sendMessage({ action: "errorCheckURL", url: baseUrl }, (response) => {
          if (chrome.runtime.lastError) return;
          
          if (response && !response.accessible) {
            pxpIframe.style.display = 'none';
            showErrorInSettings(baseUrl, response.error);
          } else {
            pxpIframe.style.display = '';
            clearSettingsError();
          }
        });
      }
    } else {
      // Store current opacity before turning off
      const currentLeft = parseFloat(sliderThumb.style.left) || 0;
      ppLastOpacityValue = Math.round(currentLeft);

      // Hide overlay but keep controls visible and accessible
      pxpOverlay.style.zIndex = '-999999';
      pxpOverlay.style.opacity = '0';

      // Disable slider functionality but keep other controls enabled
      sliderContainer.classList.add('disabled');
      sliderContainer.style.pointerEvents = 'none';
      urlInput.disabled = false;
      scrollModeSelect.disabled = false;

      // Move slider to 0 and set 50% opacity for OFF state
      sliderThumb.style.left = '0%';
      sliderFill.style.width = '0%';
      pxpIframe.style.opacity = '0.5';
      value.textContent = 'OFF';

      // Hide error message if it exists
      const errorOverlay = document.getElementById('pxp-error-message');
      if (errorOverlay) errorOverlay.remove();
    }
    
    // Save state to localStorage
    pxpSettings.setOverlayState(isOn);
  };

  // Set initial state to OFF
  setOverlayState(false);

  // Add toggle event handler
  toggleInput.addEventListener('change', function () {
    console.log('Toggle changed to:', toggleInput.checked);
    setOverlayState(toggleInput.checked);
  });

  // Add settings button (burger icon)
  const settingsBtn = div({class: 'settings-burger', title: 'Settings'});
  settingsBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // Add close button
  const closeBtn = div({id: 'close-btn', title: 'Close overlay'}, '×');

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

  function onSliderMouseMove(e) {
    if (!isSliderDragging) return;

    const rect = sliderContainer.getBoundingClientRect();
    const deltaX = e.clientX - sliderStartX;
    const newLeft = sliderStartLeft + (deltaX / rect.width) * 100;
    const clampedLeft = Math.max(0, Math.min(100, newLeft));

    sliderThumb.style.left = clampedLeft + '%';
    sliderFill.style.width = clampedLeft + '%';
    updateOpacity(clampedLeft);
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

    sliderThumb.style.left = clampedLeft + '%';
    sliderFill.style.width = clampedLeft + '%';
    updateOpacity(clampedLeft);
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
    ppLastOpacityValue = Math.round(percentage);
    pxpSettings.setOpacity(Math.round(percentage));
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
    pxpSettings.setInverted(pxpIsInverted);
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
      pxpSettings.setScrollMode(newMode);

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
  const settingsMenu = div({
    id: 'settings-menu',
    style: 'display: none;'
  });

  // Add URL input setting (first option)
  const urlOption = div({class: 'settings-option'},
    span({class: 'settings-text'}, 'Overlay URL'),
    div({class: 'url-input-container'},
      div({class: 'input-wrapper'},
        urlInput,
        urlInputIcon
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
  const darkThemeOption = div({class: 'settings-option'},
    span({class: 'settings-text'}, 'Dark theme'),
    label({class: 'switch'},
      input({type: 'checkbox', id: 'dark-theme-toggle', checked: true}),
      span({class: 'slider round'})
    )
  );


  // Set default dark theme state
  const darkThemeToggle = darkThemeOption.querySelector('#dark-theme-toggle');
  darkThemeToggle.checked = pxpSettings.getDarkTheme();

  // Sync URL path setting
  const syncUrlPathOption = div({class: 'settings-option'},
    span({class: 'settings-text'}, 'Sync URL path'),
    label({class: 'switch'},
      input({type: 'checkbox', id: 'sync-url-path-toggle'}),
      span({class: 'slider round'})
    )
  );


  // Set default sync URL path state
  const syncUrlPathToggle = syncUrlPathOption.querySelector('#sync-url-path-toggle');
  syncUrlPathToggle.checked = pxpSettings.getSyncUrlPath();


  settingsMenu.append(urlOption, syncUrlPathOption, dockOption, darkThemeOption);
  pxpControls.appendChild(settingsMenu);

  // Check if this is the first time user and show instructions
  const isFirstTime = !localStorage.getItem('pxpActive');
  if (isFirstTime) showInstructions();
  

  // Settings button click handler
  settingsBtn.addEventListener('click', function () {
    const isVisible = settingsMenu.style.display !== 'none';
    settingsMenu.style.display = isVisible ? 'none' : 'block';
  });

  // Close settings menu when clicking outside
  document.addEventListener('click', function (e) {
    // Don't close if clicking on the settings button itself
    if (e.target === settingsBtn || settingsBtn.contains(e.target)) return;

    // Don't close if clicking on instructions overlay elements
    if (e.target.closest('#pxp-instructions-overlay')) return;

    // Close if clicking outside the settings menu
    if (!settingsMenu.contains(e.target)) {
      settingsMenu.style.display = 'none';
    }
  });

  // Dock functionality
  function dockControls(position) {
    pxpControls.classList.remove('top', 'bottom');
    if (position === 'top') pxpControls.classList.add('top');
    else if (position === 'bottom') pxpControls.classList.add('bottom');

    // Save dock position to localStorage
    pxpSettings.setDockPosition(position);
  }

  // Add dock button event listeners
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('dock-btn')) {
      const position = e.target.dataset.position;
      dockControls(position);

      // Close settings menu after selection
      settingsMenu.style.display = 'none';
    }
  });

  // Add dark theme toggle event listener
  document.addEventListener('change', function (e) {
    if (e.target.id === 'dark-theme-toggle') {
      const isDark = e.target.checked;
      pxpSettings.setDarkTheme(isDark);

      // Apply theme to controls
      if (isDark) {
        pxpControls.classList.add('dark-theme');
        pxpControls.classList.remove('light-theme');
      } else {
        pxpControls.classList.add('light-theme');
        pxpControls.classList.remove('dark-theme');
      }
    } else if (e.target.id === 'sync-url-path-toggle') {
      const isSyncEnabled = e.target.checked;
      pxpSettings.setSyncUrlPath(isSyncEnabled);

      if (isSyncEnabled) {
        // Check if current overlay URL path matches the page URL path
        const currentPageUrl = window.location.href;
        const currentPagePath = new URL(currentPageUrl).pathname;

        const storedOverlayUrl = pxpUrls.getStoredUrl();
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
          const newOverlayUrl = pxpUrls.getUrlWithPathSync();
          const urlInput = document.getElementById('url-input');
          if (urlInput) {
            urlInput.value = newOverlayUrl;
            pxpUrls.setStoredUrl(newOverlayUrl);
          }
          
          // Update the iframe URL to match the current page path
          // Reload the iframe
          pxpIframe.remove();
          pxpIframe = loadOverlayIframe();
          pxpOverlay.appendChild(pxpIframe);
        }
      }
    }
  });

  // Restore dock position from localStorage or default to top
  const savedDockPosition = pxpSettings.getDockPosition();
  dockControls(savedDockPosition);

  // Apply initial theme
  if (pxpSettings.getDarkTheme()) {
    pxpControls.classList.add('dark-theme');
    pxpControls.classList.remove('light-theme');
  } else {
    pxpControls.classList.add('light-theme');
    pxpControls.classList.remove('dark-theme');
  }


  closeBtn.addEventListener('click', function () {
    // Use the toggle function to ensure proper state management
    toggleOverlay();
  });


  // Add event listeners for scroll and arrow key handling
  document.addEventListener('wheel', globalWheelHandler, {passive: false});
  document.addEventListener('keydown', arrowKeyHandler);

  // Add scroll event listener for smoother sync in "both" mode
  window.addEventListener('scroll', throttle(syncIframeScroll, 10), {passive: true});

  pxpControls.append(
    ppIcon, 
    onOffToggle,
    sliderContainer,
    value,
    invertBtn,
    scrollModeSelect,
    settingsBtn,
    closeBtn
  );

  pxpOverlay.appendChild(pxpIframe);

  // Check if there's a valid stored URL and overlay should be ON
  const storedUrl = pxpUrls.getStoredUrl();
  const hasValidUrl = storedUrl && storedUrl.trim();
  const shouldShowOverlay = hasValidUrl && pxpSettings.getOverlayState();

  console.log('createOverlay: Initial setup - hasValidUrl:', hasValidUrl, 'shouldShowOverlay:', shouldShowOverlay);

  // Apply the appropriate initial state
  if (shouldShowOverlay) {
    setOverlayState(true);
  }
  // If no valid URL or overlay should be off, it's already set to OFF above

  // Add both overlay and controls as siblings to body
  document.body.appendChild(pxpOverlay);
  document.body.appendChild(pxpControls);

}
