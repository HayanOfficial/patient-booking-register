import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: 'index.html',
        booking: 'booking.html',
        reports: 'reports.html',
        settings: 'settings.html',
        users: 'users.html',
        display: 'display.html',
        'print-token': 'print-token.html',
      },
    },
  },
  envPrefix: 'VITE_',
});
