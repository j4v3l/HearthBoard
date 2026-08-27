const DEFAULT_TIMEOUT_MS = 30_000;

export class HearthboardApiError extends Error {
  constructor(message, { code, status, retryable = false, details } = {}) {
    super(message);
    this.name = "HearthboardApiError";
    this.code = code ?? "API_ERROR";
    this.status = status ?? 500;
    this.retryable = retryable;
    this.details = details;
  }
}

export class HearthboardApiClient {
  constructor(baseUrl = process.env.HEARTHBOARD_BASE_URL ?? "http://127.0.0.1:3000", options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request(method, path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body == null ? undefined : { "Content-Type": "application/json" },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 204) {
        return null;
      }

      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (!response.ok) {
        throw this.#normalizeError(response.status, payload);
      }

      return payload;
    } catch (error) {
      if (error instanceof HearthboardApiError) {
        throw error;
      }
      if (error?.name === "AbortError") {
        throw new HearthboardApiError("Request timed out", {
          code: "TIMEOUT",
          status: 408,
          retryable: true,
        });
      }
      throw new HearthboardApiError(error?.message ?? "Request failed", {
        code: "NETWORK_ERROR",
        status: 0,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  #normalizeError(status, payload) {
    if (payload && typeof payload === "object") {
      if (payload.error?.message) {
        const code = payload.error.code ?? (status === 404 ? "NOT_FOUND" : "API_ERROR");
        return new HearthboardApiError(payload.error.message, {
          code,
          status,
          retryable: status === 429 || status === 503,
          details: payload.error,
        });
      }

      if (payload.message) {
        const code = payload.code ?? (status === 404 ? "NOT_FOUND" : status === 400 ? "VALIDATION_ERROR" : "API_ERROR");
        return new HearthboardApiError(payload.message, {
          code,
          status,
          retryable: status === 429 || status === 503,
        });
      }
    }

    const message = typeof payload === "string" ? payload : "Request failed";
    return new HearthboardApiError(message, {
      code: status === 404 ? "NOT_FOUND" : status === 400 ? "VALIDATION_ERROR" : "API_ERROR",
      status,
      retryable: status === 429 || status === 503,
    });
  }
}

export function jsonToolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorToolResult(error) {
  const payload = error instanceof HearthboardApiError
    ? {
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
          retryable: error.retryable,
          details: error.details,
        },
      }
    : {
        error: {
          code: "INTERNAL_ERROR",
          message: error?.message ?? "Request failed",
        },
      };

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function requireConfirmation(value, action) {
  if (value !== true) {
    throw new HearthboardApiError(`Set confirm to true before ${action}`, {
      code: "CONFIRMATION_REQUIRED",
      status: 400,
    });
  }
}
