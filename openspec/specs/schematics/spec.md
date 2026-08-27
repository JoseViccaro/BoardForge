# OpenSpec Requirement Specification: `schematics`

**Change ID:** `iphone13-board-core`  
**Domain:** `schematics`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Entities:** `PowerTree`, `PowerRailNode`, `PMICSequenceMachine`, `PowerSequenceState`, `PowerRailType`

---

## 1. Domain Overview

The `schematics` domain models power trees, rail dependencies, voltage regulators (Buck, LDO, Boost, Charge Pump), and the PMU cold-boot state sequence machine for the Apple iPhone 13 (A15 Bionic / PMU subsystem).

---

## 2. Formal Requirements

### Requirement 2.1: Hierarchical Power Tree Structure
* The power tree MUST model parent-to-child rail topologies with explicit source regulator components:
  1. Primary Ingestion: `PP_BATT_VCC` $\rightarrow$ Charger IC (Tigris/Hydra/Islander) $\rightarrow$ `PP_VDD_MAIN` (nominal 3.8V – 4.4V).
  2. Boost Regulator: `PP_VDD_MAIN` $\rightarrow$ Boost IC $\rightarrow$ `PP_VDD_BOOST` (nominal 5.0V).
  3. Always-On / Standby: `PP_VDD_MAIN` $\rightarrow$ Main PMIC LDO $\rightarrow$ `PP1V8_S2` (nominal 1.8V).
  4. Core Buck Domains: `PP_VDD_MAIN` $\rightarrow$ PMU Bucks $\rightarrow$ `PP_VDD_CPU_CORE`, `PP_VDD_GPU`, `PP_VDD_SOC`, `PP0V85_LPDDR5`.
  5. RF Domain: `PP_VDD_MAIN` $\rightarrow$ Interposer $\rightarrow$ `PP_VDD_RF_MAIN` $\rightarrow$ Baseband PMU (PMX60).
* Each `PowerRailNode` MUST define `nominal_voltage`, `voltage_min`, `voltage_max`, `rail_type` (`PRIMARY_BUS`, `BOOST`, `ALWAYS_ON_S2`, `CORE_BUCK`, `LDO_SWITCHED`), and `parent_rail_id`.

### Requirement 2.2: PMU Cold-Boot Power Sequence State Machine
* The system MUST model the 5 discrete power-up sequence states:
  * `S5_OFF`: Battery connected, only `PP_BATT_VCC` is present.
  * `S4_STANDBY`: Charger IC generates `PP_VDD_MAIN`, PMU standby circuits active, `PP1V8_S2` is stable.
  * `S3_TRIGGER`: Power button pressed (`BUTTON_TO_PMU_ONOFF_L` pulled low) or VBUS attached; PMU initiates buck turn-on cascade.
  * `S2_SLEEP`: SoC enters low-power sleep; high-current core rails powered down, `S2` always-on rails remain live.
  * `S0_FULL_EXECUTION`: All rails (CPU, GPU, DRAM, NAND, Display, RF) fully powered and stable.
* The state machine MUST validate transitions:
  * Legal forward sequence: `S5_OFF` $\rightarrow$ `S4_STANDBY` $\rightarrow$ `S3_TRIGGER` $\rightarrow$ `S0_FULL_EXECUTION`.
  * Sleep transitions: `S0_FULL_EXECUTION` $\leftrightarrow$ `S2_SLEEP`.
  * Fault / Power-cut transitions: Any state $\rightarrow$ `S5_OFF`.
* Illegal transitions (such as jumping directly from `S5_OFF` to `S0_FULL_EXECUTION` without `S4_STANDBY`) MUST be rejected with a domain state transition exception.

### Requirement 2.3: Rail Dependency Validation
* An active rail in state $S_n$ MUST NOT be valid if its parent rail in the `PowerTree` is absent or unpowered.
* For example, enabling `PP_VDD_BOOST` or `PP_VDD_CPU_CORE` MUST require `PP_VDD_MAIN` to be in `POWER_OK` state.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Power Sequence Forward Progression
```gherkin
Given a PMICSequenceMachine initialized in state "S5_OFF"
When the battery is connected and PP_VDD_MAIN achieves stable 4.0 V
Then the machine transitions to state "S4_STANDBY"
And rail "PP1V8_S2" is marked active (1.8 V).
When a power button trigger event is received
Then the machine transitions to state "S3_TRIGGER"
And upon buck rail stabilization, transitions to "S0_FULL_EXECUTION"
And rails ["PP_VDD_CPU_CORE", "PP_VDD_GPU", "PP0V85_LPDDR5"] are active.
```

### Scenario 3.2: Rejection of Illegal State Transition
```gherkin
Given a PMICSequenceMachine in state "S5_OFF"
When an instruction requests an immediate jump to "S0_FULL_EXECUTION" without PP_VDD_MAIN
Then the state machine MUST throw an "IllegalStateTransitionException"
And the state MUST remain "S5_OFF".
```

### Scenario 3.3: Power Tree Missing Parent Fault
```gherkin
Given a power tree where "PP_VDD_BOOST" depends on "PP_VDD_MAIN"
When "PP_VDD_MAIN" is in FAULT state (0.0 V)
And a diagnostic query evaluates the expected state of "PP_VDD_BOOST"
Then the diagnostic engine asserts that "PP_VDD_BOOST" MUST be 0.0 V
And flags the root cause as "Parent rail PP_VDD_MAIN inactive".
```
