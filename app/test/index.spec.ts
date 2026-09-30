import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("EdgeFlags Worker", () => {
  it("identifies the service from the root endpoint", async () => {
    const response = await exports.default.fetch("https://edgeflags.test/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      service: "edgeflags",
      status: "ok",
    });
  });

  it.each([
    ["GET", "/missing"],
    ["POST", "/"],
  ])("returns 404 for %s %s", async (method, path) => {
    const response = await exports.default.fetch(
      new Request(`https://edgeflags.test${path}`, { method }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not Found" });
  });
});
