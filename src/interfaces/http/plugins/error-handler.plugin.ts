import { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { HttpProblemError, InvalidParam } from "../errors/HttpErrors.js";

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, req, reply) => {
    // 1. Domain/HTTP Problem Errors
    if (error instanceof HttpProblemError) {
      return reply.status(error.statusCode).send({
        type: error.type,
        title: error.title,
        status: error.statusCode,
        detail: error.message,
        instance: req.url,
        invalidParams: error.invalidParams ?? [],
      });
    }

    // 2. Zod Validation Error
    if (error instanceof ZodError) {
      const invalidParams: InvalidParam[] = error.issues.map((err) => ({
        name: err.path.join(".") || "body",
        reason: err.message,
      }));

      return reply.status(400).send({
        type: "https://boardforge.io/errors/validation",
        title: "Invalid Request Parameters",
        status: 400,
        detail: "The request payload failed validation.",
        instance: req.url,
        invalidParams,
      });
    }

    // 3. Rate Limit Error (429)
    if (
      (error as any)?.status === 429 ||
      (error as any)?.statusCode === 429 ||
      (error as any)?.code === "FST_RATE_LIMIT_EXCEEDED"
    ) {
      const detail = (error as any)?.detail || (error as any)?.message || "Rate limit exceeded.";
      return reply.status(429).send({
        type: "https://boardforge.io/errors/rate-limit",
        title: "Too Many Requests",
        status: 429,
        detail,
        instance: req.url,
        invalidParams: [],
      });
    }

    // 4. Fastify Payload Too Large (413)
    if (
      (error as any)?.status === 413 ||
      (error as any)?.statusCode === 413 ||
      (error as any)?.code === "FST_ERR_CTP_BODY_TOO_LARGE" ||
      (error as any)?.code === "FST_MULTIPART_EXCEEDED_LIMIT"
    ) {
      return reply.status(413).send({
        type: "https://boardforge.io/errors/payload-too-large",
        title: "Payload Too Large",
        status: 413,
        detail: "File or request payload exceeds allowed size limit.",
        instance: req.url,
        invalidParams: [],
      });
    }

    // 5. Fastify built-in 404 or 400 schema error
    if ((error as any)?.status === 404 || (error as any)?.statusCode === 404) {
      return reply.status(404).send({
        type: "https://boardforge.io/errors/not-found",
        title: "Resource Not Found",
        status: 404,
        detail: (error as any)?.message || "Resource not found",
        instance: req.url,
        invalidParams: [],
      });
    }

    const statusCode = (error as any)?.status ?? (error as any)?.statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        type: "https://boardforge.io/errors/validation",
        title: "Bad Request",
        status: statusCode,
        detail: (error as any)?.message || "Bad Request",
        instance: req.url,
        invalidParams: [],
      });
    }

    // 6. Generic/Internal Server Error (500)
    return reply.status(500).send({
      type: "https://boardforge.io/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected internal error occurred.",
      instance: req.url,
      invalidParams: [],
    });
  });
}
