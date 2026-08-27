# Change Proposal: `http-api-endpoints`

**Status:** Proposed / Exploration Complete  
**Change ID:** `http-api-endpoints`  
**Target Subsystems:** `interfaces/http`, `identity-access`, `catalog`, `boardview`, `schematics`, `measurements`  
**Security Standard:** OWASP ASVS Level 2 / RFC 7807 Problem Details / GDPR  

---

## 1. Executive Summary & Intent

BoardForge implements a Modular Monolith architecture governed by Clean Architecture and Domain-Driven Design (DDD). While the domain aggregates, application services, parsers, and repositories for `catalog`, `boardview`, `schematics`, and `measurements` provide rich microelectronics diagnostic capabilities, a secure, robust, and strongly-typed HTTP REST presentation layer is required to safely expose these capabilities to frontend clients (WebGL BoardViewer, PDF Canvas, Measurement Logging, and Administration UI) and external integrations.

The `http-api-endpoints` change establishes the production HTTP interfaces and controller layer built with **Fastify**, implementing defense-in-depth security matching **OWASP ASVS Level 2**:
1. **IAM & Multi-Tenancy Engine:** Stateless short-lived JWT Access Tokens (<= 15 min) in `HttpOnly`, `Secure`, `SameSite=Strict` cookies, cryptographically paired with opaque rotating Refresh Tokens (Argon2id password hashing, session replay revocation, tenant `organization_id` scoping, and RBAC roles: `Admin`, `LeadTech`, `Tech`, `Viewer`).
2. **Strict Zod Input Validation & Schema Serialization:** Comprehensive request validation (body, query, params, headers) discarding non-whitelisted properties, protecting against Prototype Pollution and injection vectors.
3. **OWASP ASVS L2 Security Hardening:** Automated HTTP security headers (CSP, CORS, X-Content-Type-Options: nosniff, Referrer-Policy, Strict-Transport-Security), per-route sliding window rate limiting, and centralized RFC 7807 Problem Details error formatting.
4. **Secure Multipart File Upload Pipeline:** Streaming file ingestion for BoardView files (`.brd`, `.fz`, `.cad`, `.bdv`, `.bvr`) and Schematics (`.pdf`), verifying magic bytes / MIME signatures before persisting to storage adapters.
5. **Clean Architecture Presentation Layer:** Zero business logic in controllers; clean bi-directional mapping between HTTP DTOs and Application Commands/Queries with strict dependency inversion.

---

## 2. Scope & Target Capabilities

### 2.1. IAM & Multi-Tenancy Subsystem (`/api/v1/auth`, `/api/v1/tenants`, `/api/v1/users`)
* User registration, login with Argon2id password verification, logout (token revocation), and token refresh with rotation.
* Multi-tenant context extraction from JWT claims and session store into `RequestContext` (`organization_id`, `user_id`, `roles`, `permissions`).
* Declarative RBAC authorization pre-handlers (`requireAuth()`, `requireRole(['Admin', 'LeadTech'])`, `requirePermission('board:write')`).

### 2.2. Hardware Catalog Endpoints (`/api/v1/catalog`)
* CRUD for `DeviceModel`, `CompositeBoardAggregate`, and `SubBoardEntity`.
* Read-only public/tenant catalog exploration with structured filtering and pagination.

### 2.3. BoardView Ingestion & Rendering Endpoints (`/api/v1/boardview`)
* Secure multipart upload endpoint (`/api/v1/boardview/upload`) supporting magic byte verification and asynchronous parsing.
* Query endpoints for board outlines, component placements, pins, and net topologies optimized for WebGL streaming.

### 2.4. Schematics Cross-Probing Endpoints (`/api/v1/schematics`)
* PDF schematic upload and text/symbol index generation.
* Cross-probe search endpoint (`/api/v1/schematics/search?query=PP_VDD_MAIN`) returning PDF bounding boxes, sheet indices, and associated net/pin metadata.

### 2.5. Diode Mode Measurements Endpoints (`/api/v1/measurements`)
* Reference diode reading queries across multi-board physical states (`SPLIT_TOP`, `SPLIT_BOTTOM`, `JOINED_SANDWICH`, `SOCKET_FIXTURE`).
* Live diagnostic log submission (`POST /api/v1/measurements/records`) evaluating technician multimeter readings against nominal tolerances (Pass, Warning, Fail, Short, Open).

### 2.6. PMU Boot Simulation Endpoints (`/api/v1/pmu`)
* Power sequence simulation query (`/api/v1/pmu/sequence?board_id=...&trigger=VBUS`) returning the deterministic rail power-up step ladder (S5 -> S4 -> S3 -> S0).

---

## 3. Architectural Approach & Trade-Offs

### 3.1. Framework Choice: Fastify
* **Decision:** Fastify v5 with `@fastify/cookie`, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/multipart`.
* **Rationale:** Extremely high throughput, native schema compilation (via Zod / fast-json-stringify), modular plugin architecture perfectly mirroring clean architectural boundary separation, and zero-network overhead test harness (`fastify.inject()`).

### 3.2. Authentication Token Storage: HttpOnly Cookies vs Authorization Bearer Header
* **Decision:** Dual support with HttpOnly `Secure` Cookies as primary for Web UI clients and optional `Authorization: Bearer <token>` for programmatic API clients / CLI.
* **Rationale:** Mitigates XSS token extraction risks on browsers while maintaining developer ergonomics for headless testing and CLI integrations.

---

## 4. Verification & Testing Strategy

* **Strict TDD Methodology:** 100% test coverage for all controllers, middlewares, validators, and serialization logic using Vitest and Fastify's native `inject()` / light-my-request harness.
* **Security Test Suite:** Dedicated test suite validating:
  * IDOR prevention across organization boundaries.
  * Privilege escalation rejection for unauthorized roles.
  * Rejection of oversized payloads and non-whitelisted properties.
  * Rejection of disguised malicious files (e.g., EXE renamed to `.brd`).
  * Rate-limiting enforcement upon burst traffic.
  * Proper RFC 7807 Problem Details serialization for all 4xx/5xx responses.
