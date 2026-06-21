/**
 * Typed application errors mapped to the uniform error envelope
 * `{ error: { code, message, details? } }` (backend-final.md §3 preamble, §4.2).
 * Business-rule errors carry an explicit HTTP status; unknown errors become a
 * generic 500 in the central handler (no stack/SQL leakage).
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export const Errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError(401, 'unauthorized', message),

  invalidCredentials: () =>
    new AppError(401, 'invalid_credentials', 'Invalid email or password'),

  wrongCurrentPassword: () =>
    new AppError(401, 'wrong_current_password', 'Current password is incorrect'),

  forbidden: (message = 'You do not have access to this resource') =>
    new AppError(403, 'forbidden', message),

  notFound: (message = 'Resource not found') =>
    new AppError(404, 'not_found', message),

  validation: (message = 'Validation failed', details?: unknown) =>
    new AppError(422, 'validation_error', message, details),

  weakPassword: (message = 'Password does not meet requirements') =>
    new AppError(400, 'weak_password', message),

  emailTaken: () =>
    new AppError(409, 'email_taken', 'That email is already in use'),

  insufficientStock: (details: Array<{ productId: string; requested: number; remaining: number }>) =>
    new AppError(409, 'insufficient_stock', 'One or more items exceed available stock', details),

  insufficientWarehouseStock: (available: number) =>
    new AppError(409, 'insufficient_warehouse_stock', 'Not enough warehouse stock', { available }),

  alreadyResolved: () =>
    new AppError(409, 'already_resolved', 'This request has already been resolved'),
};
