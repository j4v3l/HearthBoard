import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiError,
  badRequest,
  formatErrorPayload,
  notFound,
} from "../server/errors.js";

describe("errors", () => {
  it("formats validation errors", () => {
    const { statusCode, body } = formatErrorPayload(badRequest("Invalid category"));
    assert.equal(statusCode, 400);
    assert.deepEqual(body, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid category",
      },
    });
  });

  it("formats not found errors", () => {
    const { statusCode, body } = formatErrorPayload(notFound("Service not found"));
    assert.equal(statusCode, 404);
    assert.equal(body.error.code, "NOT_FOUND");
  });

  it("defaults unknown errors to internal", () => {
    const { statusCode, body } = formatErrorPayload(new Error("boom"));
    assert.equal(statusCode, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.equal(body.error.message, "boom");
  });

  it("preserves explicit api error codes", () => {
    const error = apiError("CUSTOM", "Something failed", 418);
    const { statusCode, body } = formatErrorPayload(error);
    assert.equal(statusCode, 418);
    assert.equal(body.error.code, "CUSTOM");
  });
});
