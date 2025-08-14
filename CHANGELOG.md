# Release Notes

## Version 1.1

### Bug Fixes
- **Custom DOM Elements**: Implemented custom DOM elements to prevent scope issues with target pages
- **Improved Element Isolation**: Extension elements now use custom tags to avoid conflicts with page CSS/JS
- **Fix null element error in createOverlay**: Resolved TypeError when slider elements weren't found
- **Wrap event listeners in null checks**: Prevent TypeError when elements are undefined

---

## Version 1.0
### Initial Release Features
- **Pixel Perfect Overlay**: Core functionality to overlay development URLs over any webpage
- **Opacity Control**: Slider to adjust overlay transparency (0-100%)
- **Color Inversion**: Toggle to invert overlay colors for better visibility
- **Multiple Scroll Modes**: 
  - Scroll Both: Synchronize overlay and main page scrolling
  - Scroll Page: Only scroll the main page
  - Scroll Overlay: Only scroll the overlay
- **URL Management**: Input field for overlay URL with validation
- **Toggle Controls**: Easy on/off switching for the overlay
- **Docking Options**: Position controls at top or bottom of screen
- **Browser Integration**: 
  - Toolbar icon with active/inactive states
  - Favicon overlay when extension is active
  - Page title indicator
- **Keyboard Support**: Arrow keys for fine-tuned scrolling
- **Cache Busting**: Automatic cache busting for development workflows
- **Instructions**: First-time user onboarding experience
- **Settings Persistence**: Remember user preferences across sessions

### Technical Features
- **Chrome Extension Manifest V3**: Built with latest Chrome extension standards
- **Content Script Architecture**: Efficient page injection system
- **Background Script**: Handles URL validation and extension state
- **Responsive Design**: Works across different screen sizes
- **Error Recovery**: Graceful handling of network and loading errors
