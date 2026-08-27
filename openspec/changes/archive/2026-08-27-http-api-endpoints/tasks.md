# Tasks: `http-api-endpoints`

**Change ID:** `http-api-endpoints`  
**Execution Methodology:** Strict TDD (Red $\rightarrow$ Green $\rightarrow$ Refactor)  
**Security Baseline:** OWASP ASVS Level 2  

---

## Phase 1: IAM & Authentication Core

- [x] **1.1. Argon2id Password Hasher Value Object**
  - [x] Write unit test for `PasswordHash` verifying minimum work factors ($\ge 64\,\text{MB}$ memory, $\ge 3$ iterations) and verify constant-time comparison.
  - [x] Implement `PasswordHash` VO using Argon2id with salt generation.
  - [x] Verify test suite passes (`vitest run tests/modules/iam/password-hash.test.ts`).

- [x] **1.2. JWT & Refresh Token Cryptographic Manager**
  - [x] Write unit tests for `TokenManager`: issuing 15-minute access token JWT with `sub`, `org_id`, `role`, generating 256-bit opaque refresh tokens, verifying signatures, and rejecting expired/tampered tokens.
  - [x] Implement `TokenManager` service using `jsonwebtoken` / `jose`.
  - [x] Write unit test for Refresh Token replay detection (revoking all sessions when a used token is resubmitted).
  - [x] Implement session store repository and replay detection logic.

- [x] **1.3. TenantContext & RBAC Policy Engine**
  - [x] Write unit tests for `TenantContext` validating role permissions matrix (`Admin` > `LeadTech` > `Tech` > `Viewer`).
  - [x] Implement `TenantContext` VO and `RbacPolicyEngine.isAuthorized(role, requiredRoleOrPermission)`.

---

## Phase 2: HTTP Gateway Infrastructure & Security Plugins

- [x] **2.1. Fastify Application Factory & Security Headers Plugin**
  - [x] Write test for `@fastify/helmet` plugin configuration checking response headers: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`.
  - [x] Implement `createFastifyApp()` and register `securityHeadersPlugin`.
  - [x] Write test for CORS plugin validating allow-listed origins and rejection of unauthorized origins.
  - [x] Implement `corsPlugin`.

- [x] **2.2. Rate Limiting Plugin**
  - [x] Write test injecting 6 requests to `/api/v1/auth/login` within 10 seconds, expecting HTTP 429 and `Retry-After` header.
  - [x] Write test for standard endpoints allowing up to 120 requests/min.
  - [x] Implement `rateLimitPlugin` configuring tiered route limits.

- [x] **2.3. RFC 7807 Problem Details Centralized Error Handler**
  - [x] Write test triggering 400 (Zod validation), 401 (Unauthorized), 403 (Forbidden), 404 (NotFound), 415 (UnsupportedMediaType), and 500 (InternalError).
  - [x] Verify each response matches RFC 7807 Problem Details schema (`type`, `title`, `status`, `detail`, `instance`, `invalidParams`).
  - [x] Implement `errorHandlerPlugin` with production stack-trace masking.

---

## Phase 3: Multipart File Ingestion & Magic Bytes Validator

- [x] **3.1. Magic Bytes MIME Inspector**
  - [x] Write unit test for `MagicBytesValidator` detecting `%PDF-` signature (`0x25 0x50 0x44 0x46 0x2D`) for PDF files.
  - [x] Write unit test detecting BoardView signatures (`[format]`, `BRD`, XML/JSON structures) and rejecting `.exe` / shell script payloads.
  - [x] Implement `MagicBytesValidator.inspectStream(stream)` and `MagicBytesValidator.inspectBuffer(buffer)`.

- [x] **3.2. Fastify Multipart Handler & Stream Limiter**
  - [x] Write integration test uploading valid PDF and BRD streams with size under quota.
  - [x] Write integration test uploading oversized file (>100MB PDF or >50MB BRD) asserting HTTP 413 Payload Too Large.
  - [x] Implement multipart ingestion pre-handler and disk/memory spooler.

---

## Phase 4: REST Controllers & DTO Mappings

- [x] **4.1. Auth & IAM Controller (`/api/v1/auth`)**
  - [x] Write integration tests via `app.inject()` for `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
  - [x] Assert `Set-Cookie` headers have `HttpOnly; Secure; SameSite=Strict`.
  - [x] Implement `AuthController`, Zod schemas in `auth.dto.ts`, and map to `IdentityAccessFacade`.

- [x] **4.2. Hardware Catalog Controller (`/api/v1/catalog`)**
  - [x] Write integration tests for `GET /api/v1/catalog/devices`, `GET /api/v1/catalog/devices/:id`, `POST /api/v1/catalog/devices`, `GET /api/v1/catalog/boards/:id`.
  - [x] Implement `CatalogController`, Zod query/body validators, and DTO serializers connecting to `CatalogFacade`.

- [x] **4.3. BoardView Controller (`/api/v1/boardview`)**
  - [x] Write integration tests for `POST /api/v1/boardview/upload`, `GET /api/v1/boardview/:board_id`, `GET /api/v1/boardview/:board_id/nets`, `GET /api/v1/boardview/:board_id/nets/:net_name`.
  - [x] Implement `BoardViewController`, DTO mappings for components/pins/nets, and connect to `BoardViewFacade`.

- [x] **4.4. Schematics Cross-Probing Controller (`/api/v1/schematics`)**
  - [x] Write integration tests for `POST /api/v1/schematics/upload`, `GET /api/v1/schematics/:schematic_id/search?query=...`, `GET /api/v1/schematics/:schematic_id/pages/:page_number`.
  - [x] Implement `SchematicsController` and connect to `SchematicsFacade`.

- [x] **4.5. Diode Mode Measurements Controller (`/api/v1/measurements`)**
  - [x] Write integration tests for `GET /api/v1/measurements/references`, `POST /api/v1/measurements/references`, `POST /api/v1/measurements/records`.
  - [x] Test immediate evaluation response (`status: PASS | WARNING | FAIL | SHORT | OPEN`).
  - [x] Implement `MeasurementsController` and connect to `MeasurementsFacade`.

- [x] **4.6. PMU Power Sequence Controller (`/api/v1/pmu`)**
  - [x] Write integration tests for `GET /api/v1/pmu/sequence?board_id=...&trigger=VBUS`.
  - [x] Implement `PmuSimulationController` and connect to `PmuSimulationFacade`.

---

## Phase 5: Security & Multi-Tenant Integration Test Suite

- [x] **5.1. Tenant Isolation & IDOR Verification Suite**
  - [x] Test cross-tenant data access: Authenticated User in `ORG_A` querying board/measurement created by `ORG_B` receives 404/403.
  - [x] Verify SQL/DB repository query filters always enforce `organization_id`.

- [x] **5.2. RBAC Privilege Escalation Suite**
  - [x] Test `Viewer` attempting `POST /api/v1/boardview/upload` $\rightarrow$ 403 Forbidden.
  - [x] Test `Tech` attempting `POST /api/v1/catalog/devices` $\rightarrow$ 403 Forbidden.
  - [x] Test `LeadTech` and `Admin` allowed for ingestion routes $\rightarrow$ 201 Created.

- [x] **5.3. Prototype Pollution & Malicious Payload Suite**
  - [x] Test injection of `__proto__`, `constructor`, `prototype` in request bodies. Assert Zod rejects without polluting prototype chain.
