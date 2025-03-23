import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        timeout: 60000, // Increase timeout to 60 seconds
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log(`Proxy error: ${err.message}`);
            if (!res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'application/json',
              });
              res.end(JSON.stringify({ error: 'Proxy error occurred' }));
            }
          });
        },
      },
    },
  },
});