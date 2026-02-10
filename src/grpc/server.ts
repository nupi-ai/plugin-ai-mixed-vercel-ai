import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import type { Config } from '../config';
import type { ProtoGrpcType } from '../proto/ai';
import type { IntentResolutionServiceHandlers } from '../proto/nupi/nap/v1/IntentResolutionService';
import { createIntentHandler } from './handlers';

const PROTO_PATH = path.join(__dirname, '../../proto/nupi/nap/v1/ai.proto');
const PROTO_INCLUDE = path.join(__dirname, '../../proto');

export function createServer(config: Config): grpc.Server {
  // Load proto definition
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_INCLUDE],
  });

  const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

  // Create server
  const server = new grpc.Server();

  // Register service
  const handlers: IntentResolutionServiceHandlers = {
    ResolveIntent: createIntentHandler(config),
  };

  server.addService(
    proto.nupi.nap.v1.IntentResolutionService.service,
    handlers
  );

  return server;
}
