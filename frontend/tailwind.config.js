/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 10px 30px rgba(0,0,0,0.25)"
      }
    },
  },
  plugins: [],
}
