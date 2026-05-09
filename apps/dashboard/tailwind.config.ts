import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1B2A4A",
        gold: "#C8A951",
        "gold-hover": "#D4B669",
        spotify: "#1DB954",
        dark: "#0A0B14",
        panel: "#13141F",
        "panel-hover": "#1A1C2A",
        overlay: "#11131C",
        input: "#0A0B14",
        border: "rgba(255, 255, 255, 0.08)",
        "border-medium": "#1F2230",
        "border-strong": "#2A2D3A",
        "on-dark": "#FFFFFF",
        "on-dark-secondary": "rgba(255, 255, 255, 0.55)",
        "on-surface": "#E4E4E7",
        "on-surface-dim": "#A1A1AA",
        success: "#22C55E",
        "success-subtle": "rgba(34, 197, 94, 0.10)",
        warning: "#F59E0B",
        "warning-subtle": "rgba(245, 158, 11, 0.10)",
        error: "#EF4444",
        "error-subtle": "rgba(239, 68, 68, 0.10)",
        info: "#3B82F6",
        "info-subtle": "rgba(59, 130, 246, 0.10)",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;