let overlay = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleOverlay") {
    toggleOverlay();
  }
});

function toggleOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  } else {
    createOverlay();
  }
}

function createOverlay() {
  // Create overlay
  overlay = document.createElement('div');
  overlay.id = 'overlay';
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = 'https://jsonplaceholder.typicode.com';
  iframe.id = 'overlay-iframe';
  
  // Set iframe to match page height
  iframe.style.height = document.body.scrollHeight + 'px';
  
  // Make iframe non-interactive to prevent it from capturing events
  iframe.style.pointerEvents = 'none';
  
  // Add smooth transition to iframe
  iframe.style.transition = 'transform 0.1s ease-out';
  
  // Global mouse wheel listener to scroll both page and iframe
  document.addEventListener('wheel', function(e) {
    e.preventDefault(); // Prevent default scroll behavior
    
    // Calculate new scroll position
    const currentScroll = window.scrollY;
    const newScroll = currentScroll + e.deltaY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const clampedScroll = Math.max(0, Math.min(newScroll, maxScroll));
    
    // Scroll the page
    window.scrollTo(0, clampedScroll);
    
    // Use CSS transform to simulate iframe scrolling with smoother calculation
    const scrollPercent = clampedScroll / maxScroll;
    const iframeHeight = Math.max(iframe.scrollHeight - window.innerHeight, 1); // Prevent division by zero
    const iframeTransformY = -scrollPercent * iframeHeight;
    
    console.log('Using CSS transform for iframe scroll:', {
      scrollPercent,
      iframeHeight,
      iframeTransformY
    });
    
    iframe.style.transform = `translateY(${iframeTransformY}px)`;
  }, { passive: false });
  
  // Make iframe scroll control page scroll
  iframe.addEventListener('load', function() {
    console.log('Iframe loaded - using CSS transform for scroll sync');
  });
  
  // Also sync page scroll to iframe
  window.addEventListener('scroll', function() {
    if (iframe.contentWindow) {
      try {
        const pageScrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        const iframeMaxScroll = iframe.contentDocument.body.scrollHeight - iframe.contentWindow.innerHeight;
        const iframeScrollY = pageScrollPercent * iframeMaxScroll;
        iframe.contentWindow.scrollTo(0, iframeScrollY);
      } catch (e) {
        // Cross-origin restrictions
      }
    }
  });
  
  // Create controls
  const controls = document.createElement('div');
  controls.id = 'controls';
  
  const dragHandle = document.createElement('div');
  dragHandle.id = 'drag-handle';
  
  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = 'Enter URL';
  urlInput.value = 'https://jsonplaceholder.typicode.com';
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
  
  // Add URL change handler
  urlInput.addEventListener('change', function() {
    iframe.src = this.value;
  });
  
  // Add slider event
  slider.addEventListener('input', function() {
    iframe.style.opacity = this.value / 100;
    value.textContent = this.value + '%';
  });
  
  // Assemble
  controls.appendChild(dragHandle);
  controls.appendChild(urlInput);
  controls.appendChild(slider);
  controls.appendChild(value);
  overlay.appendChild(iframe);
  overlay.appendChild(controls);
  
  // Make drag handle draggable
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;
    const rect = controls.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    controls.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      controls.style.left = x + 'px';
      controls.style.top = y + 'px';
    }
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
    controls.style.cursor = 'default';
  });
  
  document.body.appendChild(overlay);
} 