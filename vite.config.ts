import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (!env.VITE_SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL is not defined in your .env file');
  }

  return {
  base: mode === 'production' ? '/' : '/',
  server: {
    host: "::",
    port: 8080,
      proxy: {
        '/api': {
          target: `${env.VITE_SUPABASE_URL}/functions/v1`,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      }
  },
  plugins: [
    react(),
      mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
