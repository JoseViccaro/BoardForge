import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import {
  EntityNotFoundError,
  UnauthorizedError,
  ForbiddenError,
  DomainValidationError,
  UnsupportedMediaTypeError,
  InternalError,
} from "../../../src/interfaces/http/errors/HttpErrors.js";
import { z } from "zod";

describe("RFC 7807 Problem Details Centralized Error Handler", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createFastifyApp({ enableRateLimiting: false });

    // Register dummy routes triggering various errors for testing error serialization
    app.get("/test/not-found", async () => {
      throw new EntityNotFoundError("Device DEV_999 does not exist");
    });
    app.get("/test/unauthorized", async () => {
      throw new UnauthorizedError("Session has expired");
    });
    app.get("/test/forbidden", async () => {
      throw new ForbiddenError("Viewer role cannot perform this action");
    });
    app.get("/test/validation", async () => {
      throw new DomainValidationError("Invalid pad coordinate", [
        { name: "x", reason: "Coordinate must be non-negative" },
      ]);
    });
    app.get("/test/unsupported-media", async () => {
      throw new UnsupportedMediaTypeError("Only PDF and BRD formats supported");
    });
    app.get("/test/internal-error", async () => {
      throw new InternalError("Database connection lost");
    });
    app.get("/test/unexpected-error", async () => {
      throw new Error("Unexpected crash detail that should be hidden in production");
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should format 404 EntityNotFoundError as RFC 7807", async () => {
    const res = await app.inject({ method: "GET", url: "/test/not-found" });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/not-found");
    expect(body.title).toBe("Resource Not Found");
    expect(body.status).toBe(404);
    expect(body.detail).toBe("Device DEV_999 does not exist");
    expect(body.instance).toBe("/test/not-found");
  });

  it("should format 401 UnauthorizedError as RFC 7807", async () => {
    const res = await app.inject({ method: "GET", url: "/test/unauthorized" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/unauthorized");
    expect(body.title).toBe("Unauthorized");
    expect(body.status).toBe(401);
  });

  it("should format 403 ForbiddenError as RFC 7807", async () => {
    const res = await app.inject({ method: "GET", url: "/test/forbidden" });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/forbidden");
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
  });

  it("should format 400 DomainValidationError with invalidParams", async () => {
    const res = await app.inject({ method: "GET", url: "/test/validation" });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/validation");
    expect(body.status).toBe(400);
    expect(body.invalidParams).toEqual([
      { name: "x", reason: "Coordinate must be non-negative" },
    ]);
  });

  it("should format 415 UnsupportedMediaTypeError as RFC 7807", async () => {
    const res = await app.inject({ method: "GET", url: "/test/unsupported-media" });
    expect(res.statusCode).toBe(415);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/unsupported-media-type");
    expect(body.status).toBe(415);
  });

  it("should format 500 unexpected error and mask raw message in production mode", async () => {
    const res = await app.inject({ method: "GET", url: "/test/unexpected-error" });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/internal");
    expect(body.status).toBe(500);
    expect(body.title).toBe("Internal Server Error");
    expect(body.detail).toBe("An unexpected internal error occurred.");
  });
});
