# Pixel Perfect Overlay Chrome Extension

<img width="857" height="95" alt="image" src="https://github.com/user-attachments/assets/da84710f-40d7-4624-b0b8-9044ffef8c3a" />

A Chrome extension that overlays a development URL (e.g. localhost:3000) directly on top of any webpage for pixel-perfect comparison and design verification. Work in real time without the hassle of switching tabs.


**Adjust opacity and invert Colors to easily see alignment issues:**

<img title="BEFORE" width="282" height="282" alt="image" src="https://github.com/user-attachments/assets/03fd8c7c-9c64-440f-a3d7-7c352bed2e2a" />

<img title="AFTER" width="282" height="283" alt="image" src="https://github.com/user-attachments/assets/469d1d10-4a47-451d-9543-4af2352925b5" />









## Installation

1. **Download the files** - [Download the files](https://github.com/dave-fink/pixel-perfect-chrome-extension/archive/refs/heads/main.zip) or clone this repository to your computer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now appear in your extensions list
6. Pin it to your toolbar and click the icon to activate it on any web page

## Features

- **Full-screen overlay** - Overlays a wep page on top of the current URL
- **On/Off toggle** - Turn overlay off/on

- **Opacity slider** - Slider to adjust overlay transparency (0-100%)
- **Color inversion** - Toggle normal/inverted colors
- **Scroll modes** - Three scroll synchronization options:
  - "Scroll Both" - Both page and iframe scroll together
  - "Scroll Original" - Only original page scrolls *(↑/↓ arrows for 1px scrolling)*
  - "Scroll Overlay" - Only iframe scrolls *(↑/↓ arrows for 1px scrolling)*
- **URL sync** - Automatically sync overlay URL with current page path
  - Toggle on/off to lock overlay URL to current page navigation
  - Lock icon shows when sync is enabled
  - Overlay URL updates automatically as you navigate
- **URL validation** - Real-time URL accessibility checking
  - Automatically validates URLs when entered
  - Error icon displays for inaccessible URLs
  - Detailed error messages for troubleshooting
- **Positionable** - Control bar can be positioned at top or bottom of screen
- **Tab indicators** - Browser tab shows "(px)" prefix and extension favicon when overlay is active

## Known Issues

- **Viewport height (vh) challenges** - CSS vh units may behave differently between the main page and overlay iframe, causing slight height mismatches due to iframe height.  Working on a fix.
- **Cross-origin iframe limitations** - Some websites may have restrictions that limit overlay functionality


*⚠️ Disclaimer: This extension is under active development and may not be fully stable. While every effort has been made to ensure reliability, unexpected behavior may occur. If you find a bug, please open a GitHub issue with as much detail as possible. [create a GitHub issue](https://github.com/dave-fink/pixel-perfect-chrome-extension/issues).  Thank you*
