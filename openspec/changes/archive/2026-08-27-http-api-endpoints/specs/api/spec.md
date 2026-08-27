# OpenSpec Requirement Specification: `api` (HTTP REST Gateway & Presentation)

**Change ID:** `http-api-endpoints`  
**Domain:** `interfaces/http`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY) / RFC 7807 (Problem Details) / OWASP ASVS Level 2  
**Target Components:** Fastify Server, Middleware Pipeline, Zod Validators, Security Plugins, Multipart Handlers, Controllers  

---

## 1. Domain Overview

The `interfaces/http` subsystem encapsulates the Fastify HTTP gateway, global security middleware, request validation pipeline, content-type parsers, and REST controllers. It maps incoming HTTP requests to Application Commands and Queries and serializes domain responses/errors while strictly isolating HTTP transport concerns from core domain business rules.

---

## 2. Formal Requirements

### Requirement 2.1: OWASP ASVS L2 Security Headers & CORS
* The Fastify server MUST configure standard security headers using `@fastify/helmet`:
  * `Content-Security-Policy`: Default `'self'`, denying inline scripts/eval.
  * `X-Content-Type-Options`: `nosniff`.
  * `X-Frame-Options`: `DENY` or `SAMEORIGIN`.
  * `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`.
  * `Referrer-Policy`: `strict-origin-when-cross-origin`.
* The server MUST configure `@fastify/cors` with an explicit origin allow-list and `credentials: true`. Wildcard origins (`*`) with credentials MUST be rejected at startup.

### Requirement 2.2: Rate Limiting & Abuse Prevention
* The HTTP gateway MUST apply rate limiting via `@fastify/rate-limit`:
  * Authentication endpoints (`/api/v1/auth/*`): Max 5 requests per 60 seconds per IP.
  * Diagnostic & write endpoints (`/api/v1/measurements/*`, `/api/v1/boardview/upload`): Max 30 requests per minute per tenant.
  * Read/query endpoints (`/api/v1/catalog/*`, `/api/v1/schematics/*`): Max 120 requests per minute per tenant.
* Exceeding the rate limit MUST return HTTP 429 Too Many Requests with standard `Retry-After` headers.

### Requirement 2.3: Strict Schema Validation & Sanitization
* All incoming endpoints MUST validate query parameters, URL path parameters, and JSON request bodies using **Zod schemas**.
* Unrecognized or undeclared properties in request payloads MUST be stripped or rejected to prevent Mass Assignment and Prototype Pollution.
* Validation failures MUST return HTTP 400 Bad Request formatted according to RFC 7807 with details on violated fields.

### Requirement 2.4: Secure Multipart File Ingestion
* File uploads (`/api/v1/boardview/upload`, `/api/v1/schematics/upload`) MUST be processed via `@fastify/multipart` with:
  * Maximum file size limit: 100 MB for schematics (PDF), 50 MB for BoardView files.
  * In-stream **Magic Bytes verification** before handing file buffers to parsers. Allowed file signatures:
    * PDF: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
    * BoardView BRD: `[format]`, `BRD`, or specific binary header signatures.
    * XML/JSON: Strict structural validation before deserialization.
* Any uploaded file failing magic byte inspection MUST be immediately aborted and rejected with HTTP 415 Unsupported Media Type.

### Requirement 2.5: Centralized RFC 7807 Problem Details Error Handling
* All unhandled or domain-level errors MUST be intercepted by a centralized Fastify error handler.
* The response payload MUST conform to RFC 7807:
  ```json
  {
    "type": "https://boardforge.io/errors/not-found",
    "title": "Resource Not Found",
    "status": 404,
    "detail": "Board with ID BRD_820_02106 was not found in this organization.",
    "instance": "/api/v1/boardview/BRD_820_02106",
    "invalidParams": []
  }
  ```
* In production mode, stack traces and internal exception messages MUST NEVER be leaked to clients for HTTP 500 Internal Server Errors.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Strict Zod Input Validation Rejection
```gherkin
Given the endpoint "POST /api/v1/measurements/records"
When a technician submits a payload containing extra unexpected properties:
  """json
  {
    "board_id": "BRD_820_02106",
    "pad_id": "INTERPOSER_PAD_001",
    "reading_mv": 420.5,
    "__proto__": { "polluted": true }
  }
  """
Then the system MUST reject the request with HTTP 400 Bad Request
And the prototype of the server object SHALL remain unpolluted
And the RFC 7807 error response SHALL highlight invalid input parameters.
```

### Scenario 3.2: Disguised File Upload Detection (Magic Bytes Failure)
```gherkin
Given a technician attempts to upload an executable binary "malware.exe" renamed to "logicboard.brd"
When the multipart stream is evaluated by the upload controller
Then the magic byte inspector detects mismatch with valid BoardView file headers
And the upload stream is aborted
And the response status code is HTTP 415 Unsupported Media Type.
```

### Scenario 3.3: Rate Limit Exceeded
```gherkin
Given the auth login endpoint "/api/v1/auth/login" with a limit of 5 requests per minute
When an IP address sends 6 consecutive POST requests within 10 seconds
Then the 6th request MUST return HTTP 429 Too Many Requests
And the response headers MUST include "Retry-After".
```

### Scenario 3.4: Cross-Probing Query Mapping to Application Facade
```gherkin
Given a search query "GET /api/v1/schematics/search?query=PP_VDD_MAIN&device_id=DEV_IPHONE13"
When the SchematicsController processes the request
Then it translates parameters into "SearchSchematicSymbolsQuery"
And invokes "SchematicsFacade.searchSymbols"
And formats the domain result into JSON DTO with bounding boxes and sheet numbers
And returns HTTP 200 OK.
```
