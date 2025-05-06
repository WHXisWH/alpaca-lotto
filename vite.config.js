import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log('Vite config mode:', mode);
  console.log('Environment variables:', Object.keys(env));
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // Replace process.env with import.meta.env
      'process.env': {
        ...Object.keys(env).reduce((acc, key) => {
          if (key.startsWith('REACT_APP_')) {
            const newKey = key.replace('REACT_APP_', 'VITE_');
            acc[key] = env[newKey];
          }
          return acc;
        }, {}),
      },
    },
    optimizeDeps: {
      include: ['wagmi', 'wagmi/actions', 'viem'],
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      cors: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            wagmi: ['wagmi', 'viem'],
          },
        },
      },
    },
  };
});
