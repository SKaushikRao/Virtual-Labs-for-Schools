import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY),
      'process.env.ELEVENLABS_API_KEY': JSON.stringify(env.ELEVENLABS_API_KEY),
      'process.env.ELEVENLABS_VOICE_EN': JSON.stringify(env.ELEVENLABS_VOICE_EN || 'JBFqnCBsd6RMkjVDRZzb'),
      'process.env.ELEVENLABS_VOICE_HI': JSON.stringify(env.ELEVENLABS_VOICE_HI || 'onwK4e9ZLuTAKqWW03F9'),
      'process.env.ELEVENLABS_VOICE_TE': JSON.stringify(env.ELEVENLABS_VOICE_TE || 'onwK4e9ZLuTAKqWW03F9'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
