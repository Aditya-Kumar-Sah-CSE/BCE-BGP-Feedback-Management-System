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
        bce: {
          navy: "#0B192C",
          cobalt: "#1E3E62",
          slate: "#3B5C7D",
          amber: "#F59E0B",
          gold: "#D97706",
          light: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
        },
      },
    },
  },
  plugins: [],
};

export default config;
