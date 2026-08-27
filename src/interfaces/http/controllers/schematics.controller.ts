import { FastifyRequest, FastifyReply } from "fastify";
import { SchematicsFacade } from "../../../application/schematics/SchematicsFacade.js";
import { parseMultipartUpload } from "../middlewares/multipart-handler.js";
import {
  SchematicSearchParamsSchema,
  SchematicSearchQuerySchema,
  SchematicPageParamsSchema,
} from "../dtos/schematics.dto.js";

export class SchematicsController {
  constructor(private readonly schematicsFacade: SchematicsFacade) {}

  public upload = async (req: FastifyRequest, reply: FastifyReply) => {
    const file = await parseMultipartUpload(req, {
      expectedType: "pdf",
      maxSizeBytes: 100 * 1024 * 1024,
    });

    const schematicId = file.fields?.schematic_id || "DOC_UPLOADED";
    const orgId = req.tenantContext?.organizationId;

    const result = await this.schematicsFacade.uploadSchematic(
      schematicId,
      { filename: file.filename, buffer: file.buffer },
      orgId
    );

    return reply.status(201).send(result);
  };

  public search = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = SchematicSearchParamsSchema.parse(req.params);
    const query = SchematicSearchQuerySchema.parse(req.query);
    const orgId = req.tenantContext?.organizationId;

    const result = await this.schematicsFacade.searchSymbols(
      params.schematic_id,
      query.query,
      orgId
    );
    return reply.status(200).send(result);
  };

  public getPage = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = SchematicPageParamsSchema.parse(req.params);
    const orgId = req.tenantContext?.organizationId;

    const result = await this.schematicsFacade.getPage(
      params.schematic_id,
      params.page_number,
      orgId
    );
    return reply.status(200).send(result);
  };
}
