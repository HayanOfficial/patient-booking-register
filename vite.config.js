import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: 'index.html',
        booking: 'booking.html',
        reception: 'reception.html',
        counseling: 'counseling.html',
        reports: 'reports.html',
        settings: 'settings.html',
        users: 'users.html',
        display: 'display.html',
        'print-token': 'print-token.html',
        'print-slip': 'print-slip.html',
      },
    },
  },
  envPrefix: 'VITE_',
});
