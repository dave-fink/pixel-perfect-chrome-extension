# Pixel Perfect Overlay Chrome Extension

<img width="623" height="90" alt="image" src="https://github.com/user-attachments/assets/87445ecc-5b6b-45ed-bc28-4db61462a248" />


A Chrome extension that overlays a locoal development URL directly on top of any webpage for pixel-perfect comparison and design verification. Work in real time without the hassle of switching tabs.


**Adjust opacity and invert Colors to easily see alignment issues:**

<img title="BEFORE" width="182" height="182" alt="image" src="https://github.com/user-attachments/assets/03fd8c7c-9c64-440f-a3d7-7c352bed2e2a" />

<img title="AFTER" width="182" height="183" alt="image" src="https://github.com/user-attachments/assets/469d1d10-4a47-451d-9543-4af2352925b5" />

<br>
<br>




## Installation

1. **Download the files** - [Download the files](https://github.com/dave-fink/pixel-perfect-chrome-extension/archive/refs/heads/main.zip) or clone this repository to your computer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now appear in your extensions list
6. Pin it to your toolbar and click the '(px)' icon to activate it on any web page


<br>
<br>

## ⚠️ Important - Known Issues

> **Viewport Height (`vh`) Measurement Limitations**  
> CSS `vh` units are based on the *viewport height*. On a standard web page, this is the height of the browser window. However, in an embedded iframe, `vh` is calculated relative to the iframe’s internal viewport — effectively the height of the iframe’s document, not the outer window.
>
> This discrepancy that leads to visual mismatches when comparing a page to its overlay within an iframe. 
>
> **💡 To detect `vh` usage on a page:**
> 1. Load the same page URL into the **Overlay URL** input (not localhost) making the overlay URL identical to the page you are viewing.
> 2. Set overlay opacity to 50% and enable **invert mode** — misalignments caused by `vh` differences will appear clearly; if the overlay remains uniformly gray, `vh` is likely not in use.
> 3. Resize the page width to trigger responsive breakpoints.
>
> *`vh` units are commonly used for full-height layouts such as modals, hero sections, or mobile views - (but not limited to them).*  
>
> This is a browser limitation with no clean fix, a creative workaround is being investigated. [#6](https://github.com/dave-fink/pixel-perfect-chrome-extension/issues/6)
<br>
<br>
**If you encounter any problem - please [create a GitHub issue](https://github.com/dave-fink/pixel-perfect-chrome-extension/issues).**


<br>
<br>

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


*Note: This extension is under active development and may not be fully stable. While every effort has been made to ensure reliability, unexpected behavior may occur. If you find a bug, please open a GitHub issue with as much detail as possible. [create a GitHub issue](https://github.com/dave-fink/pixel-perfect-chrome-extension/issues).  Thank you*
