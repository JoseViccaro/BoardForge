import { describe, it, expect } from "vitest";
import { NetTopology } from "../../../../src/domain/boardview/aggregates/NetTopology.js";
import { InterposerJunction } from "../../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";

describe("NetTopology (boardview suite)", () => {
  it("should index lookups for fast O(1) junction access", () => {
    const topology = new NetTopology({
      id: "NET_I2C0_SDA",
      canonicalNetName: "I2C0_SDA",
      classification: NetClassification.SIGNAL_I2C,
    });

    const junction = new InterposerJunction({
      junctionId: "JUNC_042",
      interposerPadId: "INT_PAD_042",
      topPadId: "TOP_PAD_42",
      bottomPadId: "BOT_PAD_42",
      canonicalNetName: "I2C0_SDA",
      classification: NetClassification.SIGNAL_I2C,
    });

    topology.addInterposerJunction(junction);
    topology.addPinBinding("SUB_TOP", "TOP_PAD_42", "U0100.E10");
    topology.addPinBinding("SUB_BOT", "BOT_PAD_42", "U_BB.A5");

    expect(topology.getJunctionForPad("TOP_PAD_42")).toBe(junction);
    expect(topology.getJunctionForPad("INT_PAD_042")).toBe(junction);
    expect(topology.getJunctionForPad("BOT_PAD_42")).toBe(junction);
    expect(topology.getJunctionForPad("NON_EXISTENT")).toBeUndefined();
  });
});
