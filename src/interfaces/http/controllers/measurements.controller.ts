import { FastifyRequest, FastifyReply } from "fastify";
import { MeasurementsFacade } from "../../../application/measurements/MeasurementsFacade.js";
import {
  GetReferencesQuerySchema,
  CreateReferenceSchema,
  RecordMeasurementSchema,
} from "../dtos/measurements.dto.js";

export class MeasurementsController {
  constructor(private readonly measurementsFacade: MeasurementsFacade) {}

  public getReferences = async (req: FastifyRequest, reply: FastifyReply) => {
    const query = GetReferencesQuerySchema.parse(req.query);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.measurementsFacade.getReferences(
      query.board_id,
      query.pad_id,
      query.state,
      orgId
    );
    return reply.status(200).send(result);
  };

  public createReference = async (req: FastifyRequest, reply: FastifyReply) => {
    const dto = CreateReferenceSchema.parse(req.body);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.measurementsFacade.createReference(dto, orgId);
    return reply.status(201).send(result);
  };

  public recordMeasurement = async (req: FastifyRequest, reply: FastifyReply) => {
    const dto = RecordMeasurementSchema.parse(req.body);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.measurementsFacade.recordMeasurement(dto, orgId);
    return reply.status(200).send(result);
  };
}
