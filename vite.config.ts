import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import analyzeHandler from './api/analyze';
import refineHandler from './api/refine';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Inject env variables for local dev API execution
  Object.assign(process.env, env);

  const createHandlerMiddleware = (handlerFn: any) => {
    return async (req: any, res: any) => {
      if (req.method === 'POST') {
        let bodyStr = '';
        req.on('data', (chunk: any) => {
          bodyStr += chunk;
        });
        req.on('end', async () => {
          try {
            const parsedBody = bodyStr ? JSON.parse(bodyStr) : {};
            req.body = parsedBody;

            const mockRes: any = {
              statusCode: 200,
              status(code: number) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              setHeader(key: string, val: string) {
                res.setHeader(key, val);
                return this;
              },
              json(data: any) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return this;
              },
              end(data?: any) {
                res.statusCode = this.statusCode || 200;
                res.end(data);
                return this;
              }
            };

            await handlerFn(req, mockRes);
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e?.message || 'Server error' }));
          }
        });
      } else if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.statusCode = 200;
        res.end();
      } else {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
    };
  };

  return {
    plugins: [
      react(),
      {
        name: 'api-dev-server-middleware',
        configureServer(server) {
          server.middlewares.use('/api/analyze', createHandlerMiddleware(analyzeHandler));
          server.middlewares.use('/api/refine', createHandlerMiddleware(refineHandler));
        }
      }
    ],
    server: {
      port: 3000,
    }
  };
});
