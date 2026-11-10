import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colours extracted from the Peoplesshop logo
        brand: {
          purple: "#7C3AC7",
          "purple-dark": "#5C2A97",
          "purple-light": "#EDE5F7",
          orange: "#F5821E",
          "orange-dark": "#D06510",
          "orange-light": "#FEF0E2",
        },
        // Semantic system colours
        background: "#F8F7FA",
        surface: "#FFFFFF",
        border: "#E2E0E8",
        "text-primary": "#1A1523",
        "text-muted": "#6B7280",
        // Sidebar
        sidebar: {
          bg: "#1A1523",
          hover: "#2A2035",
          active: "#3A2F4D",
          text: "#C5B8D8",
          "text-active": "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
