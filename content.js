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
function globalWheelHandler(e) {
  if (ppIframe && ppIframe.style.opacity !== '0') {
    const scrollAmount = e.deltaY;

    if (ppScrollMode === 'both') {
      // Let natural scroll happen, sync iframe to main page
      const mainScrollY = window.scrollY;
      ppIframe.style.transform = `translateY(-${mainScrollY}px)`;
    } else if (ppScrollMode === 'original') {
      // Only scroll main page, iframe stays at current position
      // Don't change iframe position - let it stay where it is
    } else if (ppScrollMode === 'overlay') {
      // Only scroll iframe, prevent main page scroll completely
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Immediately force main page back to stored position
      const storedMainScrollY = ppIframe.dataset.mainPageScrollY || '0';
      window.scrollTo(0, parseInt(storedMainScrollY));

      const currentTransform = ppIframe.style.transform;
      const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
      const newY = currentY - scrollAmount;

      if (newY <= 0 && newY >= -10000) { // Simple boundary check
        ppIframe.style.transform = `translateY(${newY}px)`;
      }
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
    
    // Store inactive state
    localStorage.setItem('pixelPerfectActive', 'false');
    // Update toolbar icon to gray
    chrome.runtime.sendMessage({ action: 'updateIcon', active: false }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending updateIcon message:', chrome.runtime.lastError);
      }
    });
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
  }
}

function createOverlay() {
  ppOverlay = document.createElement('div');
  ppOverlay.id = 'overlay';

  ppIframe = document.createElement('iframe');
  // Check for stored URL or use default
  const iframeStoredUrl = localStorage.getItem('pixelPerfectUrl');
  ppIframe.src = iframeStoredUrl || 'http://localhost:3000/';
  ppIframe.id = 'overlay-iframe';
  ppIframe.style.height = document.body.scrollHeight + 'px';
  ppIframe.style.pointerEvents = 'none';
  ppIframe.style.transition = 'transform 0.1s ease-out';
  ppIframe.style.touchAction = 'none'; // Prevent touch scrolling on iframe
  
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

  const dragHandle = document.createElement('div');
  dragHandle.id = 'drag-handle';
  dragHandle.title = 'Drag to move';

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

  const goButton = document.createElement('button');
  goButton.innerHTML = '→';
  goButton.id = 'go-button';
  goButton.title = 'Go to URL';
  goButton.style.position = 'absolute';
  goButton.style.right = '8px';
  goButton.style.top = '50%';
  goButton.style.transform = 'translateY(-50%)';
  goButton.style.zIndex = '1';

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
    invertBtn.textContent = 'Normal';
  }

  // Add scroll mode dropdown
  const scrollModeSelect = document.createElement('select');
  scrollModeSelect.id = 'scroll-mode-select';
  scrollModeSelect.title = 'Select scroll mode';
  
  // Create options for the dropdown
  const bothOption = document.createElement('option');
  bothOption.value = 'both';
  bothOption.textContent = 'Scroll Both';
  bothOption.selected = true;
  
  const originalOption = document.createElement('option');
  originalOption.value = 'original';
  originalOption.textContent = 'Scroll Page';
  
  const overlayOption = document.createElement('option');
  overlayOption.value = 'overlay';
  overlayOption.textContent = 'Scroll Overlay';
  
  scrollModeSelect.appendChild(bothOption);
  scrollModeSelect.appendChild(originalOption);
  scrollModeSelect.appendChild(overlayOption);

  // Add on/off toggle switch
  const toggleSwitch = document.createElement('label');
  toggleSwitch.className = 'switch';
  toggleSwitch.title = 'Toggle overlay on/off';
  toggleSwitch.style.marginRight = '8px';
  
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = true; // Start as ON
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'slider round';
  
  toggleSwitch.appendChild(toggleInput);
  toggleSwitch.appendChild(toggleSlider);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.id = 'close-btn';
  closeBtn.title = 'Close overlay';

  // Add manual adjustment buttons
  const leftBtn = document.createElement('button');
  leftBtn.textContent = '←';
  leftBtn.id = 'left-btn';
  leftBtn.title = 'Shift overlay left';
  
  const adjustLeft = () => {
    const currentLeft = parseInt(ppOverlay.style.left) || 0;
    ppOverlay.style.left = (currentLeft - 1) + 'px';
  };
  
  leftBtn.addEventListener('click', adjustLeft);
  leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    adjustLeft();
  });

  const rightBtn = document.createElement('button');
  rightBtn.textContent = '→';
  rightBtn.id = 'right-btn';
  rightBtn.title = 'Shift overlay right';
  
  const adjustRight = () => {
    const currentLeft = parseInt(ppOverlay.style.left) || 0;
    ppOverlay.style.left = (currentLeft + 1) + 'px';
  };
  
  rightBtn.addEventListener('click', adjustRight);
  rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    adjustRight();
  });


  // URL handling with Go button and page reload
  goButton.addEventListener('click', function() {
    // Store URL in localStorage and reload page to bypass CSP
    localStorage.setItem('pixelPerfectUrl', urlInput.value);
    window.location.reload();
  });

  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      goButton.click();
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
    document.addEventListener('touchmove', onSliderTouchMove);
    document.addEventListener('touchend', onSliderTouchEnd);
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
  });
  
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
      goButton.disabled = false;
      invertBtn.disabled = false;
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
      goButton.disabled = true;
      invertBtn.disabled = true;
      scrollModeSelect.disabled = true;
      
      // Move slider to 0 and set 50% opacity for OFF state
      slider.value = '0';
      ppIframe.style.opacity = '0.5';
      value.textContent = 'OFF';
    }
  });

  invertBtn.addEventListener('click', function() {
    ppIsInverted = !ppIsInverted;

    if (ppIsInverted) {
      ppIframe.style.filter = 'invert(1)';
      ppIframe.style.backgroundColor = 'white'; // Add white background for inversion
      invertBtn.textContent = 'Normal';
    } else {
      ppIframe.style.filter = 'none';
      ppIframe.style.backgroundColor = 'transparent'; // Remove any background
      invertBtn.textContent = 'Invert';
    }
    
    // Save invert setting to localStorage
    localStorage.setItem('pixelPerfectInverted', ppIsInverted.toString());
  });

  // Add scroll mode dropdown functionality
  scrollModeSelect.addEventListener('change', function() {
    const newMode = this.value;
    
    if (newMode === 'original' && ppScrollMode === 'both') {
      // Switching from both to original
      ppScrollMode = 'original';
      // Preserve iframe position when switching to original-only mode
      const currentTransform = ppIframe.style.transform;
      const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
      // Store current iframe position for later restoration
      ppIframe.dataset.savedPosition = currentY;
      // Reset iframe transform to keep it at current position
      ppIframe.style.transform = `translateY(${currentY}px)`;
      // Restore main page scroll and padding
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    } else if (newMode === 'overlay' && ppScrollMode === 'original') {
      // Switching from original to overlay
      ppScrollMode = 'overlay';
      // Restore iframe position when switching to overlay-only mode
      const savedPosition = ppIframe.dataset.savedPosition || '0';
      ppIframe.style.transform = `translateY(${savedPosition}px)`;
      // Store current main page scroll position to keep it fixed
      ppIframe.dataset.mainPageScrollY = window.scrollY.toString();
      // Calculate scrollbar width and compensate
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = scrollbarWidth + 'px';
    } else if (newMode === 'original' && ppScrollMode === 'overlay') {
      // Switching from overlay to original
      ppScrollMode = 'original';
      // Store current iframe position for later restoration
      const currentTransform = ppIframe.style.transform;
      const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
      ppIframe.dataset.savedPosition = currentY;
      // Reset iframe transform to keep it at current position
      ppIframe.style.transform = `translateY(${currentY}px)`;
      // Restore main page scroll and padding
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    } else if (newMode === 'both') {
      // Switching back to both
      ppScrollMode = 'both';
      // Reset iframe transform to sync with current page scroll
      const mainScrollY = window.scrollY;
      ppIframe.style.transform = `translateY(-${mainScrollY}px)`;
      // When switching back to both, let it sync naturally
      // Restore main page scroll and padding
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  });

  closeBtn.addEventListener('click', function() {
    // Use the toggle function to ensure proper state management
    toggleOverlay();
  });



  // Make drag handle draggable
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let initialPosition = { x: 0, y: 0 };

  // Restore position from localStorage
  const savedPosition = localStorage.getItem('pixelPerfectPosition');
  if (savedPosition) {
    const position = JSON.parse(savedPosition);
    ppControls.style.transform = 'none';
    ppControls.style.left = position.x + 'px';
    ppControls.style.top = position.y + 'px';
  }

  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;

    // Get current position
    const rect = ppControls.getBoundingClientRect();
    initialPosition.x = rect.left;
    initialPosition.y = rect.top;

    // Calculate offset from mouse to controls
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    // Remove the centering transform and set absolute positioning
    ppControls.style.transform = 'none';
    ppControls.style.left = initialPosition.x + 'px';
    ppControls.style.top = initialPosition.y + 'px';

    ppControls.style.cursor = 'grabbing';
  });

  // Add touch support for dragging
  dragHandle.addEventListener('touchstart', function(e) {
    e.preventDefault();
    isDragging = true;

    const touch = e.touches[0];
    const rect = ppControls.getBoundingClientRect();
    initialPosition.x = rect.left;
    initialPosition.y = rect.top;

    dragOffset.x = touch.clientX - rect.left;
    dragOffset.y = touch.clientY - rect.top;

    ppControls.style.transform = 'none';
    ppControls.style.left = initialPosition.x + 'px';
    ppControls.style.top = initialPosition.y + 'px';
  });

  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;

      // Keep controls within viewport bounds
      const maxX = window.innerWidth - ppControls.offsetWidth;
      const maxY = window.innerHeight - ppControls.offsetHeight;

      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));

      ppControls.style.left = clampedX + 'px';
      ppControls.style.top = clampedY + 'px';
    }
  });

  // Add touch move support
  document.addEventListener('touchmove', function(e) {
    if (isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      const x = touch.clientX - dragOffset.x;
      const y = touch.clientY - dragOffset.y;

      // Keep controls within viewport bounds
      const maxX = window.innerWidth - ppControls.offsetWidth;
      const maxY = window.innerHeight - ppControls.offsetHeight;

      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));

      ppControls.style.left = clampedX + 'px';
      ppControls.style.top = clampedY + 'px';
    }
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      ppControls.style.cursor = 'default';
      
      // Save position to localStorage
      const rect = ppControls.getBoundingClientRect();
      const position = {
        x: rect.left,
        y: rect.top
      };
      localStorage.setItem('pixelPerfectPosition', JSON.stringify(position));
    }
  });

  // Add touch end support
  document.addEventListener('touchend', function() {
    if (isDragging) {
      isDragging = false;
      
      // Save position to localStorage
      const rect = ppControls.getBoundingClientRect();
      const position = {
        x: rect.left,
        y: rect.top
      };
      localStorage.setItem('pixelPerfectPosition', JSON.stringify(position));
    }
  });

  // Add event listeners for scroll and arrow key handling
  document.addEventListener('wheel', globalWheelHandler);
  document.addEventListener('keydown', arrowKeyHandler);

  // Add elements to URL container
  urlContainer.appendChild(urlInput);
  urlContainer.appendChild(goButton);

  ppControls.appendChild(dragHandle);
  ppControls.appendChild(toggleSwitch);
  ppControls.appendChild(urlContainer);
  ppControls.appendChild(sliderContainer);
  ppControls.appendChild(value);
  ppControls.appendChild(invertBtn);
  ppControls.appendChild(scrollModeSelect);
  ppControls.appendChild(leftBtn);
  ppControls.appendChild(rightBtn);
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