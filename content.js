// INSPECTING - add a button to inspect the iframe

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
  items.forEach(item => item != null && element.appendChild( item instanceof Element ? item : document.createTextNode(item)));
  return element;
}

// Element helper functions
function div(...items) { return domEl('div', ...items); }
function span(...items) { return domEl('span', ...items); }
function label(...items) { return domEl('label', ...items); }
function input(...items) { return domEl('input', ...items); }
function img(...items) { return domEl('img', ...items); }
function link(...items) { return domEl('link', ...items); }
function a(...items) { return domEl('a', ...items); }
  
// Helper function to show error message
function showErrorMessage(url) {
  const errorOverlay = div({ id: 'pxp-error-message' }, 
    div({ class: 'message' }, 'Error loading overlay'),
    div({ class: 'details' }, a({ href: url, target: '_blank' }, url))
  );
  document.body.appendChild(errorOverlay);
}
  
  // Check if content script is already running
if (window.pixelPerfectScriptLoaded) {
  // Exit early to prevent duplicate scripts
  throw new Error('Content script already loaded');
}

window.pixelPerfectScriptLoaded = true;

let ppOverlay = null;
let ppControls = null;
let ppIframe = null;
let ppIsInverted = false;
let ppLastOpacityValue = 100;
let ppScrollMode = 'both';
let ppIsActive = false;
let originalFavicon = null;

function updateFavicon(isActive) {
  console.log('updateFavicon called with isActive:', isActive);
  
  // Store original favicon on first call
  if (!originalFavicon) {
    const existingFavicon = document.querySelector('link[rel="icon"]') || 
                            document.querySelector('link[rel="shortcut icon"]');
    originalFavicon = existingFavicon ? existingFavicon.href : null;
    console.log('Original favicon stored:', originalFavicon);
  }
  
  if (isActive) {
    console.log('Creating favicon overlay...');
    
    // Create canvas for favicon overlay
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 32;
    canvas.height = 32;
    
    // Load original favicon
    const originalFaviconImg = new Image();
    originalFaviconImg.crossOrigin = 'anonymous';
    originalFaviconImg.onload = () => {
      // Draw original favicon
      ctx.drawImage(originalFaviconImg, 0, 0, 32, 32);
      
      // Load extension icon
      const extensionIcon = new Image();
      extensionIcon.crossOrigin = 'anonymous';
      extensionIcon.onload = () => {
        // Draw extension icon in bottom-right corner (20x20)
        ctx.drawImage(extensionIcon, 12, 12, 20, 20);
        
        // Convert canvas to data URL and create favicon link
        const overlayFavicon = canvas.toDataURL();
        
        // Remove all existing favicon links
        const existingFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        existingFavicons.forEach(favicon => {
          favicon.remove();
        });
        
        // Create new favicon link with overlay
        const newFavicon = link({ 
          rel: 'icon',
          href: overlayFavicon,
          id: 'pixel-perfect-favicon'
        });
        
        document.head.appendChild(newFavicon);
        console.log('Overlay favicon added to head');
      };
      extensionIcon.src = chrome.runtime.getURL('pixel-perfect.png');
    };
    originalFaviconImg.src = originalFavicon;
    
  } else {
    console.log('Restoring original favicon...');
    
    // Remove extension favicon
    const extensionFavicon = document.getElementById('pixel-perfect-favicon');
    if (extensionFavicon) {
      extensionFavicon.remove();
      console.log('Extension favicon removed');
    }
    
    // Restore original favicon by recreating the link
    if (originalFavicon) {
      const originalFaviconLink = link({ 
        rel: 'icon',
        href: originalFavicon
      });
      document.head.appendChild(originalFaviconLink);
      console.log('Original favicon restored:', originalFavicon);
    }
  }
}

 

// Define event handlers first to avoid reference errors
// Throttle function for performance
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Debounced scroll sync for better performance
let scrollSyncTimeout;
let lastScrollY = 0; // Cache last scroll position to avoid unnecessary updates

function syncIframeScroll() {
  if (ppIframe && ppScrollMode === 'both') {
    const mainScrollY = window.scrollY;
    // Only update if scroll position actually changed
    if (mainScrollY !== lastScrollY) {
      ppIframe.style.transform = `translateY(-${mainScrollY}px)`;
      lastScrollY = mainScrollY;
    }
  }
}

function globalWheelHandler(e) {
  if (ppIframe && ppIframe.style.opacity !== '0') {
    const scrollAmount = e.deltaY;

    if (ppScrollMode === 'both') {
      // Use throttled sync for smooth performance
      clearTimeout(scrollSyncTimeout);
      scrollSyncTimeout = setTimeout(syncIframeScroll, 16); // ~60fps
    } else if (ppScrollMode === 'original') {
      // Only scroll main page, iframe stays at current position
      // Don't change iframe position - let it stay where it is
    } else if (ppScrollMode === 'overlay') {
      // Only scroll iframe, prevent main page scroll completely
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Use requestAnimationFrame for smooth iframe scrolling
      requestAnimationFrame(() => {
        const storedMainScrollY = ppIframe.dataset.mainPageScrollY || '0';
        window.scrollTo(0, parseInt(storedMainScrollY));

        const currentTransform = ppIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        const newY = currentY - scrollAmount;

        if (newY <= 0 && newY >= -10000) { // Simple boundary check
          ppIframe.style.transform = `translateY(${newY}px)`;
        }
      });
      return false; // Prevent event from bubbling up
    }
  }
}

// Add arrow key handler for fine-tuned scrolling
function arrowKeyHandler(e) {
  if (ppIframe && ppIframe.style.opacity !== '0') {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); // Prevent default arrow key behavior

      const scrollAmount = e.key === 'ArrowUp' ? -1 : 1; // 1px at a time

      if (ppScrollMode === 'both') {
        // Scroll both together
        const mainScrollY = window.scrollY - scrollAmount;
        window.scrollTo(0, Math.max(0, mainScrollY));
        ppIframe.style.transform = `translateY(-${Math.max(0, mainScrollY)}px)`;
      } else if (ppScrollMode === 'original') {
        // Only scroll main page
        const mainScrollY = window.scrollY - scrollAmount;
        window.scrollTo(0, Math.max(0, mainScrollY));
      } else if (ppScrollMode === 'overlay') {
        // Only scroll iframe
        const currentTransform = ppIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        const newY = currentY - scrollAmount;

        if (newY <= 0 && newY >= -10000) {
          ppIframe.style.transform = `translateY(${newY}px)`;
        }
      }
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: 'ok' });
  } else if (request.action === "toggleOverlay") {
    toggleOverlay();
  } else if (request.action === "autoCreateOverlay") {
    console.log('Received autoCreateOverlay message');
    // Auto-create overlay without toggling state
    if (!ppOverlay) {
      console.log('Creating overlay via autoCreateOverlay');
      createOverlay();
      ppIsActive = true;
      // Store active state
      localStorage.setItem('pixelPerfectActive', 'true');
      // Update toolbar icon to colored
      chrome.runtime.sendMessage({ action: 'updateIcon', active: true }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending updateIcon message:', chrome.runtime.lastError);
        }
      });
      
      // Update favicon to show extension is active
      updateFavicon(true);
    } else {
      console.log('Overlay already exists, skipping creation');
    }
  }
});

// Check if we should auto-create overlay on page load
function autoRestoreOverlay() {
  const storedUrl = localStorage.getItem('pixelPerfectUrl');
  const isActive = localStorage.getItem('pixelPerfectActive');
  
  // If no active state is stored, default to active (true)
  // This ensures the extension works when localStorage is cleared
  const shouldBeActive = isActive === null ? true : isActive === 'true';
  
  if (shouldBeActive) {
    // Longer delay to ensure page is fully loaded and extension is ready
    setTimeout(() => {
      if (!ppOverlay) {
        createOverlay();
        ppIsActive = true;
        // Store active state
        localStorage.setItem('pixelPerfectActive', 'true');
        // Update toolbar icon to colored
        chrome.runtime.sendMessage({ action: 'updateIcon', active: true }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending updateIcon message:', chrome.runtime.lastError);
          }
        });
        
        // Update favicon to show extension is active
        updateFavicon(true);
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
  
  if (ppOverlay || overlayInDOM || controlsInDOM) {
    if (ppOverlay) ppOverlay.remove();
    if (overlayInDOM) overlayInDOM.remove();
    if (controlsInDOM) controlsInDOM.remove();
    
    // Remove error overlay if it exists
    const errorOverlay = document.getElementById('pxp-error-message');
    if (errorOverlay) errorOverlay.remove();
    
    // Reset iframe display in case it was hidden due to error
    if (ppIframe) ppIframe.style.display = '';
    
    ppControls = null;
    ppIframe = null;
    ppOverlay = null;
    ppIsInverted = false;
    ppLastOpacityValue = 100;
    ppIsActive = false;
    
    // Remove event listeners
    document.removeEventListener('wheel', globalWheelHandler);
    document.removeEventListener('keydown', arrowKeyHandler);
    // TODO: revisit scroll positon when refreshing  window.removeEventListener('resize', adjustOverlayPosition); 
    window.removeEventListener('scroll', throttle(syncIframeScroll, 16));
    
    // Store inactive state
    localStorage.setItem('pixelPerfectActive', 'false');
    // Update toolbar icon to gray
    chrome.runtime.sendMessage({ action: 'updateIcon', active: false }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });
    
    // Restore original favicon
    updateFavicon(false);
  } else {
    createOverlay();
    ppIsActive = true;
    // Store active state
    localStorage.setItem('pixelPerfectActive', 'true');
    // Update toolbar icon to colored
    chrome.runtime.sendMessage({ action: 'updateIcon', active: true }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });
    
    // Update favicon to show extension is active
    updateFavicon(true);
  }
}

function createOverlay() {
  // Check for stored URL or use default
  const iframeStoredUrl = localStorage.getItem('pixelPerfectUrl');
  let iframeUrl = iframeStoredUrl || 'http://localhost:3000/'; // default URL 
  
  // Check if Sync URL Path is enabled for iframe
  const iframeSyncUrlPathEnabled = localStorage.getItem('pixelPerfectSyncUrlPath') === 'true';
  if (iframeSyncUrlPathEnabled) {
    // Get current page URL path
    const currentUrl = window.location.href;
    const currentPath = new URL(currentUrl).pathname;
    
    // Parse the iframe URL to get domain and port
    try {
      const iframeUrlObj = new URL(iframeUrl);
      // Update the path while keeping domain and port
      iframeUrlObj.pathname = currentPath;
      iframeUrl = iframeUrlObj.href;
    } catch (e) {
      // If iframeUrl is not a valid URL, try to construct it
      if (iframeUrl.includes('localhost')) {
        const portMatch = iframeUrl.match(/localhost:(\d+)/);
        const port = portMatch ? portMatch[1] : '3000';
        iframeUrl = `http://localhost:${port}${currentPath}`;
      } else {
        // Fallback to localhost:3000 with current path
        iframeUrl = `http://localhost:3000${currentPath}`;
      }
    }
  }
  
  ppOverlay = div({ id: 'pxp-overlay' });
  const overlayURL = iframeUrl + '?cb=' + Date.now();
  ppIframe = domEl('iframe', { src: overlayURL, style: 'height: ' + document.body.scrollHeight + 'px' });
  
  // Add iframe load event to sync scroll position
  ppIframe.addEventListener('load', () => {
    // Sync iframe scroll position with main page scroll position
    const mainScrollY = window.scrollY;
    ppIframe.style.transform = `translateY(-${mainScrollY}px)`;
  });
  
  // check for errors
  // TODO: check for SSL - https://localhost:3000/
  (async () => {
    try {
      const response = await fetch(overlayURL.split('?')[0], { method: 'HEAD' });
      if (response.status !== 200) {
        document.querySelector('#open-overlay-url img').src = chrome.runtime.getURL('error.svg');
        
        ppIframe.style.display = 'none';
        
        // Show error message if overlay is ON
        const pixelPerfectOn = localStorage.getItem('pixelPerfectOn') === 'true';
        if (pixelPerfectOn) showErrorMessage(ppIframe.src.split('?')[0]);
      }
    } catch (error) {
      // Leave icon as is if fetch fails
      console.error('Error fetching overlay URL:', error);
    }
  })();
  
  
  
  
  // Apply invert filter if previously saved
  const storedInverted = localStorage.getItem('pixelPerfectInverted');
  if (storedInverted === 'true') {
    ppIsInverted = true;
    ppIframe.style.filter = 'invert(1)';
    ppIframe.style.backgroundColor = 'white'; // Add white background for inversion
  }
  
  // Apply stored opacity to iframe
  const iframeStoredOpacity = localStorage.getItem('pixelPerfectOpacity');
  if (iframeStoredOpacity) {
    const opacity = parseInt(iframeStoredOpacity) / 100;
    ppIframe.style.opacity = opacity;
    ppLastOpacityValue = parseInt(iframeStoredOpacity);
  }
  
  ppControls = div({ id: 'pxp-controls', class: 'bottom' }); // Default to bottom positioning

  const ppIcon = div({ id: 'pixel-perfect-icon' });

  // Create URL input container
  const urlContainer = div({ id: 'url-container' });

  // Set input value to stored URL or default
  const inputStoredUrl = localStorage.getItem('pixelPerfectUrl');
  let inputUrl = inputStoredUrl || 'http://localhost:3000/';
  
  // Check if Sync URL Path is enabled
  const syncUrlPathEnabled = localStorage.getItem('pixelPerfectSyncUrlPath') === 'true';
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
    placeholder: 'Enter overlay URL', 
    value: inputUrl,
    title: 'Overlay URL'
  });


  
  // Add open overlay button
  const openOverlayUrl = div({ 
    id: 'open-overlay-url', 
    title: 'Open overlay in new tab'
  },
    domEl('img', { 
      src: chrome.runtime.getURL('new-window.svg'),
      alt: 'Open in new tab',
      width: '16',
      height: '16'
    })
  );
  
  openOverlayUrl.addEventListener('click', () => {
    if (ppIframe && ppIframe.src) {
      // remove the cache buster for the new tab
      const baseUrl = ppIframe.src.split('?')[0];
      window.open(baseUrl, '_blank');
    }
  });

  // Get stored opacity value or default to 100
  const storedOpacity = localStorage.getItem('pixelPerfectOpacity');
  const initialValue = parseInt(storedOpacity) || 100;
  
  const sliderContainer = div({ id: 'opacity-slider' },
    div({ id: 'slider-track' }),
    div({ id: 'slider-fill' }),
    div({ id: 'slider-thumb' })
  );
  
  // Get references to slider elements
  const sliderThumb = sliderContainer.querySelector('#slider-thumb');
  const sliderFill = sliderContainer.querySelector('#slider-fill');

  // Set percentage text to match stored opacity
  const textStoredOpacity = localStorage.getItem('pixelPerfectOpacity');
  const opacityValue = textStoredOpacity || '100';
  const value = span({ id: 'opacity-value', title: 'Current opacity value' }, opacityValue + '%');

  // Add invert toggle button
  const invertBtn = div({ class: 'invert btn' }, 'Invert');
  
  // Restore invert state from localStorage
  const buttonStoredInverted = localStorage.getItem('pixelPerfectInverted');
  if (buttonStoredInverted === 'true') {
    ppIsInverted = true;
    invertBtn.classList.add('active');
  }

  // Add scroll mode custom dropdown
  const options = [
    { value: 'both', text: 'Scroll Both', selected: true },
    { value: 'original', text: 'Scroll Page', selected: false },
    { value: 'overlay', text: 'Scroll Overlay', selected: false }
  ];
  
  const scrollModeDropdown = div({ id: 'scroll-mode-dropdown' },
    ...options.map(option => 
      div({ 
        class: `dropdown-option ${option.selected ? 'selected' : ''}`, 
        'data-value': option.value 
      },
        span({ class: 'checkmark' }, option.selected ? '✓' : ''),
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
  // Restore toggle state from localStorage or default to ON
  const savedToggleState = localStorage.getItem('pixelPerfectOn');
  const isChecked = savedToggleState !== 'false'; // Default to true (ON) unless explicitly set to false
  
  const onOffToggle = label({ 
    class: 'on-off switch', 
    title: 'Toggle overlay on/off',
    style: 'margin-right: 8px;'
  },
    input({ type: 'checkbox', checked: isChecked }),
    span({ class: 'slider round' })
  );
  
  // Add on/off class based on toggle state
  const toggleInput = onOffToggle.querySelector('input');
  
  const updateControlsClass = () => {
    if (ppControls) {
      ppControls.classList.remove('on', 'off');
      ppControls.classList.add(toggleInput.checked ? 'on' : 'off');
    }
  };
  
  // Set initial class
  updateControlsClass();
  
  // Update class when toggle changes
  toggleInput.addEventListener('change', updateControlsClass);

  // Add settings button (burger icon)
  const settingsBtn = div({ class: 'settings-burger', title: 'Settings' }, '≡');
  
  // Add close button
  const closeBtn = div({ id: 'close-btn', title: 'Close overlay'}, '×');
  
  // Add open overlay button
  const openOverlay = div({ 
    id: 'open-overlay',
    title: 'Open overlay in new tab',
    onclick: () => {
      if (ppIframe && ppIframe.src) {
        window.open(ppIframe.src, '_blank');
      }
    }
  }, img({ src: chrome.runtime.getURL('new-window.svg'), alt: 'Open in new tab', width: '16', height: '16' }));




  // URL handling with Enter key
  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      // Store URL in localStorage and reload page to bypass CSP
      localStorage.setItem('pixelPerfectUrl', urlInput.value);
      window.location.reload();
    }
  });

  // Set initial position
  sliderThumb.style.left = initialValue + '%';
  sliderFill.style.width = initialValue + '%';
  
  let isSliderDragging = false;
  let sliderStartX = 0;
  let sliderStartLeft = 0;
  
  sliderThumb.addEventListener('mousedown', function(e) {
    isSliderDragging = true;
    sliderStartX = e.clientX;
    sliderStartLeft = parseFloat(sliderThumb.style.left) || 0;
    document.addEventListener('mousemove', onSliderMouseMove);
    document.addEventListener('mouseup', onSliderMouseUp);
  });

  // Add touch support for slider thumb
  sliderThumb.addEventListener('touchstart', function(e) {
    e.preventDefault();
    isSliderDragging = true;
    const touch = e.touches[0];
    sliderStartX = touch.clientX;
    sliderStartLeft = parseFloat(sliderThumb.style.left) || 0;
    document.addEventListener('touchmove', onSliderTouchMove, { passive: false });
    document.addEventListener('touchend', onSliderTouchEnd, { passive: false });
  });
  
  sliderContainer.addEventListener('click', function(e) {
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
  sliderContainer.addEventListener('touchstart', function(e) {
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
  }, { passive: false });
  
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
    ppIframe.style.opacity = opacity;
    value.textContent = Math.round(percentage) + '%';
    ppLastOpacityValue = Math.round(percentage);
    localStorage.setItem('pixelPerfectOpacity', Math.round(percentage).toString());
  }

  // Add change handler to toggle switch
  toggleInput.addEventListener('change', function() {
    if (toggleInput.checked) {
      // Show overlay and restore opacity
      ppOverlay.style.zIndex = '999999';
      ppOverlay.style.opacity = '1';
      
      // Re-enable all controls
      sliderContainer.classList.remove('disabled');
      sliderContainer.style.pointerEvents = 'auto';
      urlInput.disabled = false;
      // invertBtn.disabled = false;
      scrollModeSelect.disabled = false;
      
      // Restore last opacity
      sliderThumb.style.left = ppLastOpacityValue + '%';
      sliderFill.style.width = ppLastOpacityValue + '%';
      const opacity = ppLastOpacityValue / 100;
      ppIframe.style.opacity = opacity;
      value.textContent = ppLastOpacityValue + '%';
      
      // Check if there's an error and show error message
      const openOverlayImg = document.querySelector('#open-overlay-url img');
      if (openOverlayImg && openOverlayImg.src.includes('error.svg')) showErrorMessage(ppIframe.src.split('?')[0]);
      
      // Save toggle state to localStorage
      localStorage.setItem('pixelPerfectOn', 'true');
    } else {
      // Store current opacity before turning off
      const currentLeft = parseFloat(sliderThumb.style.left) || 0;
      ppLastOpacityValue = Math.round(currentLeft);
      
      // Hide overlay but keep controls visible and accessible
      ppOverlay.style.zIndex = '-999999';
      ppOverlay.style.opacity = '0';
      
      // Keep controls enabled but just disable the slider functionality
      sliderContainer.classList.add('disabled');
      sliderContainer.style.pointerEvents = 'none';
      urlInput.disabled = false; // Keep URL input enabled
      // invertBtn.disabled = false; // Keep invert button enabled
      scrollModeSelect.disabled = false; // Keep scroll mode enabled
      
      // Move slider to 0 and set 50% opacity for OFF state
      sliderThumb.style.left = '0%';
      sliderFill.style.width = '0%';
      ppIframe.style.opacity = '0.5';
      value.textContent = 'OFF';
      
      // Hide error message if it exists
      const errorOverlay = document.getElementById('pxp-error-message');
      if (errorOverlay) errorOverlay.remove();
      
      // Save toggle state to localStorage
      localStorage.setItem('pixelPerfectOn', 'false');
    }
  });

  invertBtn.addEventListener('click', function() {
    ppIsInverted = !ppIsInverted;

    if (ppIsInverted) {
      ppIframe.style.filter = 'invert(1)';
      ppIframe.style.backgroundColor = 'white'; // Add white background for inversion
      this.classList.add('active');
    } else {
      ppIframe.style.filter = 'none';
      ppIframe.style.backgroundColor = 'transparent'; // Remove any background
      this.classList.remove('active');
    }
    
    // Save invert setting to localStorage
    localStorage.setItem('pixelPerfectInverted', ppIsInverted.toString());
  });

  // Add scroll mode custom dropdown functionality
  scrollModeSelect.addEventListener('click', function(e) {
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
  scrollModeDropdown.addEventListener('click', function(e) {
    // Find the dropdown option that was clicked (could be the target or a parent)
    const dropdownOption = e.target.closest('.dropdown-option');
    
    if (dropdownOption) {
      e.stopPropagation(); // Prevent event from bubbling up to button click
      
      const newMode = dropdownOption.dataset.value;
      ppScrollMode = newMode;
      
      // Update button text
      const buttonText = scrollModeSelect.querySelector('span');
      buttonText.textContent = dropdownOption.querySelector('span:last-child').textContent;
      
      // Update selected state
      this.querySelectorAll('.dropdown-option').forEach(option => {
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
        ppIframe.style.transform = `translateY(-${mainScrollY}px)`;
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } else if (newMode === 'original') {
        // Only original page scrolls - keep iframe at current position
        const currentTransform = ppIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        ppIframe.style.transform = `translateY(${currentY}px)`;
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } else if (newMode === 'overlay') {
        // Only iframe scrolls - fix main page scroll position
        ppIframe.dataset.mainPageScrollY = window.scrollY.toString();
        // Calculate scrollbar width and compensate to prevent layout jump
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = scrollbarWidth + 'px';
      }
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!scrollModeSelect.contains(e.target)) {
      scrollModeDropdown.classList.remove('show');
    }
  });

  // Create settings menu
  const settingsMenu = div({ 
    id: 'settings-menu',
    style: 'display: none;'
  });
  
  // Add dock setting
  const dockOption = div({ class: 'settings-option' },
    span({ class: 'settings-text' }, 'Dock'),
    div({ class: 'dock-buttons' },
      div({ class: 'dock-btn', 'data-position': 'top' }, '⊤'),
      div({ class: 'dock-btn', 'data-position': 'bottom' }, '⊥')
    )
  );
  
  settingsMenu.appendChild(dockOption);
  

  
  // dark theme setting
  const darkThemeOption = div({ class: 'settings-option' },
    span({ class: 'settings-text' }, 'Dark theme'),
    label({ class: 'switch' },
      input({ type: 'checkbox', id: 'dark-theme-toggle', checked: true }),
      span({ class: 'slider round' })
    )
  );
  
  settingsMenu.appendChild(darkThemeOption);
  
  // Set default dark theme state
  const darkThemeToggle = darkThemeOption.querySelector('#dark-theme-toggle');
  const savedTheme = localStorage.getItem('pixelPerfectDarkTheme');
  if (savedTheme !== null) {
    darkThemeToggle.checked = savedTheme === 'true';
  } else {
    // Default to dark theme
    darkThemeToggle.checked = true;
    localStorage.setItem('pixelPerfectDarkTheme', 'true');
  }
  
  // Sync URL path setting
  const syncUrlPathOption = div({ class: 'settings-option' },
    span({ class: 'settings-text' }, 'Sync URL path'),
    label({ class: 'switch' },
      input({ type: 'checkbox', id: 'sync-url-path-toggle' }),
      span({ class: 'slider round' })
    )
  );
  
  settingsMenu.appendChild(syncUrlPathOption);
  
  // Set default sync URL path state
  const syncUrlPathToggle = syncUrlPathOption.querySelector('#sync-url-path-toggle');
  const savedSyncUrlPath = localStorage.getItem('pixelPerfectSyncUrlPath');
  if (savedSyncUrlPath !== null) {
    syncUrlPathToggle.checked = savedSyncUrlPath === 'true';
  } else {
    // Default to disabled
    syncUrlPathToggle.checked = false;
    localStorage.setItem('pixelPerfectSyncUrlPath', 'false');
  }
  

  
  // Add settings menu to controls
  ppControls.appendChild(settingsMenu);
  
  // Settings button click handler
  settingsBtn.addEventListener('click', function() {
    const isVisible = settingsMenu.style.display !== 'none';
    settingsMenu.style.display = isVisible ? 'none' : 'block';
  });
  
  // Close settings menu when clicking outside
  document.addEventListener('click', function(e) {
    // Don't close if clicking on the settings button itself
    if (e.target === settingsBtn || settingsBtn.contains(e.target)) {
      return;
    }
    
    // Close if clicking outside the settings menu
    if (!settingsMenu.contains(e.target)) {
      settingsMenu.style.display = 'none';
    }
  });
  
  // Dock functionality
  function dockControls(position) {
    // Remove any existing positioning and classes
    ppControls.style.transform = '';
    ppControls.style.left = '';
    ppControls.style.right = '';
    ppControls.classList.remove('top', 'bottom');
    
    if (position === 'top') {
      ppControls.classList.add('top');
    } else if (position === 'bottom') {
      ppControls.classList.add('bottom');
    }
    
    // Save dock position to localStorage
    localStorage.setItem('pixelPerfectDockPosition', position);
  }
  
  // Add dock button event listeners
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('dock-btn')) {
      const position = e.target.dataset.position;
      dockControls(position);
      
      // Close settings menu after selection
      settingsMenu.style.display = 'none';
    }
  });
  
  // Add dark theme toggle event listener
  document.addEventListener('change', function(e) {
    if (e.target.id === 'dark-theme-toggle') {
      const isDark = e.target.checked;
      localStorage.setItem('pixelPerfectDarkTheme', isDark.toString());
      
      // Apply theme to controls
      if (isDark) {
        ppControls.classList.add('dark-theme');
        ppControls.classList.remove('light-theme');
      } else {
        ppControls.classList.add('light-theme');
        ppControls.classList.remove('dark-theme');
      }
    } else if (e.target.id === 'sync-url-path-toggle') {
      const isSyncEnabled = e.target.checked;
      localStorage.setItem('pixelPerfectSyncUrlPath', isSyncEnabled.toString());
      
      if (isSyncEnabled) {
        // Check if current overlay URL path matches the page URL path
        const currentPageUrl = window.location.href;
        const currentPagePath = new URL(currentPageUrl).pathname;
        
        const storedOverlayUrl = localStorage.getItem('pixelPerfectUrl') || 'http://localhost:3000/';
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
          console.log('URL paths do not match, reloading page...');
          console.log('Page path:', normalizedPagePath);
          console.log('Overlay path:', normalizedOverlayPath);
          
          // Reload the page to sync the paths
          window.location.reload();
        } else {
          console.log('URL paths match, no reload needed');
        }
      }
    }
  });
  
  // Restore dock position from localStorage or default to bottom
  const savedDockPosition = localStorage.getItem('pixelPerfectDockPosition');
  if (savedDockPosition) {
    dockControls(savedDockPosition);
  } else {
    // Default to bottom if no saved position
    dockControls('bottom');
  }
  
  // Apply initial theme
  const initialTheme = localStorage.getItem('pixelPerfectDarkTheme');
  if (initialTheme === 'false') {
    ppControls.classList.add('light-theme');
    ppControls.classList.remove('dark-theme');
  } else {
    // Default to dark theme
    ppControls.classList.add('dark-theme');
    ppControls.classList.remove('light-theme');
  }
  
  
  closeBtn.addEventListener('click', function() {
    // Use the toggle function to ensure proper state management
    toggleOverlay();
  });


  // Add event listeners for scroll and arrow key handling
  document.addEventListener('wheel', globalWheelHandler, { passive: false });
  document.addEventListener('keydown', arrowKeyHandler);
  
  // Add scroll event listener for smoother sync in "both" mode
  window.addEventListener('scroll', throttle(syncIframeScroll, 10), { passive: true });

  // Add elements to URL container
  urlContainer.appendChild(urlInput);
  urlContainer.appendChild(openOverlayUrl);

  ppControls.appendChild(ppIcon);
  ppControls.appendChild(onOffToggle);
  ppControls.appendChild(urlContainer);
  ppControls.appendChild(sliderContainer);
  ppControls.appendChild(value);
  ppControls.appendChild(invertBtn);
  ppControls.appendChild(scrollModeSelect);
  ppControls.appendChild(settingsBtn);
  ppControls.appendChild(closeBtn);
  ppOverlay.appendChild(ppIframe);
  
  // Check toggle state and set overlay visibility accordingly
  const overlayToggleState = localStorage.getItem('pixelPerfectOn');
  const shouldShowOverlay = overlayToggleState !== 'false'; // Default to true unless explicitly false
  
  // Ensure toggle input state matches the stored state
  if (toggleInput) {
    toggleInput.checked = shouldShowOverlay;
    updateControlsClass(); // Update the visual state
  }
  
  if (!shouldShowOverlay) {
    // Hide overlay but keep controls visible
    ppOverlay.style.zIndex = '-999999';
    ppOverlay.style.opacity = '0';
    
    // Disable slider functionality but keep other controls enabled
    sliderContainer.classList.add('disabled');
    sliderContainer.style.pointerEvents = 'none';
    
    // Set slider to 0 and show OFF state
    sliderThumb.style.left = '0%';
    sliderFill.style.width = '0%';
    ppIframe.style.opacity = '0.5';
    value.textContent = 'OFF';
  }
  
  // Add both overlay and controls as siblings to body
  document.body.appendChild(ppOverlay);
  document.body.appendChild(ppControls);
  
  // Adjust overlay position to match content boundaries with a small delay
  // setTimeout(() => {
  //   adjustOverlayPosition();
  // }, 100);
  
  // // Add resize listener to adjust overlay position when window is resized
  // window.addEventListener('resize', adjustOverlayPosition);
  
} 