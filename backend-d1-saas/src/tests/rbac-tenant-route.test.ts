import worker from "../index";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  database_id: string;
  database_name: string;
  api_key_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run<T = Record<string, unknown>>(): Promise<T>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  CONTROL_DB: D1Database;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  TENANT_DATABASE_PREFIX: string;
  ADMIN_API_KEY: string;
}

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

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

class MockD1Database implements D1Database {
  constructor(
    private readonly tenant: TenantRow,
    private readonly userRoles: Record<string, string>,
  ) {}

  prepare(query: string): D1PreparedStatement {
    const sql = query;
    let bound: unknown[] = [];

    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: async <T = Record<string, unknown>>() => {
        if (sql.includes("FROM tenants") && sql.includes("WHERE id = ?")) {
          const [tenantId] = bound;
          if (tenantId === this.tenant.id) {
            return this.tenant as T;
          }
          return null;
        }

        if (sql.includes("FROM users")) {
          const [userId] = bound;
          const role = this.userRoles[String(userId)];
          if (!role) {
            return null;
          }
          return { role } as T;
        }

        return null;
      },
      all: async <T = Record<string, unknown>>() => ({ results: [] as T[] }),
      run: async <T = Record<string, unknown>>() => ({} as T),
    };

    return statement;
  }
}

function createEnv(tenant: TenantRow, userRoles: Record<string, string>): Env {
  return {
    CONTROL_DB: new MockD1Database(tenant, userRoles),
    CF_ACCOUNT_ID: "test-account",
    CF_API_TOKEN: "test-token",
    TENANT_DATABASE_PREFIX: "tenant",
    ADMIN_API_KEY: "admin-key",
  };
}

describe("RBAC on GET /tenants/:id", () => {
  const tenantId = "tenant-1";
  const tenantKey = "tenant-secret-key";

  let tenant: TenantRow;

  beforeAll(async () => {
    tenant = {
      id: tenantId,
      slug: "tenant-one",
      name: "Tenant One",
      database_id: "db-1",
      database_name: "tenant-db-1",
      api_key_hash: await sha256Hex(tenantKey),
      status: "ready",
      created_at: "2026-05-11T00:00:00.000Z",
      updated_at: "2026-05-11T00:00:00.000Z",
    };
  });

  async function callGetTenantSummary(userId: string, role: string): Promise<Response> {
    const env = createEnv(tenant, { [userId]: role });
    const token = createUnsignedJwt({ sub: userId, role });
    const request = new Request(`http://localhost:8787/tenants/${tenantId}`, {
      method: "GET",
      headers: {
        "x-tenant-key": tenantKey,
        authorization: `Bearer ${token}`,
      },
    });

    return worker.fetch(request, env);
  }

  test("denies request without bearer token", async () => {
    const env = createEnv(tenant, {});
    const request = new Request(`http://localhost:8787/tenants/${tenantId}`, {
      method: "GET",
      headers: {
        "x-tenant-key": tenantKey,
      },
    });

    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  test("allows user role", async () => {
    const response = await callGetTenantSummary("101", "user");
    expect(response.status).toBe(200);
  });

  test("allows employee role", async () => {
    const response = await callGetTenantSummary("102", "employee");
    expect(response.status).toBe(200);
  });

  test("allows admin role", async () => {
    const response = await callGetTenantSummary("103", "admin");
    expect(response.status).toBe(200);
  });

  test("allows superadmin role", async () => {
    const response = await callGetTenantSummary("104", "superadmin");
    expect(response.status).toBe(200);
  });

  test("allows superadmin with UUID sub", async () => {
    const response = await callGetTenantSummary("550e8400-e29b-41d4-a716-446655440000", "superadmin");
    expect(response.status).toBe(200);
  });
});
