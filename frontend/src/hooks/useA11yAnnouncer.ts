/**
 * Accessibility Announcer Hook
 * Provides screen reader announcements for dynamic content
 */

import { useEffect, useRef } from 'react';

interface A11yAnnouncerOptions {
  /**
   * Priority level for the announcement
   * - 'polite': Waits for current announcement to finish
   * - 'assertive': Interrupts current announcement
   */
  priority?: 'polite' | 'assertive';
  /**
   * Timeout in milliseconds before clearing the announcement
   * Default: 1000ms
   */
  timeout?: number;
}

/**
 * Hook to announce messages to screen readers
 * @returns Function to announce messages
 */
export function useA11yAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create or get the announcer element
    let announcer = document.getElementById('a11y-announcer') as HTMLDivElement;
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      announcer.style.cssText =
        'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
      document.body.appendChild(announcer);
    }
    announcerRef.current = announcer;
  }, []);

  const announce = (message: string, options: A11yAnnouncerOptions = {}) => {
    if (!announcerRef.current) return;

    const { priority = 'polite', timeout = 1000 } = options;
    announcerRef.current.setAttribute('aria-live', priority);
    announcerRef.current.textContent = message;

    // Clear after timeout to allow re-announcement of same message
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = '';
      }
    }, timeout);
  };

  return { announce };
}

/**
 * Standalone function to announce messages (for use outside components)
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) {
  let announcer = document.getElementById('a11y-announcer') as HTMLDivElement;
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText =
      'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
    document.body.appendChild(announcer);
  }

  announcer.setAttribute('aria-live', priority);
  announcer.textContent = message;

  setTimeout(() => {
    announcer.textContent = '';
  }, 1000);
}
