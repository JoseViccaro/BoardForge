import { FastifyInstance } from "fastify";
import { CatalogController } from "../../controllers/catalog.controller.js";
import { CatalogFacade } from "../../../../application/catalog/CatalogFacade.js";
import { requireMinimumRole } from "../../plugins/rbac.plugin.js";
import { UserRole } from "../../../../modules/identity-access/domain/value-objects/UserRole.js";

export function registerCatalogRoutes(
  fastify: FastifyInstance,
  catalogFacade: CatalogFacade
): void {
  const controller = new CatalogController(catalogFacade);

  fastify.get(
    "/api/v1/catalog/devices",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.listDevices
  );

  fastify.get(
    "/api/v1/catalog/devices/:id",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getDevice
  );

  fastify.post(
    "/api/v1/catalog/devices",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.LeadTech)],
    },
    controller.createDevice
  );

  fastify.get(
    "/api/v1/catalog/boards/:id",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getBoard
  );
}
