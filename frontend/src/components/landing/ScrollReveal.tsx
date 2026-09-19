'use client';

import { useEffect } from 'react';

/**
 * One restrained scroll effect, not a library of them: each top-level
 * section marked `data-reveal` fades and rises in exactly once, the first
 * time it crosses into view, then leaves itself alone — no re-triggering
 * on scroll-back, no per-card stagger inside a section. Separately, drives
 * a single `--landing-scroll` CSS variable (rAF-throttled) that the hero's
 * two glass shapes read for a few pixels of parallax drift.
 *
 * Unobserves each element after its first reveal, so this costs nothing
 * once the page has been scrolled through.
 */
export function ScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll('[data-reveal]');
    let observer: IntersectionObserver | undefined;

    if (!('IntersectionObserver' in window) || targets.length === 0) {
      targets.forEach((el) => el.classList.add('is-visible'));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
      );
      targets.forEach((el) => observer?.observe(el));
    }

    let ticking = false;
    const root = document.documentElement;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        root.style.setProperty('--landing-scroll', String(window.scrollY));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
