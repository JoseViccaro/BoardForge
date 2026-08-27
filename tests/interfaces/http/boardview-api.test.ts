import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { BoardViewFacade } from "../../../src/application/boardview/BoardViewFacade.js";
import { InMemoryCompositeBoardRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { InMemoryNetTopologyRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.js";
import { BoardViewParserFactory } from "../../../src/infrastructure/boardview/parsers/BoardViewParserFactory.js";
import { BoardViewToCanonicalTransformer } from "../../../src/domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { createIPhone13LogicBoardFixture } from "../../../src/infrastructure/seeds/iPhone13_820_02106_Seed.js";

describe("BoardView Controller (/api/v1/boardview)", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let boardRepo: InMemoryCompositeBoardRepository;
  let topologyRepo: InMemoryNetTopologyRepository;
  let boardViewFacade: BoardViewFacade;
  let techToken: string;
  let leadToken: string;

  beforeEach(async () => {
    boardRepo = new InMemoryCompositeBoardRepository();
    topologyRepo = new InMemoryNetTopologyRepository();

    const fixture = createIPhone13LogicBoardFixture();
    await boardRepo.save(fixture.compositeBoard);
    for (const top of fixture.netTopologies) {
      await topologyRepo.save(top);
    }

    const parserFactory = new BoardViewParserFactory();
    const transformer = new BoardViewToCanonicalTransformer();
    boardViewFacade = new BoardViewFacade(boardRepo, topologyRepo, parserFactory, transformer);

    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });

    const techPair = await tokenManager.generateTokenPair({
      id: "usr_tech",
      organizationId: "org_1",
      role: UserRole.Tech,
    });
    techToken = techPair.accessToken;

    const leadPair = await tokenManager.generateTokenPair({
      id: "usr_lead",
      organizationId: "org_1",
      role: UserRole.LeadTech,
    });
    leadToken = leadPair.accessToken;

    app = await createFastifyApp({
      tokenManager,
      enableRateLimiting: false,
      routesRegister: async (instance) => {
        await registerV1Routes(instance, {
          identityAccessFacade: {} as any,
          boardViewFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/v1/boardview/:board_id should return canonical board geometry and sub-boards", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/boardview/BRD_820_02106",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.boardId).toBe("BRD_820_02106");
    expect(body.subBoards.length).toBe(3);
  });

  it("GET /api/v1/boardview/:board_id/nets should list nets with search filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/boardview/BRD_820_02106/nets?search=VDD_MAIN",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.nets)).toBe(true);
    expect(body.nets).toContain("PP_VDD_MAIN");
  });

  it("GET /api/v1/boardview/:board_id/nets/:net_name should return cross-subboard pins & interposer junctions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/boardview/BRD_820_02106/nets/PP_VDD_MAIN",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(body.interposerJunctions.length).toBeGreaterThan(0);
  });

  it("POST /api/v1/boardview/upload should allow LeadTech to upload valid boardview file", async () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const bdvContent =
      "[format]\nformat=bdv\n" +
      "# [pins]\n" +
      "10.0 20.0 1 TOP U1.1 PP_VDD_MAIN\n";
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="board.bdv"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${bdvContent}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="board_id"\r\n\r\n` +
      `BRD_NEW_UPLOAD\r\n` +
      `--${boundary}--\r\n`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/boardview/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${leadToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.boardId).toBe("BRD_NEW_UPLOAD");
  });
});
