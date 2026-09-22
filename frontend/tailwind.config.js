/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-tema="dark"]'],
  theme: {
    extend: {
      colors: {
        // Paleta definida como variáveis CSS (ver src/index.css), o que permite
        // alternar tema claro/escuro sem duplicar classes.
        fundo: 'rgb(var(--cor-fundo) / <alpha-value>)',
        superficie: 'rgb(var(--cor-superficie) / <alpha-value>)',
        'superficie-2': 'rgb(var(--cor-superficie-2) / <alpha-value>)',
        borda: 'rgb(var(--cor-borda) / <alpha-value>)',
        texto: 'rgb(var(--cor-texto) / <alpha-value>)',
        'texto-suave': 'rgb(var(--cor-texto-suave) / <alpha-value>)',
        primaria: 'rgb(var(--cor-primaria) / <alpha-value>)',
        'primaria-escura': 'rgb(var(--cor-primaria-escura) / <alpha-value>)',
        'sobre-primaria': 'rgb(var(--cor-primaria-contraste) / <alpha-value>)',
        perigo: 'rgb(var(--cor-perigo) / <alpha-value>)',
        alerta: 'rgb(var(--cor-alerta) / <alpha-value>)',
        info: 'rgb(var(--cor-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem' },
      // A tela útil é a altura toda menos a barra de status (ver #root no index.css)
      minHeight: { screen: 'calc(100vh - var(--seguro-topo))' },
      keyframes: {
        'sobe-suave': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulsa: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'sobe-suave': 'sobe-suave 0.22s ease-out',
        pulsa: 'pulsa 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
