import { CompositeBoard } from "../../domain/catalog/entities/CompositeBoard.js";
import { SubBoardEntity, SubBoardRole } from "../../domain/catalog/entities/SubBoardEntity.js";
import { BoardStackType } from "../../domain/catalog/value-objects/BoardStackType.js";
import { ComponentEntity } from "../../domain/boardview/entities/ComponentEntity.js";
import { PadEntity } from "../../domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../domain/boardview/value-objects/LayerSide.js";
import { InterposerJunction } from "../../domain/boardview/value-objects/InterposerJunction.js";
import { NetClassification } from "../../domain/boardview/value-objects/NetClassification.js";
import { NetTopology } from "../../domain/boardview/aggregates/NetTopology.js";
import { MeasurementProfile } from "../../domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";
import { PowerTree } from "../../domain/schematics/entities/PowerTree.js";
import { PowerRailNode } from "../../domain/schematics/entities/PowerRailNode.js";
import { PowerRailType } from "../../domain/schematics/value-objects/PowerRailType.js";

export interface IPhone13FixtureData {
  compositeBoard: CompositeBoard;
  netTopologies: NetTopology[];
  measurementProfile: MeasurementProfile;
  powerTree: PowerTree;
}

export function createIPhone13LogicBoardFixture(): IPhone13FixtureData {
  // 1. Sub-Boards
  const topLogicBoard = new SubBoardEntity({
    id: "SUB_IPHONE13_TOP_LOGIC",
    label: "Apple iPhone 13 Top AP Logic Board",
    role: SubBoardRole.TOP_LOGIC,
    layerCount: 10,
    dimensions: { width: 60.0, height: 120.0 },
  });

  const interposerFrame = new SubBoardEntity({
    id: "SUB_IPHONE13_INTERPOSER",
    label: "Apple iPhone 13 Interposer Frame",
    role: SubBoardRole.INTERPOSER_FRAME,
    layerCount: 2,
    dimensions: { width: 60.0, height: 120.0 },
  });

  const bottomRfBoard = new SubBoardEntity({
    id: "SUB_IPHONE13_BOTTOM_RF",
    label: "Apple iPhone 13 Bottom RF Board",
    role: SubBoardRole.BOTTOM_RF,
    layerCount: 8,
    dimensions: { width: 60.0, height: 120.0 },
  });

  // 2. Components & Pads for Top AP Board
  // Main PMIC U2700
  const u2700 = new ComponentEntity({
    id: "COMP_U2700",
    designator: "U2700",
    subBoardId: topLogicBoard.id,
    coordinate: new LayerCoordinate(25.0, 50.0, LayerSide.TOP_SIDE, 0),
    packageType: "BGA",
  });
  const u2700PinA12 = new PadEntity({
    id: "TOP_U2700_A12",
    padNumber: "A12",
    subBoardId: topLogicBoard.id,
    coordinate: new LayerCoordinate(25.2, 50.4, LayerSide.TOP_SIDE, 0),
    netName: "PP_VDD_MAIN",
    componentId: "COMP_U2700",
    pinName: "VDD_MAIN_OUT",
  });
  u2700.addPin(u2700PinA12);
  topLogicBoard.addComponent(u2700);
  topLogicBoard.addPad(u2700PinA12);

  // A15 SoC U0100
  const u0100 = new ComponentEntity({
    id: "COMP_U0100",
    designator: "U0100",
    subBoardId: topLogicBoard.id,
    coordinate: new LayerCoordinate(30.0, 70.0, LayerSide.TOP_SIDE, 0),
    packageType: "POP_BGA",
  });
  const u0100PinCore = new PadEntity({
    id: "TOP_U0100_E5",
    padNumber: "E5",
    subBoardId: topLogicBoard.id,
    coordinate: new LayerCoordinate(30.5, 70.5, LayerSide.TOP_SIDE, 0),
    netName: "PP_VDD_CPU_CORE",
    componentId: "COMP_U0100",
    pinName: "VDD_CPU",
  });
  u0100.addPin(u0100PinCore);
  topLogicBoard.addComponent(u0100);
  topLogicBoard.addPad(u0100PinCore);

  // NAND U2600
  const u2600 = new ComponentEntity({
    id: "COMP_U2600",
    designator: "U2600",
    subBoardId: topLogicBoard.id,
    coordinate: new LayerCoordinate(20.0, 30.0, LayerSide.TOP_SIDE, 0),
    packageType: "BGA",
  });
  topLogicBoard.addComponent(u2600);

  // 3. Components & Pads for Bottom RF Board
  // Baseband PMU U_BB_PMU (PMX60)
  const uBbPmu = new ComponentEntity({
    id: "COMP_U_BB_PMU",
    designator: "U_BB_PMU",
    subBoardId: bottomRfBoard.id,
    coordinate: new LayerCoordinate(22.0, 45.0, LayerSide.BOTTOM_SIDE, 2),
    packageType: "BGA",
  });
  const uBbPmuPinC4 = new PadEntity({
    id: "BOT_UBBPMU_C4",
    padNumber: "C4",
    subBoardId: bottomRfBoard.id,
    coordinate: new LayerCoordinate(22.4, 45.4, LayerSide.BOTTOM_SIDE, 2),
    netName: "PP_VDD_RF_MAIN",
    componentId: "COMP_U_BB_PMU",
    pinName: "VIN_MAIN",
  });
  uBbPmu.addPin(uBbPmuPinC4);
  bottomRfBoard.addComponent(uBbPmu);
  bottomRfBoard.addPad(uBbPmuPinC4);

  // Qualcomm Baseband Modem X60 U_BB
  const uBb = new ComponentEntity({
    id: "COMP_U_BB",
    designator: "U_BB",
    subBoardId: bottomRfBoard.id,
    coordinate: new LayerCoordinate(28.0, 65.0, LayerSide.BOTTOM_SIDE, 2),
    packageType: "BGA",
  });
  bottomRfBoard.addComponent(uBb);

  // 4. Interposer Pads on Interposer Sub-Board
  const intPad084 = new PadEntity({
    id: "INT_PAD_084",
    padNumber: "84",
    subBoardId: interposerFrame.id,
    coordinate: new LayerCoordinate(5.0, 50.0, LayerSide.TOP_SIDE, 1),
    netName: "PP_VDD_MAIN",
    isInterposerPad: true,
  });
  const intPad042 = new PadEntity({
    id: "INT_PAD_042",
    padNumber: "42",
    subBoardId: interposerFrame.id,
    coordinate: new LayerCoordinate(5.0, 30.0, LayerSide.TOP_SIDE, 1),
    netName: "I2C0_SDA",
    isInterposerPad: true,
  });
  const intPad112 = new PadEntity({
    id: "INT_PAD_112",
    padNumber: "112",
    subBoardId: interposerFrame.id,
    coordinate: new LayerCoordinate(5.0, 80.0, LayerSide.TOP_SIDE, 1),
    netName: "PP1V8_S2",
    isInterposerPad: true,
  });
  interposerFrame.addPad(intPad084);
  interposerFrame.addPad(intPad042);
  interposerFrame.addPad(intPad112);

  // 5. Composite Board Aggregate
  const compositeBoard = new CompositeBoard({
    id: "BRD_820_02106",
    boardNumber: "820-02106",
    stackType: BoardStackType.SANDWICH_INTERPOSER,
    subBoards: [topLogicBoard, interposerFrame, bottomRfBoard],
  });

  // 6. Net Topologies
  const netVddMain = new NetTopology({
    id: "NET_PP_VDD_MAIN_820_02106",
    canonicalNetName: "PP_VDD_MAIN",
    classification: NetClassification.POWER_MAIN,
    localPins: [
      { subBoardId: topLogicBoard.id.value, padId: "TOP_U2700_A12", pinRef: "U2700.A12" },
      { subBoardId: bottomRfBoard.id.value, padId: "BOT_UBBPMU_C4", pinRef: "U_BB_PMU.C4" },
    ],
    interposerJunctions: [
      new InterposerJunction({
        junctionId: "JUNC_084",
        interposerPadId: "INT_PAD_084",
        topPadId: "TOP_U2700_A12",
        bottomPadId: "BOT_UBBPMU_C4",
        canonicalNetName: "PP_VDD_MAIN",
        classification: NetClassification.POWER_MAIN,
      }),
    ],
  });

  const netI2c0Sda = new NetTopology({
    id: "NET_I2C0_SDA_820_02106",
    canonicalNetName: "I2C0_SDA",
    classification: NetClassification.SIGNAL_I2C,
    localPins: [],
    interposerJunctions: [
      new InterposerJunction({
        junctionId: "JUNC_042",
        interposerPadId: "INT_PAD_042",
        canonicalNetName: "I2C0_SDA",
        classification: NetClassification.SIGNAL_I2C,
      }),
    ],
  });

  const netPp1v8S2 = new NetTopology({
    id: "NET_PP1V8_S2_820_02106",
    canonicalNetName: "PP1V8_S2",
    classification: NetClassification.POWER_MAIN,
    localPins: [],
    interposerJunctions: [
      new InterposerJunction({
        junctionId: "JUNC_112",
        interposerPadId: "INT_PAD_112",
        canonicalNetName: "PP1V8_S2",
        classification: NetClassification.POWER_MAIN,
      }),
    ],
  });

  // 7. Measurement Profile & Multi-State References
  const measurementProfile = new MeasurementProfile({
    id: "MEAS_820_02106",
    boardId: "BRD_820_02106",
    title: "Apple iPhone 13 (820-02106) Golden Reference Measurements",
    baseline: "FLUKE_115_STANDARD",
    references: [
      // INT_PAD_084 (PP_VDD_MAIN) across all 4 diagnostic states
      new MeasurementReference({
        id: "REF_084_SPLIT_TOP",
        padId: "INT_PAD_084",
        netName: "PP_VDD_MAIN",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        nominal: 0.425,
        min: 0.395,
        max: 0.455,
        tolerancePct: 7.0,
      }),
      new MeasurementReference({
        id: "REF_084_SPLIT_BOTTOM",
        padId: "INT_PAD_084",
        netName: "PP_VDD_MAIN",
        boardState: DiagnosticBoardState.SPLIT_BOTTOM,
        nominal: 0.510,
        min: 0.474,
        max: 0.546,
        tolerancePct: 7.0,
      }),
      new MeasurementReference({
        id: "REF_084_JOINED_SANDWICH",
        padId: "INT_PAD_084",
        netName: "PP_VDD_MAIN",
        boardState: DiagnosticBoardState.JOINED_SANDWICH,
        nominal: 0.385,
        min: 0.358,
        max: 0.412,
        tolerancePct: 7.0,
      }),
      new MeasurementReference({
        id: "REF_084_SOCKET_FIXTURE",
        padId: "INT_PAD_084",
        netName: "PP_VDD_MAIN",
        boardState: DiagnosticBoardState.SOCKET_FIXTURE,
        nominal: 0.382,
        min: 0.355,
        max: 0.409,
        tolerancePct: 7.0,
      }),
      // INT_PAD_042 (I2C0_SDA)
      new MeasurementReference({
        id: "REF_042_SPLIT_TOP",
        padId: "INT_PAD_042",
        netName: "I2C0_SDA",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        nominal: 0.480,
        min: 0.446,
        max: 0.514,
        tolerancePct: 7.0,
      }),
    ],
  });

  // 8. Power Tree for A15 & PMU
  const powerTree = new PowerTree("POWERTREE_IPHONE13_820_02106");
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP_BATT_VCC",
      nominalVoltage: 3.8,
      voltageMin: 3.0,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.5,
      railType: PowerRailType.PRIMARY_BUS,
      parentRailName: "PP_BATT_VCC",
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP_VDD_BOOST",
      nominalVoltage: 5.0,
      voltageMin: 4.8,
      voltageMax: 5.2,
      railType: PowerRailType.BOOST,
      parentRailName: "PP_VDD_MAIN",
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP1V8_S2",
      nominalVoltage: 1.8,
      voltageMin: 1.7,
      voltageMax: 1.9,
      railType: PowerRailType.ALWAYS_ON_S2,
      parentRailName: "PP_VDD_MAIN",
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP_VDD_CPU_CORE",
      nominalVoltage: 0.85,
      voltageMin: 0.7,
      voltageMax: 1.0,
      railType: PowerRailType.CORE_BUCK,
      parentRailName: "PP_VDD_MAIN",
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP_VDD_GPU",
      nominalVoltage: 0.85,
      voltageMin: 0.7,
      voltageMax: 1.0,
      railType: PowerRailType.CORE_BUCK,
      parentRailName: "PP_VDD_MAIN",
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP0V85_LPDDR5",
      nominalVoltage: 0.85,
      voltageMin: 0.8,
      voltageMax: 0.9,
      railType: PowerRailType.CORE_BUCK,
      parentRailName: "PP_VDD_MAIN",
    })
  );
  powerTree.addRail(
    new PowerRailNode({
      railName: "PP_VDD_RF_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.5,
      railType: PowerRailType.PRIMARY_BUS,
      parentRailName: "PP_VDD_MAIN",
    })
  );

  return {
    compositeBoard,
    netTopologies: [netVddMain, netI2c0Sda, netPp1v8S2],
    measurementProfile,
    powerTree,
  };
}
