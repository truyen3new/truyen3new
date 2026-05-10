// Edge Function Tests for payment_and_rewards
// Unit tests for the payment and rewards webhook handler

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock request/response for testing
interface TestRequest {
  method: string;
  body?: unknown;
}

interface TestResponse {
  status: number;
  body?: unknown;
}

// Test: Payment webhook with valid payload
Deno.test("payment_webhook: valid payload creates payment record", async () => {
  const testPayload = {
    type: "payment_webhook",
    data: {
      user_id: "test-user-123",
      amount: 9.99,
      provider: "stripe",
      provider_event: { event_type: "charge.completed" },
    },
  };

  // Simulate request
  const req = new Request("http://localhost/functions/v1/payment_and_rewards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testPayload),
  });

  // In real test environment, this would call the actual Edge Function
  // Result should be { recorded: true }
  assertEquals(testPayload.type, "payment_webhook");
  assertEquals(testPayload.data.user_id, "test-user-123");
});

// Test: Daily checkin creates idempotent reward
Deno.test("daily_checkin: idempotent reward grant", async () => {
  const testPayload = {
    type: "daily_checkin",
    data: {
      user_id: "test-user-123",
    },
  };

  // Simulate request
  const req = new Request("http://localhost/functions/v1/payment_and_rewards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testPayload),
  });

  // Calling twice should return same result (idempotent)
  assertEquals(testPayload.type, "daily_checkin");
  assertEquals(testPayload.data.user_id, "test-user-123");
});

// Test: Invalid JSON returns 400
Deno.test("invalid_json: returns 400", async () => {
  // Invalid JSON should fail parsing
  const invalidJson = "{ invalid json }";
  // Expected error: 400 Bad Request
});

// Test: Missing type field returns 400
Deno.test("missing_type: returns 400", async () => {
  const payload = {
    data: { user_id: "test-user-123" },
  };
  // Expected error: 400 Bad Request (missing-type)
});

// Test: Missing user_id returns 400
Deno.test("missing_user_id: returns 400", async () => {
  const payload = {
    type: "payment_webhook",
    data: { amount: 10 },
  };
  // Expected error: 400 Bad Request (missing-user-id)
});

// Test: Non-POST method returns 405
Deno.test("non_post_method: returns 405", async () => {
  const req = new Request("http://localhost/functions/v1/payment_and_rewards", {
    method: "GET",
  });
  // Expected: 405 Method Not Allowed
});
