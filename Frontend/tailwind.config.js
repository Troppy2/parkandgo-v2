/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: "#7A0019",
          hover:   "#91253b",
          light:   "rgba(122,0,25,0.08)",
          light2:  "rgba(122,0,25,0.14)",
        },
        gold: {
          DEFAULT: "#FFCC33",
          dark:    "#c9a200",
          light:   "rgba(255,204,51,0.18)",
        },
        text1: {
          DEFAULT: "#1a1a1a",
        },
        text2: {
          DEFAULT: "#6b7280",
        },
        text3: {
          DEFAULT: "#9ca3af",
        },
        bg: {
          DEFAULT: "#ffffff",
        },
        bg2: {
          DEFAULT: "#f5f5f5",
        },
        border: {
          DEFAULT: "#e5e7eb",
        },
        border2: {
          DEFAULT: "#d1d5db",
        },
        green: {
          DEFAULT: "#10b981",
        },
        amber: {
          DEFAULT: "#f59e0b",
        },
        red: {
          DEFAULT: "#ff3b30",
        },
        blue: {
          DEFAULT: "#3b82f6",
        }
      },
      borderRadius: {
        // map --r (16px), --rs (10px), --rp (100px) from prototype
        DEFAULT: "16px",
        sm: "10px",
        lg: "100px",
      },
      boxShadow: {
        sm: "0px 1px 3px rgba(0, 0, 0, 0.1)",
        md: "0px 4px 6px rgba(0, 0, 0, 0.1)",
        lg: "0px 10px 15px rgba(0, 0, 0, 0.1)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
}