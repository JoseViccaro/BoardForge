import fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { registerSecurityHeaders } from "./plugins/security-headers.plugin.js";
import { registerCors } from "./plugins/cors.plugin.js";
import { registerRateLimit } from "./plugins/rate-limit.plugin.js";
import { registerErrorHandler } from "./plugins/error-handler.plugin.js";
import { registerAuth } from "./plugins/auth.plugin.js";
import { TokenManager } from "../../modules/identity-access/domain/services/TokenManager.js";
import { IdentityAccessFacade } from "../../modules/identity-access/application/IdentityAccessFacade.js";
import { InMemoryUserRepository } from "../../modules/identity-access/infrastructure/InMemoryUserRepository.js";
import { InMemoryOrganizationRepository } from "../../modules/identity-access/infrastructure/InMemoryOrganizationRepository.js";
import { InMemorySessionRepository } from "../../modules/identity-access/infrastructure/InMemorySessionRepository.js";
import { CatalogFacade } from "../../application/catalog/CatalogFacade.js";
import { BoardViewFacade } from "../../application/boardview/BoardViewFacade.js";
import { SchematicsFacade } from "../../application/schematics/SchematicsFacade.js";
import { MeasurementsFacade } from "../../application/measurements/MeasurementsFacade.js";
import { PmuSimulationFacade } from "../../application/schematics/PmuSimulationFacade.js";
import { InMemoryCompositeBoardRepository } from "../../infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { InMemoryNetTopologyRepository } from "../../infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.js";
import { InMemoryMeasurementRepository } from "../../infrastructure/persistence/in-memory/InMemoryMeasurementRepository.js";
import { BoardViewParserFactory } from "../../infrastructure/boardview/parsers/BoardViewParserFactory.js";
import { BoardViewToCanonicalTransformer } from "../../domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { registerV1Routes } from "./routes/v1/index.js";

export interface FastifyAppOptions {
  tokenManager?: TokenManager;
  identityAccessFacade?: IdentityAccessFacade;
  catalogFacade?: CatalogFacade;
  boardViewFacade?: BoardViewFacade;
  schematicsFacade?: SchematicsFacade;
  measurementsFacade?: MeasurementsFacade;
  pmuFacade?: PmuSimulationFacade;
  corsOrigins?: string[];
  enableRateLimiting?: boolean;
  authMaxRequests?: number;
  authTimeWindowSeconds?: number;
  standardMaxRequests?: number;
  jwtSecret?: string;
  routesRegister?: (app: FastifyInstance) => Promise<void>;
}

export async function createFastifyApp(options: FastifyAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
  });

  const jwtSecret = options.jwtSecret ?? "boardforge-default-dev-jwt-secret-key-32chars!";
  const tokenManager =
    options.tokenManager ??
    new TokenManager({
      jwtSecret,
    });

  const userRepo = new InMemoryUserRepository();
  const orgRepo = new InMemoryOrganizationRepository();
  const sessionRepo = new InMemorySessionRepository();
  const identityAccessFacade =
    options.identityAccessFacade ??
    new IdentityAccessFacade(userRepo, orgRepo, sessionRepo, tokenManager);

  const boardRepo = new InMemoryCompositeBoardRepository();
  const topologyRepo = new InMemoryNetTopologyRepository();
  const measurementRepo = new InMemoryMeasurementRepository();
  const parserFactory = new BoardViewParserFactory();
  const transformer = new BoardViewToCanonicalTransformer();

  const catalogFacade = options.catalogFacade ?? new CatalogFacade(boardRepo);
  const boardViewFacade =
    options.boardViewFacade ??
    new BoardViewFacade(boardRepo, topologyRepo, parserFactory, transformer);
  const schematicsFacade = options.schematicsFacade ?? new SchematicsFacade();
  const measurementsFacade =
    options.measurementsFacade ?? new MeasurementsFacade(measurementRepo);
  const pmuFacade = options.pmuFacade ?? new PmuSimulationFacade();

  // 1. Error Handler
  registerErrorHandler(app);

  // 2. Cookie plugin
  await app.register(cookie);

  // 3. Multipart plugin (max 100MB)
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
      files: 5,
    },
  });

  // 4. Security Headers (Helmet)
  await registerSecurityHeaders(app);

  // 5. CORS
  await registerCors(app, {
    origins: options.corsOrigins,
  });

  // 6. Rate Limiting
  if (options.enableRateLimiting) {
    await registerRateLimit(app, {
      authMaxRequests: options.authMaxRequests,
      authTimeWindowSeconds: options.authTimeWindowSeconds,
      standardMaxRequests: options.standardMaxRequests,
    });
  }

  // 7. Auth Plugin
  registerAuth(app, { tokenManager });

  // Basic Health Check Route
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Register V1 API routes or custom routes
  if (options.routesRegister) {
    await options.routesRegister(app);
  } else {
    await registerV1Routes(app, {
      identityAccessFacade,
      catalogFacade,
      boardViewFacade,
      schematicsFacade,
      measurementsFacade,
      pmuFacade,
    });
  }

  return app;
}
