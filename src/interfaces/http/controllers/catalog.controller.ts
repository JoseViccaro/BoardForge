import { FastifyRequest, FastifyReply } from "fastify";
import { CatalogFacade } from "../../../application/catalog/CatalogFacade.js";
import { CreateDeviceSchema, DeviceParamsSchema, BoardParamsSchema } from "../dtos/catalog.dto.js";

export class CatalogController {
  constructor(private readonly catalogFacade: CatalogFacade) {}

  public listDevices = async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.tenantContext?.organizationId;
    const result = await this.catalogFacade.listDevices(orgId);
    return reply.status(200).send(result);
  };

  public getDevice = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = DeviceParamsSchema.parse(req.params);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.catalogFacade.getDeviceById(params.id, orgId);
    return reply.status(200).send(result);
  };

  public createDevice = async (req: FastifyRequest, reply: FastifyReply) => {
    const dto = CreateDeviceSchema.parse(req.body);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.catalogFacade.createDevice(dto, orgId);
    return reply.status(201).send(result);
  };

  public getBoard = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = BoardParamsSchema.parse(req.params);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.catalogFacade.getBoardById(params.id, orgId);
    return reply.status(200).send(result);
  };
}
