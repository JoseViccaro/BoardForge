# Delta for Measurements

## ADDED Requirements

### Requirement: Full Diode-Mode Entry Form

The workbench MUST provide a diode-mode measurement capture entry form that captures: reading value, meter profile (model, mode, range), and board state.

The form MUST bind each captured reading to a specific net/pin selected in the workbench.

#### Scenario: Complete capture bound to net

- GIVEN a net/pin `INT_PAD_084` selected in the workbench
- WHEN a technician submits a reading via the diode-mode form using meter `SUNSHINE_DT17N` in `DIODE` mode on board state `SPLIT_TOP`
- THEN the reading is recorded against net `PP_VDD_MAIN` / pin `INT_PAD_084`
- AND the meter profile and board state are stored with the reading

#### Scenario: Missing required field blocks submit

- GIVEN the diode-mode form open
- WHEN reading value is present but board state is unset
- THEN the form MUST NOT submit
- AND it shows a validation error for board state

### Requirement: Inline Validation Against Reference

The system MUST validate the captured reading against the matching `MeasurementReference` and log the resulting evaluation outcome (`PASS`, `WARNING_DEVIATION`, `CRITICAL_LOW_OR_SHORT`, `OPEN_LINE_OL`).

#### Scenario: Valid reading logs PASS

- GIVEN reference on `INT_PAD_084` nominal 0.425V [0.395–0.455] with meter baseline Fluke 115
- WHEN a technician records 0.418V with a Fluke 115 on `SPLIT_TOP`
- THEN the outcome logs `PASS`
- AND the reading is appended to the measurement log for that net

#### Scenario: Meter normalization applied

- GIVEN meter `SUNSHINE_DT17N` offset +0.035V
- WHEN a technician records 0.380V
- THEN the normalized reading 0.415V is evaluated against the baseline reference

### Requirement: Measurement History with Trends

The system MUST maintain a measurement history per net/pin and render trend information across readings over time.

#### Scenario: Trend over repeated reads

- GIVEN three readings recorded for `INT_PAD_084` at different timestamps
- WHEN the measurement log for that pin is viewed
- THEN the history lists all three readings chronologically
- AND a trend indicator shows the deviation direction across them

### Requirement: Export Capability

The system MUST export the measurement history (readings, meter profiles, board states, outcomes) to a portable document (CSV or JSON).

#### Scenario: Export complete history

- GIVEN a measurement history with readings and outcomes
- WHEN a technician requests export
- THEN the system produces a file containing all readings, meters, board states, and outcomes

## Technical Constraints

- Entry values MUST validate against measurement-domain rules without duplicating domain logic.
- All captured input SHALL be sanitized per OWASP ASVS L2 before persistence or export.

## Dependencies

- `workbench` spec (net/pin binding selection)
- `session` spec (persistence of measurement sessions)
- Existing `MeasurementReference`, `MultimeterProfile`, `DiagnosticBoardState`, `DiodeModeEvaluator`
