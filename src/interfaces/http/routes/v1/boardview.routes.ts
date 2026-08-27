import { FastifyInstance } from "fastify";
import { BoardViewController } from "../../controllers/boardview.controller.js";
import { BoardViewFacade } from "../../../../application/boardview/BoardViewFacade.js";
import { requireMinimumRole } from "../../plugins/rbac.plugin.js";
import { UserRole } from "../../../../modules/identity-access/domain/value-objects/UserRole.js";

export function registerBoardViewRoutes(
  fastify: FastifyInstance,
  boardViewFacade: BoardViewFacade
): void {
  const controller = new BoardViewController(boardViewFacade);

  fastify.post(
    "/api/v1/boardview/upload",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.LeadTech)],
    },
    controller.upload
  );

  fastify.get(
    "/api/v1/boardview/:board_id",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getBoardView
  );

  fastify.get(
    "/api/v1/boardview/:board_id/nets",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getNets
  );

  fastify.get(
    "/api/v1/boardview/:board_id/nets/:net_name",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getNetDetails
  );
}
