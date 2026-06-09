import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createProjectApi } from './project-api.mjs';
import { handleRenderRequest } from './server.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'microfactory-api',
      configureServer(server) {
        const handleProjectsRequest = createProjectApi({ root: process.cwd() });
        server.middlewares.use('/api/render', async (request, response, next) => {
          if (request.method !== 'POST') {
            next();
            return;
          }
          await handleRenderRequest(request, response);
        });
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
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
