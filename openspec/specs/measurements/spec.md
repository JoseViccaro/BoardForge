# OpenSpec Requirement Specification: `measurements`

**Change ID:** `iphone13-board-core`  
**Domain:** `measurements`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Entities:** `MeasurementReference`, `DiagnosticBoardState`, `MultimeterProfile`, `DiodeModeValidator`, `MeasurementTolerance`

---

## 1. Domain Overview

The `measurements` domain establishes the multi-state Diode Mode (Forward Voltage $V_f$) and Resistance reference system for microelectronics diagnostics, accounting for sandwich board delamination states and multimeter calibration baselines.

---

## 2. Formal Requirements

### Requirement 2.1: Multi-State Diagnostic State Support
* The system MUST support explicit diagnostic board states:
  * `SPLIT_TOP`: Top AP logic board measured in isolation on heating station/jig.
  * `SPLIT_BOTTOM`: Bottom RF board measured in isolation.
  * `JOINED_SANDWICH`: Fully assembled or resoldered sandwich logic board.
  * `SOCKET_FIXTURE`: Top + Bottom boards inserted into a non-soldered spring-pin test socket (iSocket).
* Each test point, pad, or interposer pin MAY contain distinct reference values for each `DiagnosticBoardState`.

### Requirement 2.2: Tolerance Validation & Anomaly Detection
* Every `MeasurementReference` MUST define:
  * `nominal_value` (e.g., in Volts for Diode Mode, Ohms for Resistance),
  * `min_value` and `max_value`, OR a percentage `tolerance_pct` (default: 7.0%).
* The `DiodeModeValidator` MUST evaluate a technician's input measurement against the reference and categorize the outcome into one of:
  * `PASS`: Within $[V_{\min}, V_{\max}]$ (or within tolerance).
  * `WARNING_DEVIATION`: Within $1.0\times$ and $1.5\times$ of tolerance threshold.
  * `CRITICAL_LOW_OR_SHORT`: $V_f < 0.050\text{ V}$ or $\ge 50\%$ below nominal (indicates short to ground or degraded silicon PN junction).
  * `OPEN_LINE_OL`: Measured $V_f \ge 2.500\text{ V}$ or marked as `OL` (Open Loop) when nominal is finite (indicates broken trace, cracked solder ball, or missing pull-up).

### Requirement 2.3: Multimeter Baseline Normalization
* Reference diode measurements SHALL define a `meter_baseline` (default: `FLUKE_115_STANDARD`).
* When a technician records readings using a registered `MultimeterProfile` (e.g., `SUNSHINE_DT17N`, `UNI_T_UT61E`, `ANENG_Q1`), the system MUST apply calibrated normalization offsets:
  $$V_{f,\text{normalized}} = V_{f,\text{measured}} \times \text{scale\_factor} + \text{offset\_volts}$$
* Normalized readings MUST be compared against the baseline reference values.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Normal Diode Mode Reading Validation
```gherkin
Given a measurement reference on Pad "INT_PAD_084" (PP_VDD_MAIN) for state "SPLIT_TOP":
  | Nominal Vf | Min Vf | Max Vf | Meter Baseline      |
  | 0.425 V    | 0.395 V| 0.455 V| FLUKE_115_STANDARD  |
When a technician enters a reading of 0.418 V for "SPLIT_TOP" using a Fluke 115
Then the DiodeModeValidator outcome MUST be "PASS"
And deviation percentage is calculated as approximately -1.65%.
```

### Scenario 3.2: Short Circuit Detection
```gherkin
Given a measurement reference on Pad "INT_PAD_084" with nominal 0.425 V
When a technician records 0.012 V on this pad
Then the DiodeModeValidator outcome MUST be "CRITICAL_LOW_OR_SHORT"
And an alert "Possible short circuit to ground on PP_VDD_MAIN" is generated.
```

### Scenario 3.3: Open Line (OL) Detection on Split Top Pad
```gherkin
Given a reference on Pad "INT_PAD_042" (I2C0_SDA) with nominal 0.480 V in state "SPLIT_TOP"
When the technician records "OL" (or 2.999 V)
Then the DiodeModeValidator outcome MUST be "OPEN_LINE_OL"
And the system flags possible unseated pull-up resistor or open interposer trace.
```

### Scenario 3.4: Multimeter Calibration Normalization
```gherkin
Given a multimeter profile "SUNSHINE_DT17N" with offset +0.035 V relative to Fluke baseline
And a baseline reference nominal of 0.425 V [0.395 V - 0.455 V]
When a reading of 0.380 V is recorded with "SUNSHINE_DT17N"
Then the normalized reading is computed as 0.380 + 0.035 = 0.415 V
And the evaluation outcome SHALL be "PASS".
```
