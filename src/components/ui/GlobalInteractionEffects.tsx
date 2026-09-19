'use client';

import { useEffect } from 'react';

/**
 * GlobalInteractionEffects
 * Injects subtle micro-interactions for tactile feedback across the application:
 * 1. Spawns an animated radiant shockwave aura ring on button click.
 * 2. Applies micro-press tactile pop.
 * Does NOT monkey-patch window.fetch or router methods.
 */
export function GlobalInteractionEffects() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Intercept button clicks for shockwave aura & micro-press
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const button = target.closest(
        'button, [role="button"], a.btn, a.button, input[type="submit"], input[type="button"]'
      ) as HTMLElement | null;

      if (!button) return;
      if (
        (button as HTMLButtonElement).disabled ||
        button.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }

      // Check if button is inside a fixed/sticky container
      const rect = button.getBoundingClientRect();
      let isFixed = false;
      let el: HTMLElement | null = button;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed') {
          isFixed = true;
          break;
        }
        el = el.parentElement;
      }

      // Create expanding shockwave aura ring around button perimeter
      const ring = document.createElement('span');
      ring.className = 'btn-aura-shockwave';
      ring.style.position = isFixed ? 'fixed' : 'absolute';
      ring.style.width = `${rect.width + 12}px`;
      ring.style.height = `${rect.height + 12}px`;
      ring.style.left = isFixed ? `${rect.left - 6}px` : `${rect.left + window.scrollX - 6}px`;
      ring.style.top = isFixed ? `${rect.top - 6}px` : `${rect.top + window.scrollY - 6}px`;
      ring.style.borderRadius = window.getComputedStyle(button).borderRadius || '12px';

      document.body.appendChild(ring);

      setTimeout(() => {
        ring.remove();
      }, 600);

      // Micro-press tactile pop
      button.classList.add('btn-press-pop');
      setTimeout(() => {
        button.classList.remove('btn-press-pop');
      }, 180);
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  return null;
}
