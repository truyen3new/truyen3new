/**
 * Admin client tests: provisioning and management operations.
 */

import { AdminClient } from "../client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TEST_BASE_URL = process.env.BACKEND_BASE_URL ?? loadEnvValue("BACKEND_BASE_URL") ?? "http://localhost:8787";

function loadEnvValue(name: string): string | undefined {
  const envPath = resolve(process.cwd(), "..", ".env");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const content = readFileSync(envPath, "utf8");
  const match = content.match(new RegExp(`^${name}=([^\r\n]+)$`, "m"));
  return match?.[1]?.trim();
}

const TEST_ADMIN_KEY = process.env.ADMIN_API_KEY ?? loadEnvValue("ADMIN_API_KEY") ?? "test-admin-key-12345";

describe("AdminClient", () => {
  const client = new AdminClient({
    baseUrl: TEST_BASE_URL,
    adminKey: TEST_ADMIN_KEY,
  });

  test("provisions a new tenant", async () => {
    const response = await client.provisionTenant("Test Company");

    expect(response.tenant).toBeDefined();
    expect(response.tenant.id).toBeTruthy();
    expect(response.tenant.slug).toBe("test-company");
    expect(response.tenant.status).toBe("ready");
    expect(response.tenantKey).toBeTruthy();
  });

  test("rejects invalid admin key", async () => {
    const badClient = new AdminClient({
      baseUrl: TEST_BASE_URL,
      adminKey: "wrong-key",
    });

    await expect(badClient.provisionTenant("Test")).rejects.toThrow("Unauthorized");
  });

  test("lists all tenants", async () => {
    const response = await client.listTenants();

    expect(Array.isArray(response.tenants)).toBe(true);
    expect(response.tenants.length).toBeGreaterThan(0);
  });
});
