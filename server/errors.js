export function apiError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export function badRequest(message) {
  return apiError("VALIDATION_ERROR", message, 400);
}

export function notFound(message) {
  return apiError("NOT_FOUND", message, 404);
}

export function formatErrorPayload(error) {
  const statusCode = error.statusCode ?? 500;
  const code = error.code
    ?? (statusCode === 400 ? "VALIDATION_ERROR" : statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR");

  return {
    statusCode,
    body: {
      error: {
        code,
        message: error.message || "Request failed",
      },
    },
  };
}
