import { FastifyInstance } from "fastify";
import { MeasurementsController } from "../../controllers/measurements.controller.js";
import { MeasurementsFacade } from "../../../../application/measurements/MeasurementsFacade.js";
import { requireMinimumRole } from "../../plugins/rbac.plugin.js";
import { UserRole } from "../../../../modules/identity-access/domain/value-objects/UserRole.js";

export function registerMeasurementsRoutes(
  fastify: FastifyInstance,
  measurementsFacade: MeasurementsFacade
): void {
  const controller = new MeasurementsController(measurementsFacade);

  fastify.get(
    "/api/v1/measurements/references",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Viewer)],
    },
    controller.getReferences
  );

  fastify.post(
    "/api/v1/measurements/references",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.LeadTech)],
    },
    controller.createReference
  );

  fastify.post(
    "/api/v1/measurements/records",
    {
      preHandler: [fastify.authenticate, requireMinimumRole(UserRole.Tech)],
    },
    controller.recordMeasurement
  );
}
