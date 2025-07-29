# Pixel Perfect Overlay Chrome Extension

A Chrome extension for pixel-perfect comparison between development and production sites using an overlay iframe.

## Installation

1. **Download the files** - [Download the files](https://github.com/dave-fink/pixel-perfect-chrome-extension/archive/refs/heads/main.zip) or clone this repository to your computer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now appear in your extensions list

## Features

- **Full-screen overlay** - Overlays a wep page on top of the current URL
- **Draggable** - Move the control bar anywhere on screen
- **On/Off toggle** - Turn overlay off/on
- **URL input** - Input field to change the overlay source
- **Opacity slider** - Slider to adjust overlay transparency (0-100%)
- **Color inversion** - Toggle normal/inverted colors
- **Scroll modes** - Three scroll synchronization options:
  - "Scroll Both" - Both page and iframe scroll together
  - "Scroll Original" - Only original page scrolls
  - "Scroll Overlay" - Only iframe scrolls
- **Arrow key scrolling** - Use keyboard up and down arrows for fine tune scrolling 1px at a time
