import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          soft: 'var(--color-primary-soft)',
        },
        background: {
          DEFAULT: 'var(--color-background)',
        },
        foreground: {
          DEFAULT: 'var(--color-foreground)',
          muted: 'var(--color-foreground-muted)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
        },
        navy: 'var(--color-navy)',
        ink: 'var(--color-ink)',
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
          text: 'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
          text: 'var(--color-warning-text)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          bg: 'var(--color-error-bg)',
        },
        emergency: {
          DEFAULT: 'var(--color-emergency)',
          bg: 'var(--color-emergency-bg)',
        },
        accent: {
          mint: 'var(--color-accent-mint)',
          aqua: 'var(--color-accent-aqua)',
          lavender: 'var(--color-accent-lavender)',
          peach: 'var(--color-accent-peach)',
          blue: 'var(--color-accent-blue)',
        },
        footer: {
          DEFAULT: 'var(--color-footer-bg)',
          text: 'var(--color-footer-text)',
          muted: 'var(--color-footer-text-muted)',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Nunito', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Nunito Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        coach: ['1.125rem', { lineHeight: '1.6' }],
      },
      minHeight: {
        tap: '48px',
      },
      minWidth: {
        tap: '48px',
      },
      borderColor: {
        theme: 'var(--color-border)',
        'theme-soft': 'var(--color-border-soft)',
        'theme-strong': 'var(--color-border-strong)',
      },
      maxWidth: {
        landing: '1200px',
        // Desktop width for the caregiver app shell. Wide enough for the
        // two-column screens to breathe, deliberately short of the landing
        // page's 1200px so reading columns never get uncomfortably long.
        app: '1040px',
      },
      keyframes: {
        breathing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%': { transform: 'scale(1.3)', opacity: '0.7' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'page-enter': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        // Four independent wandering paths for the hero's decorative
        // bubbles — each bubble keeps a fixed color and just moves; the
        // "contact" effect comes from mix-blend-mode (see
        // .hero-bubble in globals.css) automatically brightening wherever
        // two bubbles' circles overlap, not from tracking real collisions.
        // Different corner-to-corner diagonals per bubble, offset via
        // animation-delay in the markup, so they never move in lockstep.
        // Disabled entirely under prefers-reduced-motion (see globals.css).
        'bubble-a': {
          '0%, 100%': { transform: 'translate(-10%, -15%) scale(1)' },
          '33%': { transform: 'translate(55%, 10%) scale(1.15)' },
          '66%': { transform: 'translate(15%, 60%) scale(0.88)' },
        },
        'bubble-b': {
          '0%, 100%': { transform: 'translate(70%, 55%) scale(1)' },
          '33%': { transform: 'translate(10%, 70%) scale(0.85)' },
          '66%': { transform: 'translate(45%, 5%) scale(1.2)' },
        },
        'bubble-c': {
          '0%, 100%': { transform: 'translate(20%, 70%) scale(1)' },
          '33%': { transform: 'translate(65%, 25%) scale(1.1)' },
          '66%': { transform: 'translate(5%, 5%) scale(0.9)' },
        },
        'bubble-d': {
          '0%, 100%': { transform: 'translate(60%, 5%) scale(1)' },
          '33%': { transform: 'translate(5%, 40%) scale(0.92)' },
          '66%': { transform: 'translate(50%, 65%) scale(1.16)' },
        },
      },
      animation: {
        breathing: 'breathing 4s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'slide-up': 'slide-up 0.4s ease-out forwards',
        'page-enter': 'page-enter 0.4s ease-out forwards',
        'skeleton-shimmer': 'skeleton-shimmer 1.5s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
        'bubble-a': 'bubble-a 13s ease-in-out infinite',
        'bubble-b': 'bubble-b 16s ease-in-out infinite',
        'bubble-c': 'bubble-c 11s ease-in-out infinite',
        'bubble-d': 'bubble-d 14s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
