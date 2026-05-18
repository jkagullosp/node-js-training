import 'dotenv/config';
import { createApp } from './app';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

const app = createApp();

const server = app.listen(PORT, () => {
  console.info(`[server] FlowBoard API listening on port ${PORT}`);
});

// Graceful shutdown — finish in-flight requests before exiting
function shutdown(signal: string): void {
  console.info(`[server] ${signal} received — shutting down gracefully`);
  server.close(() => {
    console.info('[server] HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
