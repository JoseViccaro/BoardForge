import { FastifyInstance } from "fastify";
import { IdentityAccessFacade } from "../../../../modules/identity-access/application/IdentityAccessFacade.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerCatalogRoutes } from "./catalog.routes.js";
import { registerBoardViewRoutes } from "./boardview.routes.js";
import { registerSchematicsRoutes } from "./schematics.routes.js";
import { registerMeasurementsRoutes } from "./measurements.routes.js";
import { registerPmuRoutes } from "./pmu.routes.js";
import { CatalogFacade } from "../../../../application/catalog/CatalogFacade.js";
import { BoardViewFacade } from "../../../../application/boardview/BoardViewFacade.js";
import { SchematicsFacade } from "../../../../application/schematics/SchematicsFacade.js";
import { MeasurementsFacade } from "../../../../application/measurements/MeasurementsFacade.js";
import { PmuSimulationFacade } from "../../../../application/schematics/PmuSimulationFacade.js";

export interface V1RoutesDependencies {
  identityAccessFacade: IdentityAccessFacade;
  catalogFacade?: CatalogFacade;
  boardViewFacade?: BoardViewFacade;
  schematicsFacade?: SchematicsFacade;
  measurementsFacade?: MeasurementsFacade;
  pmuFacade?: PmuSimulationFacade;
}

export async function registerV1Routes(
  fastify: FastifyInstance,
  deps: V1RoutesDependencies
): Promise<void> {
  registerAuthRoutes(fastify, deps.identityAccessFacade);

  if (deps.catalogFacade) {
    registerCatalogRoutes(fastify, deps.catalogFacade);
  }
  if (deps.boardViewFacade) {
    registerBoardViewRoutes(fastify, deps.boardViewFacade);
  }
  if (deps.schematicsFacade) {
    registerSchematicsRoutes(fastify, deps.schematicsFacade);
  }
  if (deps.measurementsFacade) {
    registerMeasurementsRoutes(fastify, deps.measurementsFacade);
  }
  if (deps.pmuFacade) {
    registerPmuRoutes(fastify, deps.pmuFacade);
  }
}
