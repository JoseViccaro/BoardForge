import { FastifyRequest, FastifyReply } from "fastify";
import { PmuSimulationFacade } from "../../../application/schematics/PmuSimulationFacade.js";
import { PmuSequenceQuerySchema } from "../dtos/pmu.dto.js";

export class PmuController {
  constructor(private readonly pmuFacade: PmuSimulationFacade) {}

  public simulateSequence = async (req: FastifyRequest, reply: FastifyReply) => {
    const query = PmuSequenceQuerySchema.parse(req.query);
    const orgId = req.tenantContext?.organizationId;
    const result = await this.pmuFacade.simulateSequence(query.board_id, query.trigger, orgId);
    return reply.status(200).send(result);
  };
}
