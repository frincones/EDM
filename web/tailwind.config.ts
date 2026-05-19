import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        edn: {
          50:  "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7ec7fb",
          400: "#3aa9f7",
          500: "#108fea",
          600: "#0370c5",
          700: "#085a9c",
          800: "#0c4d80",
          900: "#0f416b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        slideIn: "slideIn 0.35s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
