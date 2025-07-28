# Pixel Perfect Overlay Chrome Extension

A Chrome extension for pixel-perfect comparison between development and production sites using an overlay iframe.

## Features

- **Full-screen overlay** - 100% width/height iframe overlay
- **Opacity control** - Slider to adjust overlay transparency (0-100%)
- **URL management** - Input field to change iframe source with Go button
- **Draggable controls** - Move the control bar anywhere on screen
- **Scroll modes** - Three scroll synchronization options:
  - "Scroll Both" - Both page and iframe scroll together
  - "Scroll Original" - Only original page scrolls
  - "Scroll Overlay" - Only iframe scrolls
- **Color inversion** - Toggle normal/inverted colors
- **Hide/Show toggle** - Turn overlay off/on with percentage button
- **Arrow key scrolling** - Fine 1px scrolling control
- **Settings persistence** - Remembers URL, opacity, invert state, and position
- **Auto-restore** - Automatically restores overlay after page reload
- **Icon state** - Toolbar icon changes color based on active state

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this directory
4. The extension should now appear in your extensions list

## Usage

1. **Activate overlay** - Click the extension icon in Chrome toolbar
2. **Adjust opacity** - Use the slider to control overlay transparency
3. **Change URL** - Enter a new URL and click the arrow button
4. **Move controls** - Drag the control bar to reposition it
5. **Toggle scroll modes** - Use dropdown to change scroll behavior
6. **Invert colors** - Click "Invert" button to toggle color inversion
7. **Hide overlay** - Click percentage button to turn overlay off
8. **Close extension** - Click the × button to completely close
