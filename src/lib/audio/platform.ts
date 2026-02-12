/**
 * Platform detection utilities for audio pipeline.
 * Chrome on iOS uses WebKit under the hood — same audio restrictions as Safari.
 */

/**
 * Detect if running on iOS (Safari, Chrome, or any browser — all use WebKit).
 * Also catches iPads that report as Mac in user-agent string (iPadOS 13+).
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
