let ppOverlay = null;
let ppControls = null;
let ppIframe = null;
let ppIsInverted = false;
let ppLastOpacityValue = 100;
let ppScrollMode = 'both'; // 'both', 'original', 'overlay'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  if (request.action === "toggleOverlay") {
    console.log('Toggling overlay...');
    toggleOverlay();
  }
});

function toggleOverlay() {
  console.log('toggleOverlay called, overlay exists:', !!ppOverlay);
  
  if (ppOverlay) {
    console.log('Removing existing overlay...');
    ppOverlay.remove();
    ppOverlay = null;
    ppControls = null;
    ppIframe = null;
    ppIsInverted = false;
    ppLastOpacityValue = 100;
    document.removeEventListener('wheel', globalWheelHandler);
    console.log('Overlay removed successfully');
  } else {
    console.log('Creating new overlay...');
    createOverlay();
  }
}

function createOverlay() {
  console.log('createOverlay started');
  
  ppOverlay = document.createElement('div');
  ppOverlay.id = 'overlay';
  console.log('Created overlay div');

  ppIframe = document.createElement('iframe');
  ppIframe.src = 'http://localhost:3000/';
  ppIframe.id = 'overlay-iframe';
  ppIframe.style.height = document.body.scrollHeight + 'px';
  ppIframe.style.pointerEvents = 'none';
  ppIframe.style.transition = 'transform 0.1s ease-out';
  console.log('Created iframe with src:', ppIframe.src);

  ppControls = document.createElement('div');
  ppControls.id = 'controls';
  console.log('Created controls div');

  const dragHandle = document.createElement('div');
  dragHandle.id = 'drag-handle';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = 'Enter localhost URL';
  urlInput.value = 'http://localhost:3000/';
  urlInput.id = 'url-input';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '100';
  slider.id = 'opacity-slider';

  const value = document.createElement('span');
  value.id = 'opacity-value';
  value.textContent = '100%';
  value.style.cursor = 'pointer';
  value.title = 'Click to toggle 0%';

  // Add invert toggle button
  const invertBtn = document.createElement('button');
  invertBtn.textContent = 'Invert';
  invertBtn.id = 'invert-btn';

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
  originalOption.textContent = 'Scroll Original';
  
  const overlayOption = document.createElement('option');
  overlayOption.value = 'overlay';
  overlayOption.textContent = 'Scroll Overlay';
  
  scrollModeSelect.appendChild(bothOption);
  scrollModeSelect.appendChild(originalOption);
  scrollModeSelect.appendChild(overlayOption);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.id = 'close-btn';
  closeBtn.title = 'Close overlay';

  urlInput.addEventListener('change', function() {
    console.log('URL changed to:', this.value);
    ppIframe.src = this.value;
  });

  slider.addEventListener('input', function() {
    const opacity = this.value / 100;
    console.log('Slider changed to:', this.value, 'opacity:', opacity);
    ppIframe.style.opacity = opacity;
    value.textContent = this.value + '%';
    ppLastOpacityValue = parseInt(this.value);
  });

  // Add click handler to percentage display
  value.addEventListener('click', function() {
    console.log('Percentage clicked, current value:', value.textContent);
    if (value.textContent === 'OFF') {
      // Show overlay and restore opacity
      ppOverlay.style.zIndex = '999999';
      ppOverlay.style.opacity = '1';
      slider.disabled = false;
      slider.value = ppLastOpacityValue;
      const opacity = ppLastOpacityValue / 100;
      ppIframe.style.opacity = opacity;
      value.textContent = ppLastOpacityValue + '%';
      console.log('Restored overlay with opacity:', ppLastOpacityValue + '%');
    } else {
      // Hide overlay by moving it behind everything and setting opacity to 0
      ppOverlay.style.zIndex = '-999999';
      ppOverlay.style.opacity = '0';
      slider.disabled = true;
      value.textContent = 'OFF';
      console.log('Hidden overlay with z-index and opacity 0');
    }
  });

  invertBtn.addEventListener('click', function() {
    ppIsInverted = !ppIsInverted;
    console.log('Invert toggled to:', ppIsInverted);

    if (ppIsInverted) {
      ppIframe.style.filter = 'invert(1)';
      invertBtn.textContent = 'Normal';
    } else {
      ppIframe.style.filter = 'none';
      invertBtn.textContent = 'Invert';
    }
  });

  // Add scroll mode dropdown functionality
  scrollModeSelect.addEventListener('change', function() {
    const newMode = this.value;
    console.log('Scroll mode changing from', ppScrollMode, 'to', newMode);
    
    if (newMode === 'original' && ppScrollMode === 'both') {
      // Switching from both to original
      ppScrollMode = 'original';
      // Preserve iframe position when switching to original-only mode
      const currentTransform = ppIframe.style.transform;
      const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
      // Store current iframe position for later restoration
      ppIframe.dataset.savedPosition = currentY;
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
    } else if (newMode === 'both') {
      // Switching back to both
      ppScrollMode = 'both';
      // When switching back to both, let it sync naturally
      // Restore main page scroll and padding
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    console.log('Scroll mode changed to:', ppScrollMode);
  });

  closeBtn.addEventListener('click', function() {
    console.log('Close button clicked');
    // Remove both overlay and controls since they are now separate siblings
    if (ppOverlay) {
      ppOverlay.remove();
      ppOverlay = null;
    }
    if (ppControls) {
      ppControls.remove();
      ppControls = null;
    }
    ppIframe = null;
    ppIsInverted = false;
    ppLastOpacityValue = 100;
    document.removeEventListener('wheel', globalWheelHandler);
    // Remove arrow key event listener
    document.removeEventListener('keydown', arrowKeyHandler);
    console.log('Overlay and controls removed successfully');
  });

  // Make drag handle draggable
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let initialPosition = { x: 0, y: 0 };

  dragHandle.addEventListener('mousedown', function(e) {
    console.log('Drag handle mousedown');
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

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      ppControls.style.cursor = 'default';
    }
  });

  // Global wheel handler for scroll sync
  function globalWheelHandler(e) {
    if (ppIframe && ppIframe.style.opacity !== '0') {
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
        
        const scrollAmount = e.deltaY;
        const currentTransform = ppIframe.style.transform;
        const currentY = currentTransform ? parseFloat(currentTransform.match(/translateY\(([^)]+)\)/)?.[1] || 0) : 0;
        const newY = currentY - scrollAmount;
        
        if (newY <= 0 && newY >= -10000) {
          ppIframe.style.transform = `translateY(${newY}px)`;
        }
        
        // Immediately force main page back to stored position
        const storedMainScrollY = ppIframe.dataset.mainPageScrollY || '0';
        window.scrollTo(0, parseInt(storedMainScrollY));
        
        return false; // Prevent event from bubbling up
      }
    }
  }

  document.addEventListener('wheel', globalWheelHandler);
  
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
  
  document.addEventListener('keydown', arrowKeyHandler);

  ppControls.appendChild(dragHandle);
  ppControls.appendChild(urlInput);
  ppControls.appendChild(slider);
  ppControls.appendChild(value);
  ppControls.appendChild(invertBtn);
  ppControls.appendChild(scrollModeSelect);
  ppControls.appendChild(closeBtn);
  ppOverlay.appendChild(ppIframe);
  
  // Add both overlay and controls as siblings to body
  document.body.appendChild(ppOverlay);
  document.body.appendChild(ppControls);
  console.log('Overlay and controls created and added to DOM successfully');
} 