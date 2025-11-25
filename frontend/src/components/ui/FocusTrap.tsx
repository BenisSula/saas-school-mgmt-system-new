/**
 * Focus Trap Component
 * Traps focus within a container (e.g., modal, dropdown)
 */

import React, { useEffect, useRef, type ReactNode } from 'react';

export interface FocusTrapProps {
  children: ReactNode;
  /**
   * Whether the focus trap is active
   */
  active?: boolean;
  /**
   * Callback when focus escapes (e.g., Shift+Tab from first element)
   */
  onEscape?: () => void;
  /**
   * Element to focus when trap activates
   */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /**
   * Element to return focus to when trap deactivates
   */
  returnFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * FocusTrap component that traps keyboard focus within its children
 */
export function FocusTrap({
  children,
  active = true,
  onEscape,
  initialFocusRef,
  returnFocusRef,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) {
      return;
    }

    // Store the element that had focus before trap activated
    lastActiveElementRef.current = (document.activeElement as HTMLElement) || null;

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const selector =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
      const elements = containerRef.current?.querySelectorAll<HTMLElement>(selector) || [];
      return Array.from(elements).filter((el) => {
        // Filter out disabled and hidden elements
        return !el.hasAttribute('disabled') && !el.hasAttribute('aria-hidden');
      });
    };

    // Focus initial element or first focusable element
    const focusableElements = getFocusableElements();
    const elementToFocus = initialFocusRef?.current || focusableElements[0];
    elementToFocus?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentElement = document.activeElement as HTMLElement;

      // Check if current element is within the trap
      const isWithinTrap = containerRef.current?.contains(currentElement);

      if (!isWithinTrap) {
        // Focus escaped, focus first element
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey) {
        // Shift+Tab: moving backwards
        if (currentElement === firstElement) {
          event.preventDefault();
          if (onEscape) {
            onEscape();
          } else {
            // Default: wrap to last element
            lastElement.focus();
          }
        }
      } else {
        // Tab: moving forwards
        if (currentElement === lastElement) {
          event.preventDefault();
          if (onEscape) {
            onEscape();
          } else {
            // Default: wrap to first element
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the element that had it before, or specified returnFocusRef
      const elementToReturnFocus = returnFocusRef?.current || lastActiveElementRef.current;
      elementToReturnFocus?.focus();
    };
  }, [active, onEscape, initialFocusRef, returnFocusRef]);

  return (
    <div ref={containerRef} data-focus-trap-active={active}>
      {children}
    </div>
  );
}

export default FocusTrap;
