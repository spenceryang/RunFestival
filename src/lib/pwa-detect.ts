/**
 * Detect if the app is running in standalone PWA mode.
 * On iOS Safari, `navigator.standalone` is true when launched from home screen.
 * On other browsers, the display-mode media query detects standalone/fullscreen.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS Safari standalone mode
  if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone) {
    return true;
  }

  // Chrome / Android / desktop PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  return false;
}
