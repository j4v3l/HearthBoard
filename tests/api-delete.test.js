import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestServer } from "./helpers/test-server.js";

describe("DELETE /api/services/:id", () => {
  it("returns 404 when deleting a missing service", async () => {
    await withTestServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/services/does-not-exist`, {
        method: "DELETE",
      });
      assert.equal(response.status, 404);
      const body = await response.json();
      assert.equal(body.error.code, "NOT_FOUND");
      assert.match(body.error.message, /not found/i);
    });
  });

  it("returns 204 when deleting an existing service", async () => {
    await withTestServer(async ({ baseUrl }) => {
      const createResponse = await fetch(`${baseUrl}/api/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Temp Service",
          category: "Infrastructure",
          checkType: "None",
        }),
      });
      assert.equal(createResponse.status, 201);
      const created = await createResponse.json();

      const deleteResponse = await fetch(`${baseUrl}/api/services/${created.id}`, {
        method: "DELETE",
      });
      assert.equal(deleteResponse.status, 204);

      const getResponse = await fetch(`${baseUrl}/api/services/${created.id}`);
      assert.equal(getResponse.status, 404);
    });
  });
});
