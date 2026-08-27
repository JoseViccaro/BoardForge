import { FastifyInstance } from "fastify";
import { SchematicsController } from "../../controllers/schematics.controller.js";
import { SchematicsFacade } from "../../../../application/schematics/SchematicsFacade.js";
import { requireMinimumRole } from "../../plugins/rbac.plugin.js";
import { UserRole } from "../../../../modules/identity-access/domain/value-objects/UserRole.js";

export function registerSchematicsRoutes(
  fastify: FastifyInstance,
  schematicsFacade: SchematicsFacade
): void {
  const controller = new SchematicsController(schematicsFacade);

  fastify.post(
    "/api/v1/schematics/upload",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.LeadTech)],
    },
    controller.upload
  );

  fastify.get(
    "/api/v1/schematics/:schematic_id/search",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.search
  );

  fastify.get(
    "/api/v1/schematics/:schematic_id/pages/:page_number",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getPage
  );
}
