import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-contrast": "var(--accent-contrast)",
        danger: "var(--danger)",
        success: "var(--success)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Playfair Display", "serif"],
        sans: ["var(--font-sans)", "Manrope", "system-ui", "sans-serif"],
      },
      boxShadow: {
        premium: "0 10px 30px -10px rgba(0, 0, 0, 0.7)",
        card: "0 4px 20px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
