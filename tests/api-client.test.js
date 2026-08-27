import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  HearthboardApiClient,
  HearthboardApiError,
  requireConfirmation,
} from "../server/mcp/api-client.js";

describe("HearthboardApiClient", () => {
  it("normalizes structured API errors", async () => {
    const fetchMock = mock.fn(async () => new Response(
      JSON.stringify({ error: { code: "NOT_FOUND", message: "Service not found" } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    ));
    globalThis.fetch = fetchMock;

    const client = new HearthboardApiClient("http://example.test");
    await assert.rejects(
      () => client.request("GET", "/api/services/missing"),
      (error) => {
        assert.ok(error instanceof HearthboardApiError);
        assert.equal(error.code, "NOT_FOUND");
        assert.equal(error.status, 404);
        return true;
      },
    );
  });

  it("returns null for 204 responses", async () => {
    globalThis.fetch = mock.fn(async () => new Response(null, { status: 204 }));
    const client = new HearthboardApiClient("http://example.test");
    const result = await client.request("DELETE", "/api/services/1");
    assert.equal(result, null);
  });

  it("maps network failures to retryable errors", async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error("connection refused");
    });
    const client = new HearthboardApiClient("http://example.test");
    await assert.rejects(
      () => client.request("GET", "/api/health"),
      (error) => {
        assert.equal(error.code, "NETWORK_ERROR");
        assert.equal(error.retryable, true);
        return true;
      },
    );
  });
});

describe("requireConfirmation", () => {
  it("requires confirm=true", () => {
    assert.throws(
      () => requireConfirmation(false, "deleting a service"),
      (error) => error.code === "CONFIRMATION_REQUIRED",
    );
  });
});
