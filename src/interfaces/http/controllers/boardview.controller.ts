import { FastifyRequest, FastifyReply } from "fastify";
import { BoardViewFacade } from "../../../application/boardview/BoardViewFacade.js";
import { parseMultipartUpload } from "../middlewares/multipart-handler.js";
import {
  BoardViewParamsSchema,
  NetQueryParamsSchema,
  NetDetailParamsSchema,
} from "../dtos/boardview.dto.js";

export class BoardViewController {
  constructor(private readonly boardViewFacade: BoardViewFacade) {}

  public upload = async (req: FastifyRequest, reply: FastifyReply) => {
    const file = await parseMultipartUpload(req, {
      expectedType: "boardview",
      maxSizeBytes: 50 * 1024 * 1024,
    });

    const boardId = file.fields?.board_id || req.headers["x-board-id"] || "BRD_UPLOADED";
    const subBoardId = file.fields?.sub_board_id || "SUB_1";
    const subBoardLabel = file.fields?.sub_board_label || "Main Board";

    const result = await this.boardViewFacade.uploadBoardView({
      boardId,
      boardNumber: boardId,
      files: [
        {
          filename: file.filename,
          content: file.buffer,
          subBoardId,
          subBoardLabel,
        },
      ],
    });

    return reply.status(201).send(result);
  };

  public getBoardView = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = BoardViewParamsSchema.parse(req.params);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.boardViewFacade.getBoardView(params.board_id, orgId);
    return reply.status(200).send(result);
  };

  public getNets = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = BoardViewParamsSchema.parse(req.params);
    const query = NetQueryParamsSchema.parse(req.query);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.boardViewFacade.getNets(params.board_id, query.search, orgId);
    return reply.status(200).send(result);
  };

  public getNetDetails = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = NetDetailParamsSchema.parse(req.params);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.boardViewFacade.getNetDetails(
      params.board_id,
      params.net_name,
      orgId
    );
    return reply.status(200).send(result);
  };
}
