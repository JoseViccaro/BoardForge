import { FastifyInstance } from "fastify";
import { AuthController } from "../../controllers/auth.controller.js";
import { IdentityAccessFacade } from "../../../../modules/identity-access/application/IdentityAccessFacade.js";

export function registerAuthRoutes(
  fastify: FastifyInstance,
  identityAccessFacade: IdentityAccessFacade
): void {
  const controller = new AuthController(identityAccessFacade);

  fastify.post("/api/v1/auth/register", controller.register);
  fastify.post("/api/v1/auth/login", controller.login);
  fastify.post("/api/v1/auth/refresh", controller.refresh);
  fastify.post("/api/v1/auth/logout", controller.logout);
  fastify.get("/api/v1/auth/me", { preHandler: [fastify.authenticate] }, controller.getMe);
}
