let overlay = null;
let controls = null;
let iframe = null;
let isInverted = false;
let isGrayscale = false;
let lastOpacityValue = 100;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  if (request.action === "toggleOverlay") {
    console.log('Toggling overlay...');
    toggleOverlay();
  }
});

function toggleOverlay() {
  console.log('toggleOverlay called, overlay exists:', !!overlay);
  
  if (overlay) {
    console.log('Removing existing overlay...');
    overlay.remove();
    overlay = null;
    controls = null;
    iframe = null;
    isInverted = false;
    isGrayscale = false;
    lastOpacityValue = 100;
    document.removeEventListener('wheel', globalWheelHandler);
    console.log('Overlay removed successfully');
  } else {
    console.log('Creating new overlay...');
    createOverlay();
  }
}

function createOverlay() {
  console.log('createOverlay started');
  
  overlay = document.createElement('div');
  overlay.id = 'overlay';
  console.log('Created overlay div');

  iframe = document.createElement('iframe');
  iframe.src = 'http://localhost:3000/';
  iframe.id = 'overlay-iframe';
  iframe.style.height = document.body.scrollHeight + 'px';
  iframe.style.pointerEvents = 'none';
  iframe.style.transition = 'transform 0.1s ease-out';
  console.log('Created iframe with src:', iframe.src);

  controls = document.createElement('div');
  controls.id = 'controls';
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

  // Add grayscale toggle button
  const grayscaleBtn = document.createElement('button');
  grayscaleBtn.textContent = 'Grayscale';
  grayscaleBtn.id = 'grayscale-btn';

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.id = 'close-btn';
  closeBtn.title = 'Close overlay';

  urlInput.addEventListener('change', function() {
    console.log('URL changed to:', this.value);
    iframe.src = this.value;
  });

  slider.addEventListener('input', function() {
    const opacity = this.value / 100;
    console.log('Slider changed to:', this.value, 'opacity:', opacity);
    iframe.style.opacity = opacity;
    value.textContent = this.value + '%';
    lastOpacityValue = parseInt(this.value);
  });

  // Add click handler to percentage display
  value.addEventListener('click', function() {
    console.log('Percentage clicked, current value:', value.textContent);
    if (value.textContent === '0%') {
      // Restore to last opacity value
      slider.value = lastOpacityValue;
      const opacity = lastOpacityValue / 100;
      iframe.style.opacity = opacity;
      value.textContent = lastOpacityValue + '%';
      console.log('Restored opacity to:', lastOpacityValue + '%');
    } else {
      // Set to 0%
      slider.value = 0;
      iframe.style.opacity = 0;
      value.textContent = '0%';
      console.log('Set opacity to 0%');
    }
  });

  invertBtn.addEventListener('click', function() {
    isInverted = !isInverted;
    console.log('Invert toggled to:', isInverted);
    
    if (isInverted) {
      iframe.style.filter = 'invert(1)';
      invertBtn.textContent = 'Normal';
      invertBtn.style.background = '#ff6b6b';
    } else {
      iframe.style.filter = 'none';
      invertBtn.textContent = 'Invert';
      invertBtn.style.background = '#00b4d8';
    }
  });

  grayscaleBtn.addEventListener('click', function() {
    isGrayscale = !isGrayscale;
    console.log('Grayscale toggled to:', isGrayscale);
    
    if (isGrayscale) {
      iframe.style.filter = 'grayscale(1)';
      grayscaleBtn.textContent = 'Color';
      grayscaleBtn.style.background = '#6b6bff';
    } else {
      iframe.style.filter = 'none';
      grayscaleBtn.textContent = 'Grayscale';
      grayscaleBtn.style.background = '#00b4d8';
    }
  });

  closeBtn.addEventListener('click', function() {
    console.log('Close button clicked');
    toggleOverlay();
  });

  // Make drag handle draggable
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let initialPosition = { x: 0, y: 0 };

  dragHandle.addEventListener('mousedown', function(e) {
    console.log('Drag handle mousedown');
    isDragging = true;
    
    // Get current position
    const rect = controls.getBoundingClientRect();
    initialPosition.x = rect.left;
    initialPosition.y = rect.top;
    
    // Calculate offset from mouse to controls
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    // Remove the centering transform and set absolute positioning
    controls.style.transform = 'none';
    controls.style.left = initialPosition.x + 'px';
    controls.style.top = initialPosition.y + 'px';
    
    controls.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      
      // Keep controls within viewport bounds
      const maxX = window.innerWidth - controls.offsetWidth;
      const maxY = window.innerHeight - controls.offsetHeight;
      
      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));
      
      controls.style.left = clampedX + 'px';
      controls.style.top = clampedY + 'px';
    }
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      console.log('Drag ended');
      isDragging = false;
      controls.style.cursor = 'default';
    }
  });

  // Global mouse wheel listener to scroll both page and iframe
  const globalWheelHandler = function(e) {
    e.preventDefault();

    const currentScroll = window.scrollY;
    const newScroll = currentScroll + e.deltaY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const clampedScroll = Math.max(0, Math.min(newScroll, maxScroll));

    window.scrollTo(0, clampedScroll);

    // Use CSS transform to simulate iframe scrolling
    const scrollPercent = clampedScroll / maxScroll;
    const iframeHeight = Math.max(iframe.scrollHeight - window.innerHeight, 1);
    const iframeTransformY = -scrollPercent * iframeHeight;

    iframe.style.transform = `translateY(${iframeTransformY}px)`;
  };
  document.addEventListener('wheel', globalWheelHandler, { passive: false });
  console.log('Added global wheel handler');

  controls.appendChild(dragHandle);
  controls.appendChild(urlInput);
  controls.appendChild(slider);
  controls.appendChild(value);
  controls.appendChild(invertBtn);
  controls.appendChild(grayscaleBtn);
  controls.appendChild(closeBtn);
  overlay.appendChild(iframe);
  overlay.appendChild(controls);

  document.body.appendChild(overlay);
  console.log('Overlay created and added to DOM successfully');
} 