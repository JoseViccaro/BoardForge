import { FastifyInstance } from "fastify";
import { PmuController } from "../../controllers/pmu.controller.js";
import { PmuSimulationFacade } from "../../../../application/schematics/PmuSimulationFacade.js";
import { requireMinimumRole } from "../../plugins/rbac.plugin.js";
import { UserRole } from "../../../../modules/identity-access/domain/value-objects/UserRole.js";

export function registerPmuRoutes(
  fastify: FastifyInstance,
  pmuFacade: PmuSimulationFacade
): void {
  const controller = new PmuController(pmuFacade);

  fastify.get(
    "/api/v1/pmu/sequence",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Tech)],
    },
    controller.simulateSequence
  );
}
