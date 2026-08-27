import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deleteServiceSchema, importServicesSchema } from "../server/mcp/schemas.js";

describe("MCP schemas", () => {
  it("requires confirm=true for delete", () => {
    assert.throws(() => deleteServiceSchema.parse({ id: "svc-1", confirm: false }));
    assert.deepEqual(deleteServiceSchema.parse({ id: "svc-1", confirm: true }), {
      id: "svc-1",
      confirm: true,
    });
  });

  it("requires confirm=true for import", () => {
    assert.throws(() => importServicesSchema.parse({
      confirm: false,
      services: [{ name: "Example" }],
    }));
    assert.equal(importServicesSchema.parse({
      confirm: true,
      services: [{ name: "Example" }],
    }).mode, "append");
  });
});
