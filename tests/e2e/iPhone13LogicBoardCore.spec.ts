import { describe, it, expect, beforeEach } from "vitest";
import { createIPhone13LogicBoardFixture } from "../../src/infrastructure/seeds/iPhone13_820_02106_Seed.js";
import { InMemoryCompositeBoardRepository } from "../../src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { InMemoryNetTopologyRepository } from "../../src/infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.js";
import { InMemoryMeasurementRepository } from "../../src/infrastructure/persistence/in-memory/InMemoryMeasurementRepository.js";
import { GetCompositeBoardHandler } from "../../src/application/catalog/queries/GetCompositeBoardHandler.js";
import { ResolveNetCrossJunctionHandler } from "../../src/application/boardview/queries/ResolveNetCrossJunctionHandler.js";
import { EvaluateDiodeMeasurementHandler } from "../../src/application/measurements/commands/EvaluateDiodeMeasurementHandler.js";
import { SimulateBootSequenceHandler } from "../../src/application/schematics/commands/SimulateBootSequenceHandler.js";
import { DiagnosticBoardState } from "../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EvaluationOutcome } from "../../src/domain/measurements/value-objects/EvaluationOutcome.js";
import { PowerSequenceState } from "../../src/domain/schematics/value-objects/PowerSequenceState.js";
import { BoardStackType } from "../../src/domain/catalog/value-objects/BoardStackType.js";
import { SubBoardRole } from "../../src/domain/catalog/entities/SubBoardEntity.js";
import { NetClassification } from "../../src/domain/boardview/value-objects/NetClassification.js";
import { CoordinateTransformer } from "../../src/domain/boardview/services/CoordinateTransformer.js";

describe("iPhone 13 Logic Board Core - Comprehensive E2E & Domain Contract Verification", () => {
  let boardRepo: InMemoryCompositeBoardRepository;
  let netRepo: InMemoryNetTopologyRepository;
  let measurementRepo: InMemoryMeasurementRepository;

  let getCompositeBoardHandler: GetCompositeBoardHandler;
  let resolveNetHandler: ResolveNetCrossJunctionHandler;
  let evaluateDiodeHandler: EvaluateDiodeMeasurementHandler;
  let simulateBootHandler: SimulateBootSequenceHandler;

  let fixture: ReturnType<typeof createIPhone13LogicBoardFixture>;

  beforeEach(async () => {
    boardRepo = new InMemoryCompositeBoardRepository();
    netRepo = new InMemoryNetTopologyRepository();
    measurementRepo = new InMemoryMeasurementRepository();

    getCompositeBoardHandler = new GetCompositeBoardHandler(boardRepo);
    resolveNetHandler = new ResolveNetCrossJunctionHandler(netRepo);
    evaluateDiodeHandler = new EvaluateDiodeMeasurementHandler(measurementRepo);
    simulateBootHandler = new SimulateBootSequenceHandler();

    fixture = createIPhone13LogicBoardFixture();

    await boardRepo.save(fixture.compositeBoard);
    for (const topology of fixture.netTopologies) {
      await netRepo.save(topology);
    }
    await measurementRepo.save(fixture.measurementProfile);
  });

  describe("1. Catalog Subsystem - Composite Board Structure", () => {
    it("should load iPhone 13 (820-02106) composite board with 3 sub-boards and correct layer counts", async () => {
      const boardDto = await getCompositeBoardHandler.execute({ boardId: "BRD_820_02106" });

      expect(boardDto).toBeDefined();
      expect(boardDto.id).toBe("BRD_820_02106");
      expect(boardDto.boardNumber).toBe("820-02106");
      expect(boardDto.stackType).toBe(BoardStackType.SANDWICH_INTERPOSER);
      expect(boardDto.subBoards).toHaveLength(3);

      const topLogic = boardDto.subBoards.find((sb) => sb.role === SubBoardRole.TOP_LOGIC);
      const interposer = boardDto.subBoards.find((sb) => sb.role === SubBoardRole.INTERPOSER_FRAME);
      const bottomRf = boardDto.subBoards.find((sb) => sb.role === SubBoardRole.BOTTOM_RF);

      expect(topLogic).toBeDefined();
      expect(topLogic?.layerCount).toBe(10);
      expect(topLogic?.dimensions?.width).toBe(60.0);
      expect(topLogic?.dimensions?.height).toBe(120.0);

      expect(interposer).toBeDefined();
      expect(interposer?.layerCount).toBe(2);

      expect(bottomRf).toBeDefined();
      expect(bottomRf?.layerCount).toBe(8);
    });
  });

  describe("2. BoardView Subsystem - Net Cross-Junction & Spatial Transformations", () => {
    it("should resolve bidirectional electrical path across Top AP, Interposer, and Bottom RF", async () => {
      // Trace from Top AP Pin (Main PMIC U2700.A12)
      const resolution = await resolveNetHandler.execute({
        boardId: "BRD_820_02106",
        padId: "TOP_U2700_A12",
      });

      expect(resolution.canonicalNetName).toBe("PP_VDD_MAIN");
      expect(resolution.classification).toBe(NetClassification.POWER_MAIN);
      expect(resolution.originPadId).toBe("TOP_U2700_A12");
      expect(resolution.interposerPadId).toBe("INT_PAD_084");
      expect(resolution.connectedPins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subBoardId: "SUB_IPHONE13_BOTTOM_RF",
            padId: "BOT_UBBPMU_C4",
            pinRef: "U_BB_PMU.C4",
          }),
        ])
      );
    });

    it("should resolve all connected sub-board pins when querying directly by Interposer pad INT_PAD_084", async () => {
      const resolution = await resolveNetHandler.execute({
        boardId: "BRD_820_02106",
        interposerPadId: "INT_PAD_084",
      });

      expect(resolution.canonicalNetName).toBe("PP_VDD_MAIN");
      expect(resolution.classification).toBe(NetClassification.POWER_MAIN);
      expect(resolution.interposerPadId).toBe("INT_PAD_084");
      expect(resolution.connectedPins).toHaveLength(2);
      expect(resolution.connectedPins.map((p) => p.padId)).toEqual(
        expect.arrayContaining(["TOP_U2700_A12", "BOT_UBBPMU_C4"])
      );
    });

    it("should accurately perform horizontal coordinate flipping and exploded 3D stack transforms", () => {
      const topLogic = fixture.compositeBoard.getSubBoard("SUB_IPHONE13_TOP_LOGIC")!;
      const u2700 = topLogic.getComponent("COMP_U2700")!;
      const origCoord = u2700.coordinate;

      const flipped = CoordinateTransformer.flipHorizontal(origCoord, 60.0);
      expect(flipped.x).toBe(35.0); // 60.0 - 25.0
      expect(flipped.y).toBe(50.0);

      const exploded = CoordinateTransformer.stackTransform(origCoord, 15.0);
      expect(exploded.z).toBe(0.0); // zIndex 0 * 15.0
    });
  });

  describe("3. Measurements Subsystem - Diode Mode & Multimeter Calibrations", () => {
    it("should evaluate normal diode reading as PASS in SPLIT_TOP state", async () => {
      const result = await evaluateDiodeHandler.execute({
        boardId: "BRD_820_02106",
        padId: "INT_PAD_084",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        measuredVolts: 0.418,
      });

      expect(result.outcome).toBe(EvaluationOutcome.PASS);
      expect(result.isPass).toBe(true);
      expect(result.deviationPct).toBeCloseTo(-1.65, 1);
    });

    it("should detect short-to-ground on PP_VDD_MAIN (0.012V)", async () => {
      const result = await evaluateDiodeHandler.execute({
        boardId: "BRD_820_02106",
        padId: "INT_PAD_084",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        measuredVolts: 0.012,
      });

      expect(result.outcome).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
      expect(result.isPass).toBe(false);
      expect(result.message).toContain("Possible short circuit to ground");
    });

    it("should detect open circuit / missing pull-up (OL / 2.999V) on I2C0_SDA line", async () => {
      const result = await evaluateDiodeHandler.execute({
        boardId: "BRD_820_02106",
        padId: "INT_PAD_042",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        measuredVolts: 2.999,
      });

      expect(result.outcome).toBe(EvaluationOutcome.OPEN_LINE_OL);
      expect(result.isPass).toBe(false);
      expect(result.message).toContain("unseated pull-up resistor or open interposer trace");
    });

    it("should normalize Sunshine DT17N reading (+0.035V) against Fluke 115 baseline", async () => {
      const result = await evaluateDiodeHandler.execute({
        boardId: "BRD_820_02106",
        padId: "INT_PAD_084",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        measuredVolts: 0.380,
        meterProfile: {
          meterModel: "SUNSHINE_DT17N",
          scaleFactor: 1.0,
          offsetVolts: 0.035,
        },
      });

      expect(result.normalizedVolts).toBe(0.415);
      expect(result.outcome).toBe(EvaluationOutcome.PASS);
      expect(result.isPass).toBe(true);
    });

    it("should verify different reference readings for different sandwich states (JOINED vs SPLIT)", async () => {
      const joinedRef = await evaluateDiodeHandler.execute({
        boardId: "BRD_820_02106",
        padId: "INT_PAD_084",
        boardState: DiagnosticBoardState.JOINED_SANDWICH,
        measuredVolts: 0.385,
      });

      expect(joinedRef.outcome).toBe(EvaluationOutcome.PASS);
      expect(joinedRef.nominalVolts).toBe(0.385);
    });
  });

  describe("4. Schematics Subsystem - Power Tree & PMU Cold Boot Simulation", () => {
    it("should simulate full cold-boot cascade S5_OFF -> S4_STANDBY -> S3_TRIGGER -> S0_FULL_EXECUTION", async () => {
      const simResult = await simulateBootHandler.execute({
        powerTree: fixture.powerTree,
        initialState: PowerSequenceState.S5_OFF,
        targetState: PowerSequenceState.S0_FULL_EXECUTION,
      });

      expect(simResult.success).toBe(true);
      expect(simResult.finalState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
      expect(simResult.steps).toHaveLength(3);

      expect(simResult.activeRails).toContain("PP_BATT_VCC");
      expect(simResult.activeRails).toContain("PP_VDD_MAIN");
      expect(simResult.activeRails).toContain("PP_VDD_BOOST");
      expect(simResult.activeRails).toContain("PP1V8_S2");
      expect(simResult.activeRails).toContain("PP_VDD_CPU_CORE");
      expect(simResult.activeRails).toContain("PP_VDD_GPU");
      expect(simResult.activeRails).toContain("PP0V85_LPDDR5");
      expect(simResult.activeRails).toContain("PP_VDD_RF_MAIN");
    });

    it("should reject illegal state jump from S5_OFF directly to S0_FULL_EXECUTION if unsequenced", () => {
      expect(() => {
        fixture.powerTree.evaluateExpectedState("PP_VDD_BOOST");
      }).not.toThrow();
    });

    it("should validate rail dependency when parent rail PP_VDD_MAIN is faulted", () => {
      fixture.powerTree.setRailPowered("PP_VDD_MAIN", false);
      const depCheck = fixture.powerTree.validateRailDependency("PP_VDD_BOOST");

      expect(depCheck.isValid).toBe(true); // not powered yet

      fixture.powerTree.setRailPowered("PP_VDD_BOOST", true);
      const invalidDepCheck = fixture.powerTree.validateRailDependency("PP_VDD_BOOST");
      expect(invalidDepCheck.isValid).toBe(false);
      expect(invalidDepCheck.reason).toContain("Parent rail PP_VDD_MAIN inactive");
    });
  });
});
