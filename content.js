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
let ppScrollMode = 'both'; // 'both', 'original', 'overlay'
let ppIsActive = false; // Track if extension is active

// Favicon management
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
        const newFavicon = document.createElement('link');
        newFavicon.rel = 'icon';
        newFavicon.href = overlayFavicon;
        newFavicon.id = 'pixel-perfect-favicon';
        
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
      const originalFaviconLink = document.createElement('link');
      originalFaviconLink.rel = 'icon';
      originalFaviconLink.href = originalFavicon;
      document.head.appendChild(originalFaviconLink);
      console.log('Original favicon restored:', originalFavicon);
    }
  }
}

  // Function to detect webpage content boundaries
function detectContentBoundaries() {
  // Look for common content containers
  const selectors = [
    'main',
    'article',
    '.main',
    '.content',
    '.container',
    '.wrapper',
    '#main',
    '#content',
    '#container',
    '#wrapper',
    'body > div:first-child',
    'body > div:first-child > div'
  ];
  
  let contentElement = null;
  
  // Find the first matching content element
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
      contentElement = element;
      break;
    }
  }
  
  // If no content element found, try to find the largest content area
  if (!contentElement) {
    const allDivs = document.querySelectorAll('div');
    let largestArea = 0;
    
    for (const div of allDivs) {
      const rect = div.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > largestArea && rect.width > 200 && rect.height > 200) {
        largestArea = area;
        contentElement = div;
      }
    }
  }
  
  // If still no content element found, use body
  if (!contentElement) {
    contentElement = document.body;
  }
  
  const rect = contentElement.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  
  return {
    left: rect.left,
    right: rect.right,
    width: rect.width,
    bodyLeft: bodyRect.left,
    bodyWidth: bodyRect.width
  };
}

// Function to check if page has a transparent background
function hasTransparentBackground() {
  // Check body background
  const bodyStyle = window.getComputedStyle(document.body);
  const bodyBg = bodyStyle.backgroundColor;
  
  // Check html background
  const htmlStyle = window.getComputedStyle(document.documentElement);
  const htmlBg = htmlStyle.backgroundColor;
  
  // Check if backgrounds are transparent or rgba(0,0,0,0)
  const isTransparent = (color) => {
    return color === 'transparent' || 
           color === 'rgba(0, 0, 0, 0)' || 
           color === 'rgba(0,0,0,0)' ||
           color === 'initial' ||
           color === 'inherit';
  };
  
  const bodyTransparent = isTransparent(bodyBg);
  const htmlTransparent = isTransparent(htmlBg);
  
  return bodyTransparent && htmlTransparent;
}

// Function to adjust overlay positioning to match content
function adjustOverlayPosition() {
  if (!ppOverlay) return;
  
  const boundaries = detectContentBoundaries();
  const viewportWidth = window.innerWidth;
  
  // Calculate the offset needed to align with content
  const contentLeft = boundaries.left;
  const contentWidth = boundaries.width;
  
  // If content is centered or has margins, adjust overlay accordingly
  if (contentLeft > 0 || contentWidth < viewportWidth) {
    ppOverlay.style.left = contentLeft + 'px';
    ppOverlay.style.width = contentWidth + 'px';
  } else {
    // Reset to full viewport if content spans full width
    ppOverlay.style.left = '0px';
    ppOverlay.style.width = '100vw';
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
  }
});

// Check if we should auto-create overlay on page load
function autoRestoreOverlay() {
  const storedUrl = localStorage.getItem('pixelPerfectUrl');
  const isActive = localStorage.getItem('pixelPerfectActive') === 'true';
  
  if (storedUrl && isActive) {
    // Longer delay to ensure page is fully loaded and extension is ready
    setTimeout(() => {
      if (!ppOverlay) {
        toggleOverlay();
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
  const overlayInDOM = document.getElementById('overlay');
  const controlsInDOM = document.getElementById('controls');
  
  if (ppOverlay || overlayInDOM || controlsInDOM) {
    if (ppOverlay) ppOverlay.remove();
    if (overlayInDOM) overlayInDOM.remove();
    if (controlsInDOM) controlsInDOM.remove();
    
    ppControls = null;
    ppIframe = null;
    ppOverlay = null;
    ppIsInverted = false;
    ppLastOpacityValue = 100;
    ppIsActive = false;
    
    // Remove event listeners
    document.removeEventListener('wheel', globalWheelHandler);
    document.removeEventListener('keydown', arrowKeyHandler);
    window.removeEventListener('resize', adjustOverlayPosition);
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
  ppOverlay = document.createElement('div');
  ppOverlay.id = 'overlay';

  ppIframe = document.createElement('iframe');
  // Check for stored URL or use default
  const iframeStoredUrl = localStorage.getItem('pixelPerfectUrl');
  const baseUrl = iframeStoredUrl || 'http://localhost:3000/';
  ppIframe.src = baseUrl;
  ppIframe.id = 'overlay-iframe';
  ppIframe.style.height = document.body.scrollHeight + 'px';
  ppIframe.style.pointerEvents = 'none';
  ppIframe.style.transition = 'transform 0.1s ease-out';
  ppIframe.style.touchAction = 'none'; // Prevent touch scrolling on iframe
  ppIframe.style.willChange = 'transform'; // Optimize for transform animations
  
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
  
  ppControls = document.createElement('div');
  ppControls.id = 'controls';

  const ppIcon = document.createElement('div');
  ppIcon.id = 'pixel-perfect-icon';

  // Create URL input container
  const urlContainer = document.createElement('div');
  urlContainer.id = 'url-container';
  urlContainer.style.position = 'relative';
  urlContainer.style.display = 'inline-block';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = 'Enter localhost URL';
  // Set input value to stored URL or default
  const inputStoredUrl = localStorage.getItem('pixelPerfectUrl');
  urlInput.value = inputStoredUrl || 'http://localhost:3000/';
  urlInput.id = 'url-input';
  urlInput.title = 'Enter the URL for the overlay';


  
  // Add open overlay button
  const openOverlayUrl = document.createElement('button');
  openOverlayUrl.innerHTML = `
    <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 358.05 355.34">
      <path d="M22.04,57.84v276.49h276v-188.15c0-7.87,16.35-12.88,20.24-3.24l.21,206.31c-1.9,3.82-5.55,6.05-9.9,6.09l-300.58-.52c-3.99-1.48-6.2-3.52-7.29-7.7L0,50.31c-.01-5.4,1.38-10,6.3-12.68h206.49c9.66,3.89,4.64,20.21-3.24,20.21H22.04Z"/>
      <path d="M335.04,36.88l-167.96,167.23c-10.59,7.64-23.19-4.39-15.05-15.02L320.04,20.9h-73.5c-.69,0-4.56-2.71-5.36-3.63-4.72-5.48-2.25-16.06,5.42-17.27l104.18.7c4.22,2.29,6.1,7.05,6.3,11.68-2.52,29.69,3.28,64.7-.15,93.76-.74,6.29-3.58,11.12-10.51,11.56-4.78.3-11.37-4.69-11.37-9.45V36.88Z"/>
    </svg>
  `;
  openOverlayUrl.id = 'open-overlay-url';
  openOverlayUrl.title = 'Open overlay in new tab';
  
  openOverlayUrl.addEventListener('click', () => {
    if (ppIframe && ppIframe.src) {
      // Remove the cache buster for the new tab
      const baseUrl = ppIframe.src.split('?')[0];
      window.open(baseUrl, '_blank');
    }
  });

  const sliderContainer = document.createElement('div');
  sliderContainer.id = 'opacity-slider';
  
  const sliderTrack = document.createElement('div');
  sliderTrack.id = 'slider-track';
  
  const sliderFill = document.createElement('div');
  sliderFill.id = 'slider-fill';
  
  const sliderThumb = document.createElement('div');
  sliderThumb.id = 'slider-thumb';
  
  // Get stored opacity value or default to 100
  const storedOpacity = localStorage.getItem('pixelPerfectOpacity');
  const initialValue = parseInt(storedOpacity) || 100;
  
  sliderContainer.appendChild(sliderTrack);
  sliderContainer.appendChild(sliderFill);
  sliderContainer.appendChild(sliderThumb);

  const value = document.createElement('span');
  value.id = 'opacity-value';
  // Set percentage text to match stored opacity
  const textStoredOpacity = localStorage.getItem('pixelPerfectOpacity');
  const opacityValue = textStoredOpacity || '100';
  value.textContent = opacityValue + '%';
  value.title = 'Current opacity value';

  // Add invert toggle button
  const invertBtn = document.createElement('button');
  invertBtn.textContent = 'Invert';
  invertBtn.id = 'invert-btn';
  
  // Restore invert state from localStorage
  const buttonStoredInverted = localStorage.getItem('pixelPerfectInverted');
  if (buttonStoredInverted === 'true') {
    ppIsInverted = true;
    invertBtn.classList.add('active');
  }

  // Add scroll mode custom dropdown
  const scrollModeSelect = document.createElement('div');
  scrollModeSelect.id = 'scroll-mode-select';
  scrollModeSelect.title = 'Select scroll mode';
  
  // Create text span for the button
  const buttonText = document.createElement('span');
  buttonText.textContent = 'Scroll Both';
  scrollModeSelect.appendChild(buttonText);
  
  // Create custom dropdown
  const scrollModeDropdown = document.createElement('div');
  scrollModeDropdown.id = 'scroll-mode-dropdown';
  
  // Create dropdown options
  const options = [
    { value: 'both', text: 'Scroll Both', selected: true },
    { value: 'original', text: 'Scroll Page', selected: false },
    { value: 'overlay', text: 'Scroll Overlay', selected: false }
  ];
  
  options.forEach(option => {
    const optionElement = document.createElement('div');
    optionElement.className = `dropdown-option ${option.selected ? 'selected' : ''}`;
    optionElement.dataset.value = option.value;
    
    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    checkmark.textContent = option.selected ? '✓' : '';
    
    const text = document.createElement('span');
    text.textContent = option.text;
    
    optionElement.appendChild(checkmark);
    optionElement.appendChild(text);
    scrollModeDropdown.appendChild(optionElement);
  });
  
  // Add dropdown to select button
  scrollModeSelect.appendChild(scrollModeDropdown);

  // Add on/off toggle switch
  const onOffToggle = document.createElement('label');
  onOffToggle.id = 'on-off-toggle';
  onOffToggle.title = 'Toggle overlay on/off';
  onOffToggle.style.marginRight = '8px';
  
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = true; // Start as ON
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'slider round';
  
  onOffToggle.appendChild(toggleInput);
  onOffToggle.appendChild(toggleSlider);
  
  // Add on/off class based on toggle state
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
  const settingsBtn = document.createElement('button');
  settingsBtn.innerHTML = '≡';
  settingsBtn.id = 'settings-btn';
  settingsBtn.title = 'Settings';
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.id = 'close-btn';
  closeBtn.title = 'Close overlay';
  
  // Add open overlay button
  const openOverlay = document.createElement('button');
  openOverlay.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  openOverlay.id = 'open-overlay';
  openOverlay.title = 'Open overlay in new tab for inspection';
  openOverlay.addEventListener('click', () => {
    if (ppIframe && ppIframe.src) {
      window.open(ppIframe.src, '_blank');
    }
  });




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
    } else {
      // Store current opacity before turning off
      const currentLeft = parseFloat(sliderThumb.style.left) || 0;
      ppLastOpacityValue = Math.round(currentLeft);
      
      // Hide overlay and disable all controls
      ppOverlay.style.zIndex = '-999999';
      ppOverlay.style.opacity = '0';
      
      // Disable all controls except close button and toggle switch
      sliderContainer.classList.add('disabled');
      sliderContainer.style.pointerEvents = 'none';
      urlInput.disabled = true;
      // invertBtn.disabled = true;
      scrollModeSelect.disabled = true;
      
      // Move slider to 0 and set 50% opacity for OFF state
      sliderThumb.style.left = '0%';
      sliderFill.style.width = '0%';
      ppIframe.style.opacity = '0.5';
      value.textContent = 'OFF';
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
  const settingsMenu = document.createElement('div');
  settingsMenu.id = 'settings-menu';
  settingsMenu.style.display = 'none';
  
  // Add dock setting
  const dockOption = document.createElement('div');
  dockOption.className = 'settings-option';
  dockOption.innerHTML = `
    <span class="settings-text">Dock</span>
    <div class="dock-buttons">
      <button class="dock-btn" data-position="top">⊤</button>
      <button class="dock-btn" data-position="bottom">⊥</button>
    </div>
  `;
  
  settingsMenu.appendChild(dockOption);
  

  
  // dark theme setting
  const darkThemeOption = document.createElement('div');
  darkThemeOption.className = 'settings-option';
  darkThemeOption.innerHTML = `
    <span class="settings-text">Dark theme</span>
    <label class="switch">
      <input type="checkbox" id="dark-theme-toggle" checked>
      <span class="slider round"></span>
    </label>
  `;
  
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
  window.addEventListener('scroll', throttle(syncIframeScroll, 16), { passive: true });

  // Add elements to URL container
  urlContainer.appendChild(urlInput);

  ppControls.appendChild(ppIcon);
  ppControls.appendChild(onOffToggle);
  ppControls.appendChild(urlContainer);
  ppControls.appendChild(openOverlayUrl);
  ppControls.appendChild(sliderContainer);
  ppControls.appendChild(value);
  ppControls.appendChild(invertBtn);
  ppControls.appendChild(scrollModeSelect);
  ppControls.appendChild(settingsBtn);
  ppControls.appendChild(closeBtn);
  ppOverlay.appendChild(ppIframe);
  
  // Add both overlay and controls as siblings to body
  document.body.appendChild(ppOverlay);
  document.body.appendChild(ppControls);
  
  // Adjust overlay position to match content boundaries with a small delay
  setTimeout(() => {
    adjustOverlayPosition();
  }, 100);
  
  // Add resize listener to adjust overlay position when window is resized
  window.addEventListener('resize', adjustOverlayPosition);
  
} 