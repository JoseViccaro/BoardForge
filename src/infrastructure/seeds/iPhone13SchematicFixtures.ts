import { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../domain/schematics/entities/SchematicPage.js";
import { SchematicSymbol } from "../../domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../domain/schematics/entities/SchematicPinLocation.js";
import { NetLabelMatch } from "../../domain/schematics/value-objects/NetLabelMatch.js";
import { VectorToken, TokenType } from "../../domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../domain/schematics/value-objects/BoundingBox2D.js";
import { NetTopology } from "../../domain/boardview/aggregates/NetTopology.js";
import { NetClassification } from "../../domain/boardview/value-objects/NetClassification.js";
import { InterposerJunction } from "../../domain/boardview/value-objects/InterposerJunction.js";
import { SubBoardEntity, SubBoardRole } from "../../domain/catalog/entities/SubBoardEntity.js";
import { PadEntity } from "../../domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../domain/boardview/value-objects/LayerSide.js";

export interface iPhone13SchematicFixturesResult {
  document: SchematicDocument;
  topologies: NetTopology[];
  subBoards: SubBoardEntity[];
}

export class iPhone13SchematicFixtures {
  public static createFixtures(): iPhone13SchematicFixturesResult {
    const doc = new SchematicDocument({
      documentId: "DOC_IPHONE13_820_02106",
      title: "Apple iPhone 13 Logic Board Schematics (820-02106)",
      pageCount: 120,
    });

    // --- Page 12: PMU A15 - Main Power & Bucks ---
    const page12 = new SchematicPage({ pageNumber: 12, width: 1000, height: 800 });
    const symU2700A = new SchematicSymbol({
      id: "SYM_U2700_BANK_A",
      refDes: "U2700",
      bankDesignator: "A: BUCK_POWER",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 400, 400),
    });

    const pinA12 = new SchematicPinLocation({
      id: "PIN_U2700_A12",
      refDes: "U2700",
      pinNumber: "A12",
      pinName: "VDD_MAIN_IN1",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      connectionPoint: { x: 180, y: 207.5 },
      connectedNetName: "PP_VDD_MAIN",
    });

    const pinB12 = new SchematicPinLocation({
      id: "PIN_U2700_B12",
      refDes: "U2700",
      pinNumber: "B12",
      pinName: "VDD_MAIN_IN2",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 220, 195, 235),
      connectionPoint: { x: 180, y: 227.5 },
      connectedNetName: "PP_VDD_MAIN",
    });

    const pinC1 = new SchematicPinLocation({
      id: "PIN_U2700_C1",
      refDes: "U2700",
      pinNumber: "C1",
      pinName: "BUCK0_LX",
      pageNumber: 12,
      bounds: new BoundingBox2D(350, 200, 365, 215),
      connectionPoint: { x: 365, y: 207.5 },
      connectedNetName: "PP_VDD_CPU_CORE",
    });

    const pinD1 = new SchematicPinLocation({
      id: "PIN_U2700_D1",
      refDes: "U2700",
      pinNumber: "D1",
      pinName: "BUCK1_LX",
      pageNumber: 12,
      bounds: new BoundingBox2D(350, 220, 365, 235),
      connectionPoint: { x: 365, y: 227.5 },
      connectedNetName: "PP0V85_LPDDR5",
    });

    symU2700A.addPin(pinA12);
    symU2700A.addPin(pinB12);
    symU2700A.addPin(pinC1);
    symU2700A.addPin(pinD1);
    page12.addSymbol(symU2700A);
    doc.registerSymbol(symU2700A);

    page12.addNetLabel(new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(120, 200, 175, 215),
    }));
    page12.addToken(new VectorToken({
      text: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(120, 200, 175, 215),
      fontSize: 8,
      tokenType: TokenType.NET_LABEL,
    }));
    page12.addToken(new VectorToken({
      text: "A12",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      fontSize: 8,
      tokenType: TokenType.PIN_NUM,
    }));
    doc.addPage(page12);

    // --- Page 13: PMU A15 - Standby & System Control ---
    const page13 = new SchematicPage({ pageNumber: 13, width: 1000, height: 800 });
    const symU2700B = new SchematicSymbol({
      id: "SYM_U2700_BANK_B",
      refDes: "U2700",
      bankDesignator: "B: SYSTEM_CONTROL",
      pageNumber: 13,
      bounds: new BoundingBox2D(100, 100, 400, 400),
    });

    const pinE5 = new SchematicPinLocation({
      id: "PIN_U2700_E5",
      refDes: "U2700",
      pinNumber: "E5",
      pinName: "LDO2_OUT",
      pageNumber: 13,
      bounds: new BoundingBox2D(350, 150, 365, 165),
      connectionPoint: { x: 365, y: 157.5 },
      connectedNetName: "PP1V8_S2",
    });

    const pinF2 = new SchematicPinLocation({
      id: "PIN_U2700_F2",
      refDes: "U2700",
      pinNumber: "F2",
      pinName: "ONOFF_KEY_L",
      pageNumber: 13,
      bounds: new BoundingBox2D(180, 150, 195, 165),
      connectionPoint: { x: 180, y: 157.5 },
      connectedNetName: "BUTTON_TO_PMU_ONOFF_L",
    });

    const pinG4 = new SchematicPinLocation({
      id: "PIN_U2700_G4",
      refDes: "U2700",
      pinNumber: "G4",
      pinName: "I2C0_SDA",
      pageNumber: 13,
      bounds: new BoundingBox2D(180, 180, 195, 195),
      connectionPoint: { x: 180, y: 187.5 },
      connectedNetName: "I2C0_SDA",
    });

    const pinG5 = new SchematicPinLocation({
      id: "PIN_U2700_G5",
      refDes: "U2700",
      pinNumber: "G5",
      pinName: "I2C0_SCL",
      pageNumber: 13,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      connectionPoint: { x: 180, y: 207.5 },
      connectedNetName: "I2C0_SCL",
    });

    symU2700B.addPin(pinE5);
    symU2700B.addPin(pinF2);
    symU2700B.addPin(pinG4);
    symU2700B.addPin(pinG5);
    page13.addSymbol(symU2700B);
    doc.registerSymbol(symU2700B);
    doc.addPage(page13);

    // --- Page 25: Charger / Tigris Subsystem ---
    const page25 = new SchematicPage({ pageNumber: 25, width: 1000, height: 800 });
    const symU3300 = new SchematicSymbol({
      id: "SYM_U3300",
      refDes: "U3300",
      pageNumber: 25,
      bounds: new BoundingBox2D(100, 100, 300, 300),
    });
    symU3300.addPin(new SchematicPinLocation({
      id: "PIN_U3300_1",
      refDes: "U3300",
      pinNumber: "1",
      pinName: "BATT_IN",
      pageNumber: 25,
      bounds: new BoundingBox2D(150, 150, 165, 165),
      connectionPoint: { x: 150, y: 157.5 },
      connectedNetName: "PP_BATT_VCC",
    }));
    symU3300.addPin(new SchematicPinLocation({
      id: "PIN_U3300_2",
      refDes: "U3300",
      pinNumber: "2",
      pinName: "SYS_OUT",
      pageNumber: 25,
      bounds: new BoundingBox2D(250, 150, 265, 165),
      connectionPoint: { x: 265, y: 157.5 },
      connectedNetName: "PP_VDD_MAIN",
    }));
    page25.addSymbol(symU3300);
    doc.registerSymbol(symU3300);
    doc.addPage(page25);

    // --- Page 48: Baseband PMIC PMX60 / RF Subsystem ---
    const page48 = new SchematicPage({ pageNumber: 48, width: 1000, height: 800 });
    const symUBB = new SchematicSymbol({
      id: "SYM_U_BB_PMU",
      refDes: "U_BB_PMU",
      pageNumber: 48,
      bounds: new BoundingBox2D(100, 100, 300, 300),
    });
    symUBB.addPin(new SchematicPinLocation({
      id: "PIN_U_BB_C4",
      refDes: "U_BB_PMU",
      pinNumber: "C4",
      pinName: "RF_VDD_IN",
      pageNumber: 48,
      bounds: new BoundingBox2D(150, 150, 165, 165),
      connectionPoint: { x: 150, y: 157.5 },
      connectedNetName: "PP_VDD_MAIN",
    }));
    symUBB.addPin(new SchematicPinLocation({
      id: "PIN_U_BB_A1",
      refDes: "U_BB_PMU",
      pinNumber: "A1",
      pinName: "BOOST_IN",
      pageNumber: 48,
      bounds: new BoundingBox2D(150, 180, 165, 195),
      connectionPoint: { x: 150, y: 187.5 },
      connectedNetName: "PP_VDD_BOOST",
    }));
    page48.addSymbol(symUBB);
    doc.registerSymbol(symUBB);
    doc.addPage(page48);

    // --- Page 84: Interposer & Signal Routing ---
    const page84 = new SchematicPage({ pageNumber: 84, width: 1000, height: 800 });
    doc.addPage(page84);

    // --- BoardView SubBoards & Topologies ---
    const topBoard = new SubBoardEntity({
      id: "SUB_IPHONE13_TOP_LOGIC",
      label: "iPhone 13 Top Logic Board",
      role: SubBoardRole.TOP_LOGIC,
      layerCount: 10,
    });

    const botBoard = new SubBoardEntity({
      id: "SUB_IPHONE13_BOT_RF",
      label: "iPhone 13 Bottom RF Board",
      role: SubBoardRole.BOTTOM_RF,
      layerCount: 10,
    });

    // Add pads
    topBoard.addPad(new PadEntity({
      id: "PAD_TOP_U2700_A12",
      padNumber: "A12",
      subBoardId: "SUB_IPHONE13_TOP_LOGIC",
      componentId: "U2700",
      coordinate: new LayerCoordinate(50.0, 50.0, LayerSide.TOP_SIDE),
      netName: "PP_VDD_MAIN",
    }));

    topBoard.addPad(new PadEntity({
      id: "PAD_TOP_U2700_C1",
      padNumber: "C1",
      subBoardId: "SUB_IPHONE13_TOP_LOGIC",
      componentId: "U2700",
      coordinate: new LayerCoordinate(52.0, 50.0, LayerSide.TOP_SIDE),
      netName: "PP_VDD_CPU_CORE",
    }));

    topBoard.addPad(new PadEntity({
      id: "PAD_TOP_U2700_E5",
      padNumber: "E5",
      subBoardId: "SUB_IPHONE13_TOP_LOGIC",
      componentId: "U2700",
      coordinate: new LayerCoordinate(54.0, 50.0, LayerSide.TOP_SIDE),
      netName: "PP1V8_S2",
    }));

    topBoard.addPad(new PadEntity({
      id: "PAD_TOP_U2700_F2",
      padNumber: "F2",
      subBoardId: "SUB_IPHONE13_TOP_LOGIC",
      componentId: "U2700",
      coordinate: new LayerCoordinate(56.0, 50.0, LayerSide.TOP_SIDE),
      netName: "BUTTON_TO_PMU_ONOFF_L",
    }));

    topBoard.addPad(new PadEntity({
      id: "PAD_TOP_U3300_1",
      padNumber: "1",
      subBoardId: "SUB_IPHONE13_TOP_LOGIC",
      componentId: "U3300",
      coordinate: new LayerCoordinate(70.0, 80.0, LayerSide.TOP_SIDE),
      netName: "PP_BATT_VCC",
    }));

    botBoard.addPad(new PadEntity({
      id: "PAD_BOT_UBB_C4",
      padNumber: "C4",
      subBoardId: "SUB_IPHONE13_BOT_RF",
      componentId: "U_BB_PMU",
      coordinate: new LayerCoordinate(60.0, 60.0, LayerSide.BOTTOM_SIDE),
      netName: "PP_VDD_MAIN",
    }));

    // Topologies
    const netVddMain = new NetTopology({
      id: "NET_PP_VDD_MAIN",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
    });
    netVddMain.addPinBinding("SUB_IPHONE13_TOP_LOGIC", "PAD_TOP_U2700_A12", "U2700.A12");
    netVddMain.addPinBinding("SUB_IPHONE13_BOT_RF", "PAD_BOT_UBB_C4", "U_BB_PMU.C4");
    netVddMain.addInterposerJunction(new InterposerJunction({
      junctionId: "JUNC_084",
      interposerPadId: "INT_PAD_084",
      topPadId: "PAD_TOP_U2700_A12",
      bottomPadId: "PAD_BOT_UBB_C4",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
    }));

    const netCpuCore = new NetTopology({
      id: "NET_PP_VDD_CPU_CORE",
      canonicalNetName: "PP_VDD_CPU_CORE",
      classification: NetClassification.POWER_BUCK,
    });
    netCpuCore.addPinBinding("SUB_IPHONE13_TOP_LOGIC", "PAD_TOP_U2700_C1", "U2700.C1");

    const netS2 = new NetTopology({
      id: "NET_PP1V8_S2",
      canonicalNetName: "PP1V8_S2",
      classification: NetClassification.POWER_MAIN,
    });
    netS2.addPinBinding("SUB_IPHONE13_TOP_LOGIC", "PAD_TOP_U2700_E5", "U2700.E5");

    const netButton = new NetTopology({
      id: "NET_BUTTON_TO_PMU_ONOFF_L",
      canonicalNetName: "BUTTON_TO_PMU_ONOFF_L",
      classification: NetClassification.POWER_MAIN,
    });
    netButton.addPinBinding("SUB_IPHONE13_TOP_LOGIC", "PAD_TOP_U2700_F2", "U2700.F2");

    const netBatt = new NetTopology({
      id: "NET_PP_BATT_VCC",
      canonicalNetName: "PP_BATT_VCC",
      classification: NetClassification.POWER_MAIN,
    });
    netBatt.addPinBinding("SUB_IPHONE13_TOP_LOGIC", "PAD_TOP_U3300_1", "U3300.1");

    return {
      document: doc,
      topologies: [netVddMain, netCpuCore, netS2, netButton, netBatt],
      subBoards: [topBoard, botBoard],
    };
  }
}
