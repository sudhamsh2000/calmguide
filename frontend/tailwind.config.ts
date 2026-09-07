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
        // Slow, soft drift for decorative landing-page background blobs —
        // a gentle wandering path (translate + scale) rather than a fixed
        // pulse, so it reads as an ambient wave rather than a heartbeat.
        // Disabled entirely under prefers-reduced-motion (see globals.css).
        'blob-drift': {
          '0%, 100%': { transform: 'translate(-50%, 0%) scale(1)' },
          '25%': { transform: 'translate(-38%, 6%) scale(1.12)' },
          '50%': { transform: 'translate(-50%, -8%) scale(0.94)' },
          '75%': { transform: 'translate(-62%, 4%) scale(1.08)' },
        },
      },
      animation: {
        breathing: 'breathing 4s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'slide-up': 'slide-up 0.4s ease-out forwards',
        'page-enter': 'page-enter 0.4s ease-out forwards',
        'skeleton-shimmer': 'skeleton-shimmer 1.5s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
        'blob-drift': 'blob-drift 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
