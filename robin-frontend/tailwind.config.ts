import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Core surfaces
                base: "#080c14",
                surface: "#0d1525",
                raised: "#141f33",
                overlay: "#1a2840",

                // Borders
                border: {
                    DEFAULT: "#1a2840",
                    active: "#2a4268",
                    focus: "#3b5a8a",
                },

                // Text hierarchy
                text: {
                    primary: "#e2e8f2",
                    secondary: "#8a9ab5",
                    muted: "#4a5a73",
                    disabled: "#2d3f56",
                },

                // Accent blue
                accent: {
                    DEFAULT: "#2563eb",
                    subtle: "#1e3a6e",
                    bright: "#3b82f6",
                    glow: "rgba(37,99,235,0.15)",
                },

                // Status colors
                emerald: { DEFAULT: "#059669", subtle: "#064e3b" },
                rose: { DEFAULT: "#dc2626", subtle: "#7f1d1d" },
                amber: { DEFAULT: "#d97706", subtle: "#78350f" },
                violet: { DEFAULT: "#7c3aed", subtle: "#3b1c6e" },
                sky: { DEFAULT: "#0ea5e9", subtle: "#0c4a6e" },
            },

            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },

            fontSize: {
                "2xs": ["0.65rem", { lineHeight: "1rem" }],
                xs: ["0.75rem", { lineHeight: "1rem" }],
                sm: ["0.875rem", { lineHeight: "1.25rem" }],
                base: ["0.9375rem", { lineHeight: "1.5rem" }],
                lg: ["1.0625rem", { lineHeight: "1.75rem" }],
                xl: ["1.25rem", { lineHeight: "1.75rem" }],
                "2xl": ["1.5rem", { lineHeight: "2rem" }],
                "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
                "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
                "5xl": ["3rem", { lineHeight: "1" }],
            },

            spacing: {
                // 8px grid
                "0.5": "4px",
                "1": "8px",
                "1.5": "12px",
                "2": "16px",
                "2.5": "20px",
                "3": "24px",
                "4": "32px",
                "5": "40px",
                "6": "48px",
                "8": "64px",
                "10": "80px",
                "12": "96px",
            },

            borderRadius: {
                sm: "4px",
                md: "6px",
                lg: "8px",
                xl: "12px",
                "2xl": "16px",
            },

            boxShadow: {
                "card": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)",
                "elevated": "0 4px 16px rgba(0,0,0,0.5)",
                "glow": "0 0 20px rgba(37,99,235,0.2)",
                "inset": "inset 0 1px 0 rgba(255,255,255,0.04)",
            },

            animation: {
                "fade-in": "fadeIn 0.15s ease-out",
                "slide-up": "slideUp 0.2s ease-out",
                "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
                "spin-slow": "spin 2s linear infinite",
            },

            keyframes: {
                fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
                slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
            },

            transitionTimingFunction: {
                "out-expo": "cubic-bezier(0.16,1,0.3,1)",
            },
        },
    },
    plugins: [],
};

export default config;
