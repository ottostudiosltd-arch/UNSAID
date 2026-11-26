/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Fredoka'", "'Plus Jakarta Sans'", "sans-serif"],
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        cream: "#FFF7F4",
        ink: "#1E1B2E",
        muted: "#6B6580",
        pastel: {
          pink: "#FFE3F1",
          pinkDeep: "#FF6CA8",
          mint: "#DCF9EA",
          mintDeep: "#25B87B",
          lavender: "#EDE3FF",
          lavenderDeep: "#8E63F3",
          amber: "#FFF0C7",
          amberDeep: "#F59E0B",
          peach: "#FFEBE3",
        },
      },
      boxShadow: {
        card: "0 10px 28px -12px rgba(55, 36, 99, 0.12), 0 2px 8px -2px rgba(55, 36, 99, 0.05)",
        shell: "0 20px 60px -18px rgba(84, 52, 138, 0.18)",
        pill: "0 4px 12px -2px rgba(30, 27, 46, 0.14)",
      },
    },
  },
  plugins: [],
};
