/**
 * Tenant client tests: story CRUD operations within an isolated database.
 */

import { AdminClient, TenantClient } from "../client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TEST_BASE_URL = loadEnvValue("BACKEND_BASE_URL") ?? "http://localhost:8788";
const TEST_RUN_ID = crypto.randomUUID().slice(0, 8);

function loadEnvValue(name: string): string | undefined {
  const envPath = resolve(process.cwd(), "..", ".env");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const content = readFileSync(envPath, "utf8");
  const match = content.match(new RegExp(`^${name}=([^\r\n]+)$`, "m"));
  return match?.[1]?.trim();
}

const TEST_ADMIN_KEY = loadEnvValue("ADMIN_API_KEY") ?? "test-admin-key-12345";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createUnsignedJwt(payload: Record<string, unknown>): string {
  const header = { alg: "none", typ: "JWT" };
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.`;
}

function uniqueSlug(base: string): string {
  return `${base}-${TEST_RUN_ID}`;
}

describe("TenantClient", () => {
  let tenant: { id: string; name: string };
  let tenantKey: string;
  let accessToken: string;
  let client: TenantClient;

  beforeAll(async () => {
    const admin = new AdminClient({
      baseUrl: TEST_BASE_URL,
      adminKey: TEST_ADMIN_KEY,
    });

    const result = await admin.provisionTenant("Tenant Test Suite");
    tenant = result.tenant;
    tenantKey = result.tenantKey;
    accessToken = createUnsignedJwt({ sub: "1001", role: "superadmin" });

    client = new TenantClient({
      baseUrl: TEST_BASE_URL,
      tenantId: tenant.id,
      tenantKey,
      accessToken,
    });
  });

  test("gets tenant info", async () => {
    const response = await client.getTenant();

    expect(response.tenant.id).toBe(tenant.id);
    expect(response.tenant.status).toBe("ready");
  });

  test("creates a story", async () => {
    const response = await client.createStory({
      title: "Test Story",
      slug: uniqueSlug("test-story"),
      description: "This is test content",
      cover_url: "https://example.com/cover.jpg",
      status: "ongoing",
      author: "Test Author",
      category: JSON.stringify(["Action", "Adventure"]),
    });

    expect(response.story).toBeDefined();
    expect(response.story.id).toBeTruthy();
    expect(response.story.title).toBe("Test Story");
    expect(response.story.slug).toBe(uniqueSlug("test-story"));
    expect(response.story.description).toBe("This is test content");
  });

  test("lists stories", async () => {
    await client.createStory({
      title: "Story 1",
      slug: uniqueSlug("story-1"),
      description: "Content 1",
      cover_url: "",
      status: "ongoing",
      author: "Author 1",
      category: JSON.stringify(["Drama"]),
    });
    await client.createStory({
      title: "Story 2",
      slug: uniqueSlug("story-2"),
      description: "Content 2",
      cover_url: "",
      status: "completed",
      author: "Author 2",
      category: JSON.stringify(["Comedy"]),
    });

    const response = await client.listStories();

    expect(Array.isArray(response.stories)).toBe(true);
    expect(response.stories.length).toBeGreaterThanOrEqual(2);
  });

  test("updates a story", async () => {
    const created = await client.createStory({
      title: "Original",
      slug: uniqueSlug("original"),
      description: "Original description",
      cover_url: "",
      status: "ongoing",
      author: "Original Author",
      category: JSON.stringify(["Mystery"]),
    });
    const updated = await client.updateStory(created.story.id, {
      title: "Updated",
      slug: uniqueSlug("updated"),
      description: "Updated description",
      cover_url: "",
      status: "completed",
      author: "Updated Author",
      category: JSON.stringify(["Mystery", "Thriller"]),
    });

    expect(updated.story.title).toBe("Updated");
    expect(updated.story.description).toBe("Updated description");
  });

  test("deletes a story", async () => {
    const created = await client.createStory({
      title: "To Delete",
      slug: uniqueSlug("to-delete"),
      description: "Delete me",
      cover_url: "",
      status: "ongoing",
      author: "Delete Author",
      category: JSON.stringify(["Test"]),
    });
    const deleted = await client.deleteStory(created.story.id);

    expect(deleted.deleted).toBe(true);

    // Verify it's gone
    await expect(client.getStory(created.story.id)).rejects.toThrow("Story not found");
  });

  test("rejects invalid tenant key", async () => {
    const badClient = new TenantClient({
      baseUrl: TEST_BASE_URL,
      tenantId: tenant.id,
      tenantKey: "wrong-key",
      accessToken,
    });

    await expect(badClient.listStories()).rejects.toThrow("Unauthorized");
  });
});
