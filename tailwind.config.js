/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#20201d",
        paper: "#fbfaf6",
        leaf: "#3f7d58",
        tomato: "#c6533c",
        honey: "#d99b2b",
        sea: "#2f7f87",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(32, 32, 29, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
