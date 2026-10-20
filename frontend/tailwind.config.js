/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: "#07040F",
          900: "#0B0716",
          850: "#110B20",
          800: "#171029",
          700: "#211838",
        },
        pulse: {
          magenta: "#FF3DCE",
          violet: "#8B5CF6",
          emerald: "#34F5B0",
          amber: "#FFB547",
          ice: "#7DD3FC",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        ring: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px -30px rgba(139,92,246,0.55)",
        glow: "0 0 40px -10px rgba(255,61,206,0.45)",
      },
      keyframes: {
        orbit: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        orbit: "orbit 18s linear infinite",
        orbitSlow: "orbit 32s linear infinite reverse",
        pulseSlow: "pulseSlow 4s ease-in-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
