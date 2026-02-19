import * as grpc from '@grpc/grpc-js';
import { createServer } from './grpc/server';
import { loadConfig } from './config';

const config = loadConfig();
const taskNames = Object.keys(config.tasks);
console.log(`Starting AI adapter: ${taskNames.length} task(s) configured [${taskNames.join(', ')}]`);

const server = createServer(config);

const addr = process.env.NUPI_ADAPTER_LISTEN_ADDR || '127.0.0.1:50051';

server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind:', err);
    process.exit(1);
  }
  console.log(`AI adapter listening on ${addr} (port ${port})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.tryShutdown((err) => {
    if (err) {
      console.error('Shutdown error:', err);
      server.forceShutdown();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.tryShutdown((err) => {
    if (err) {
      console.error('Shutdown error:', err);
      server.forceShutdown();
    }
    process.exit(0);
  });
});
