'use client';

import { useEffect } from 'react';

/**
 * GlobalInteractionEffects
 * Injects a global micro-interaction system for all buttons across the application:
 * 1. Spawns an animated radiant shockwave aura ring on every button click.
 * 2. Implements tactile press pop.
 * 3. Automatically tracks asynchronous requests (req) triggered by buttons/forms:
 *    - Pulses with radiant energy (.btn-request-active) while pending.
 *    - Emits a glowing emerald flash on success response (.btn-response-success).
 *    - Emits a glowing rose flash on error response (.btn-response-error).
 */
export function GlobalInteractionEffects() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastClickedButton: HTMLElement | null = null;
    let lastClickTime = 0;

    // Track active requests count on HTML elements
    const buttonReqCounts = new WeakMap<HTMLElement, number>();

    const startButtonRequest = (btn: HTMLElement) => {
      const current = buttonReqCounts.get(btn) || 0;
      buttonReqCounts.set(btn, current + 1);
      btn.classList.add('btn-request-active');
    };

    const finishButtonRequest = (btn: HTMLElement, isSuccess: boolean) => {
      const current = buttonReqCounts.get(btn) || 1;
      const next = current - 1;
      if (next <= 0) {
        buttonReqCounts.delete(btn);
        btn.classList.remove('btn-request-active');

        // Apply response feedback flash
        const flashClass = isSuccess ? 'btn-response-success' : 'btn-response-error';
        btn.classList.remove('btn-response-success', 'btn-response-error');
        // Force browser reflow to re-trigger animation if clicked in sequence
        void btn.offsetWidth;
        btn.classList.add(flashClass);

        setTimeout(() => {
          btn.classList.remove(flashClass);
        }, 900);
      } else {
        buttonReqCounts.set(btn, next);
      }
    };

    // 1. Intercept button clicks for shockwave aura & micro-press
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

      lastClickedButton = button;
      lastClickTime = Date.now();

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

    // 2. Intercept Form Submit events
    const handleGlobalSubmit = (e: SubmitEvent) => {
      const submitter = (e.submitter as HTMLElement | null) ||
        (e.target as HTMLFormElement)?.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null;
      if (submitter) {
        lastClickedButton = submitter;
        lastClickTime = Date.now();
      }
    };

    // 3. Patch window.fetch safely to capture req and res for active button
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const timeSinceClick = Date.now() - lastClickTime;
      const associatedBtn = (timeSinceClick < 400 && lastClickedButton) ? lastClickedButton : null;

      if (associatedBtn) {
        startButtonRequest(associatedBtn);
      }

      try {
        const response = await originalFetch(...args);
        if (associatedBtn) {
          finishButtonRequest(associatedBtn, response.ok);
        }
        return response;
      } catch (err) {
        if (associatedBtn) {
          finishButtonRequest(associatedBtn, false);
        }
        throw err;
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    document.addEventListener('submit', handleGlobalSubmit, { capture: true });

    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
      document.removeEventListener('submit', handleGlobalSubmit, { capture: true });
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

