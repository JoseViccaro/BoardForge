# OpenSpec Requirement Specification: `iam` (Identity & Access Management)

**Change ID:** `http-api-endpoints`  
**Domain:** `identity-access`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY) / OWASP ASVS Level 2  
**Target Entities:** `User`, `Tenant`, `Session`, `Role`, `Permission`, `TokenPair`  

---

## 1. Domain Overview

The `identity-access` domain manages user identity, credential verification, multi-tenant organization scoping, role-based access control (RBAC), and cryptographic session lifecycle. It acts as the gatekeeper for all BoardForge API operations, enforcing tenant isolation to prevent Insecure Direct Object References (IDOR) and unauthorized privilege escalation.

---

## 2. Formal Requirements

### Requirement 2.1: Password Hashing & Credential Security
* The system MUST hash all user passwords using the **Argon2id** algorithm with standard memory-hard parameters ($\ge 64\,\text{MB}$ memory, $\ge 3$ iterations, parallelism factor of 1).
* Plaintext passwords MUST NEVER be stored, logged, or serialized in API responses.
* The system MUST enforce a minimum password length of 12 characters, requiring uppercase, lowercase, numbers, and special symbols.

### Requirement 2.2: Dual-Token Session Architecture & Rotation
* The authentication service MUST issue a `TokenPair` upon successful login:
  1. An `AccessToken`: Short-lived ($\le 15$ minutes) signed JWT containing `sub` (user ID), `org_id` (organization ID), `role`, and `jti` (token ID).
  2. A `RefreshToken`: Cryptographically secure opaque random string (256-bit entropy) with a time-to-live of 7 days, stored hashed in the session store.
* The `AccessToken` and `RefreshToken` MUST be transmitted via `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
* When a `RefreshToken` is exchanged for a new `TokenPair`, the existing token MUST be consumed and rotated. If a previously consumed `RefreshToken` is presented again (replay attack), the system MUST immediately invalidate all active sessions for that user.

### Requirement 2.3: Multi-Tenancy & Tenant Scoping
* Every non-system request MUST execute within a resolved `TenantContext` containing an immutable `organization_id`.
* All read and write operations on multi-tenant entities (e.g., boards, measurements, custom schematics) MUST be scoped to the authenticated user's `organization_id`.
* The system MUST reject any access attempt to resources belonging to another organization with an HTTP 404 Not Found or HTTP 403 Forbidden to prevent resource enumeration.

### Requirement 2.4: Role-Based Access Control (RBAC)
* The system MUST enforce four hierarchical roles:
  * `Admin`: Full control over organization settings, member management, and all board data.
  * `LeadTech`: Board ingestion, reference measurement approval, device management, and diagnostic execution.
  * `Tech`: Read catalog/boardview/schematics, submit live diagnostic measurements, run PMU boot simulation.
  * `Viewer`: Read-only access to published board data and approved reference measurements.
* Any route handler protected by `requireRole(requiredRoles)` MUST verify that the caller's role is in the allowed set.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Successful Authentication & Cookie Issuance
```gherkin
Given a registered user "tech@boardforge.io" with password "SuperSecure#2026" in organization "ORG_APPLE_REPAIR"
When the user submits a POST request to "/api/v1/auth/login" with valid credentials
Then the response status code MUST be 200 OK
And the response MUST include a "Set-Cookie" header for "bf_access_token" with HttpOnly, Secure, and SameSite=Strict
And the response MUST include a "Set-Cookie" header for "bf_refresh_token" with HttpOnly, Secure, and SameSite=Strict
And the response body MUST contain user profile metadata excluding password hashes.
```

### Scenario 3.2: Replay Attack Detection & Session Invalidation
```gherkin
Given an active session with RefreshToken "RT_INITIAL"
When the technician refreshes tokens using "RT_INITIAL"
Then the system issues new TokenPair with "RT_ROTATED" and invalidates "RT_INITIAL"
When an attacker attempts to use the revoked "RT_INITIAL"
Then the system MUST reject the request with HTTP 401 Unauthorized
And the system MUST revoke "RT_ROTATED" and all other active sessions for that user account.
```

### Scenario 3.3: Tenant Boundary Isolation (Anti-IDOR)
```gherkin
Given Technician "TechA" belonging to Organization "ORG_REPAIR_A"
And BoardRecord "BRD_001" belonging to Organization "ORG_REPAIR_B"
When "TechA" attempts to fetch "/api/v1/boardview/BRD_001" with a valid AccessToken
Then the system MUST respond with HTTP 404 Not Found
And no board layout data from "ORG_REPAIR_B" SHALL be disclosed.
```

### Scenario 3.4: RBAC Role Verification
```gherkin
Given a user with role "Viewer"
When the user sends a POST request to "/api/v1/boardview/upload" with a BoardView file
Then the system MUST reject the request with HTTP 403 Forbidden
And the response body MUST follow the RFC 7807 Problem Details specification with type "https://boardforge.io/errors/forbidden".
```
