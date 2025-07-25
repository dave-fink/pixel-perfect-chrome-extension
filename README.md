# Pixel Perfect Overlay Chrome Extension

A simple Chrome extension that creates a full-screen overlay with an iframe when the extension icon is clicked.

## Features

- Click the extension icon to toggle a full-screen overlay
- The overlay contains an iframe pointing to google.com
- The overlay takes up 100% width and height of the viewport
- Click the extension icon again to close the overlay

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this directory
4. The extension should now appear in your extensions list

## Usage

1. Navigate to any webpage
2. Click the extension icon in the Chrome toolbar
3. A full-screen overlay with google.com will appear
4. Click the extension icon again to close the overlay

## Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker that handles extension icon clicks
- `content.js` - Content script that creates and manages the overlay
- `overlay.css` - Styles for the overlay