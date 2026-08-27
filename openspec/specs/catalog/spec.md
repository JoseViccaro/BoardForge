# OpenSpec Requirement Specification: `catalog`

**Change ID:** `iphone13-board-core`  
**Domain:** `catalog`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Entities:** `DeviceModel`, `CompositeBoardAggregate`, `SubBoardEntity`, `BoardStackType`

---

## 1. Domain Overview

The `catalog` domain models hardware devices, physical board architectures, and component hierarchies. For multi-layer sandwich designs such as Apple iPhone 13 (Logic Board 820-02106 / D63), the catalog MUST support composite multi-board aggregates consisting of top logic, bottom RF, and interposer solder frames.

---

## 2. Formal Requirements

### Requirement 2.1: Composite Board Modeling
* The system MUST model multi-layer PCB hardware assemblies using a `CompositeBoardAggregate` root entity.
* A `CompositeBoardAggregate` MUST contain two or more `SubBoardEntity` instances when `board_stack_type` is `SANDWICH_INTERPOSER`.
* Each `SubBoardEntity` MUST define an immutable `sub_board_id`, a human-readable `label`, a `role` (`TOP_LOGIC`, `BOTTOM_RF`, `INTERPOSER_FRAME`, or `DAUGHTER_BOARD`), and an explicit `layer_count`.
* The `CompositeBoardAggregate` MUST maintain an explicit list of child sub-board references.

### Requirement 2.2: Device Model Association
* A `DeviceModel` representing the Apple iPhone 13 (Part numbers: A2482, A2631, A2633, A2634, A2635) MUST be associated with logic board number `820-02106`.
* The `DeviceModel` MUST reference the canonical `CompositeBoardAggregate` ID.
* The system MUST reject any `CompositeBoardAggregate` creation where sub-board IDs are duplicated within the same composite aggregate.

### Requirement 2.3: Immutability & Multi-Tenancy
* Catalog baseline device and board definitions MUST be immutable and system-scoped (`tenant_id = NULL` or `SYSTEM`).
* Custom user revisions or third-party hardware variants MUST require an explicit `organization_id` and MUST NOT overwrite system catalog records.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Create iPhone 13 Composite Board Hierarchy
```gherkin
Given a catalog service configured for hardware board ingestion
When a technician registers the Apple iPhone 13 board "820-02106" with stack type "SANDWICH_INTERPOSER"
And provides sub-boards:
  | SubBoard ID              | Role             | Layers |
  | SUB_IPHONE13_TOP_LOGIC   | TOP_LOGIC        | 10     |
  | SUB_IPHONE13_INTERPOSER  | INTERPOSER_FRAME | 2      |
  | SUB_IPHONE13_BOTTOM_RF   | BOTTOM_RF        | 8      |
Then the CompositeBoardAggregate is successfully created with ID "BRD_820_02106"
And the aggregate contains exactly 3 sub-boards
And querying the composite board returns the Top, Interposer, and Bottom sub-boards in order.
```

### Scenario 3.2: Rejection of Duplicate SubBoard Identifiers
```gherkin
Given an attempt to create a CompositeBoardAggregate "BRD_INVALID_001"
When two sub-boards are registered with the identical sub_board_id "SUB_IPHONE13_TOP_LOGIC"
Then the catalog domain MUST throw a "DuplicateSubBoardIdException"
And no aggregate entity SHALL be persisted.
```

### Scenario 3.3: Link Device Model to Composite Board
```gherkin
Given a CompositeBoardAggregate "BRD_820_02106" for Apple iPhone 13
When the DeviceModel "DEV_IPHONE13" is created with marketing names ["iPhone 13", "iPhone 13 mini"] and board number "820-02106"
Then the DeviceModel.composite_board_id SHALL equal "BRD_820_02106"
And querying device "DEV_IPHONE13" provides access to the multi-board structure.
```
