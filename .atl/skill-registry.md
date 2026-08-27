# BoardForge — Skill Registry (.atl/skill-registry.md)

---

## 1. Domain & Microelectronics Engineering
- **BoardView Topologies & Geometry:**
  - Parsing and canonical normalization of CAD/BRD/BDV/CAD/FZ/TVW formats.
  - Coordinate transformations, layer mapping (Top, Bottom, Inner 1..N), pad geometries, SMD footprints, BGA ball grids, vias, and test points.
  - Interactive WebGL/Canvas 2D rendering pipeline at 60 FPS with pan, zoom, mirror/flip, and high-contrast layer filtering.
- **Schematic Vector Navigation & Netlists:**
  - PDF/SVG vector extraction, optical text alignment, coordinate spatial indexing, and reference designator detection.
  - Bidirectional cross-probing linking Component ↔ Pin ↔ NET ↔ Schematic coordinate ↔ BoardView pad.
- **Electronics Diagnostic & Measurement Models:**
  - Diode mode drop voltage readings (Vf), ground impedance (Ω), live DC voltage rails, oscilloscope waveform profiles, and power sequence verification state machines (S5 → S4 → S3 → S0).
  - Tolerancing, reference ranges, and anomaly detection across device revisions.

---

## 2. Architecture & Software Engineering
- **Modular Monolith & Boundary Enforcement:**
  - Clean / Hexagonal Architecture (Domain Core ← Application Use Cases ← Infrastructure Adapters ← Interfaces).
  - Explicit module boundaries with zero direct cross-module database queries; module facades and immutable DTO communication.
  - In-process strongly-typed Domain Event Bus for decoupled asynchronous side-effects.
- **Domain-Driven Design (DDD):**
  - Ubiquitous language across hardware catalog, board topology, electrical connectivity, diagnostic workflows, and workshop management.
  - Rich domain models with immutable Value Objects, Aggregate Roots guarding invariants, and Domain Services.
- **Design Patterns & SOLID:**
  - Strategy & Factory patterns for pluggable file parsers (`BoardFileParser`, `SchematicParser`).
  - Repository & Unit of Work patterns for transactional consistency.
  - Dependency Inversion with IoC container wiring.

---

## 3. Security, Multi-Tenancy & Compliance
- **OWASP ASVS Level 2 Baseline:**
  - Strict input validation via schema-based allow-listing (fail-safe rejection).
  - Robust defenses against XSS (DOMPurify, strict CSP), CSRF (SameSite cookies + synchronization tokens), SQLi (parameterized queries only), SSRF (URL allow-lists + RFC1918 / cloud metadata blocking), and Path Traversal.
- **Identity & Session Management:**
  - Short-lived JWT access tokens + rotating opaque refresh tokens stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
  - Argon2id password hashing (memory=64MB, t=3, p=4) and TOTP RFC 6238 Multi-Factor Authentication.
- **Multi-Tenancy & Data Isolation:**
  - Tenant scoping via `organization_id` mandatory in all data access paths and repository queries to prevent IDOR.
  - Row-Level Security (RLS) enforcement at database layer.
  - Granular RBAC + ABAC authorization checks per use case.
- **Secure File Ingestion Pipeline:**
  - Magic bytes binary validation, file size quotas, ClamAV asynchronous scanning, sandboxed format parsing, private S3/Blob storage with SSE-AES256, and short-lived presigned URLs.
- **GDPR / RGPD Compliance:**
  - Data minimization, structured JSON/CSV data portability, and right-to-erasure workflows with identity decoupling for technical repair history preservation.

---

## 4. Testing & Quality Engineering (Strict TDD)
- **Strict Test-Driven Development (TDD):**
  - Red → Green → Refactor workflow mandatory for all domain rules, application use cases, parsers, and security filters.
  - Zero un-tested business logic; domain layers isolated from infrastructure mocks.
- **Testing Pyramid:**
  - Unit Tests: Pure domain entities, value objects, math/coordinate transforms, diode comparison algorithms, state machines.
  - Integration Tests: Module facades, database repositories, event dispatching, auth flows.
  - Security Verification Tests: Tenant isolation assertions, IDOR regression suites, malicious file upload fuzzing, rate limiter validation.
  - Contract & Snapshot Tests: BoardView parser canonical schema adherence and schematic coordinate alignment fixtures.

---

## 5. Specification-Driven Development (SDD) & Memory Protocol
- **OpenSpec Protocol:**
  - Formal tracking of project requirements, functional specs, ADRs, and change lifecycle (`specs/`, `changes/`, `changes/archive/`).
- **Hybrid Memory Synchronization (Engram):**
  - Proactive capture of architectural decisions, conventions, domain models, and testing policies in Engram persistent memory.
