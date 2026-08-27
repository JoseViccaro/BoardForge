export interface InvalidParam {
  name: string;
  reason: string;
}

export abstract class HttpProblemError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly type: string;
  public abstract readonly title: string;
  public readonly invalidParams?: InvalidParam[];

  constructor(message: string, invalidParams?: InvalidParam[]) {
    super(message);
    this.invalidParams = invalidParams;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundError extends HttpProblemError {
  public readonly statusCode = 404;
  public readonly type = "https://boardforge.io/errors/not-found";
  public readonly title = "Resource Not Found";
}

export class UnauthorizedError extends HttpProblemError {
  public readonly statusCode = 401;
  public readonly type = "https://boardforge.io/errors/unauthorized";
  public readonly title = "Unauthorized";
}

export class ForbiddenError extends HttpProblemError {
  public readonly statusCode = 403;
  public readonly type = "https://boardforge.io/errors/forbidden";
  public readonly title = "Forbidden";
}

export class DomainValidationError extends HttpProblemError {
  public readonly statusCode = 400;
  public readonly type = "https://boardforge.io/errors/validation";
  public readonly title = "Invalid Request Parameters";
}

export class ConflictError extends HttpProblemError {
  public readonly statusCode = 409;
  public readonly type = "https://boardforge.io/errors/conflict";
  public readonly title = "Resource Conflict";
}

export class UnsupportedMediaTypeError extends HttpProblemError {
  public readonly statusCode = 415;
  public readonly type = "https://boardforge.io/errors/unsupported-media-type";
  public readonly title = "Unsupported Media Type";
}

export class PayloadTooLargeError extends HttpProblemError {
  public readonly statusCode = 413;
  public readonly type = "https://boardforge.io/errors/payload-too-large";
  public readonly title = "Payload Too Large";
}

export class RateLimitExceededError extends HttpProblemError {
  public readonly statusCode = 429;
  public readonly type = "https://boardforge.io/errors/rate-limit";
  public readonly title = "Too Many Requests";
}

export class InternalError extends HttpProblemError {
  public readonly statusCode = 500;
  public readonly type = "https://boardforge.io/errors/internal";
  public readonly title = "Internal Server Error";
}
