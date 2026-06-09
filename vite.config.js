import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createProjectApi } from './project-api.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'microfactory-project-api',
      configureServer(server) {
        const handleProjectsRequest = createProjectApi({ root: process.cwd() });
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url ?? '/', 'http://localhost');
          if (await handleProjectsRequest(request, response, url)) return;
          next();
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
});
