#!/usr/bin/env node
/**
 * Integration Example: Semantic Search with pgvector
 * 
 * This script demonstrates how to call the /api/rpc/search-stories endpoint
 * with a valid 1536-dimensional embedding and validate the response.
 * 
 * Usage:
 *   node integration-example.mjs
 * 
 * Or to test with real data:
 *   BASE_URL=http://localhost:3000 node integration-example.mjs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Generate a mock 1536-dimensional embedding
 * In production, use OpenAI, Anthropic, or other ML embeddings
 */
function generateMockEmbedding() {
  const embedding = [];
  for (let i = 0; i < 1536; i++) {
    // Simulate realistic embedding values (between -1 and 1)
    embedding.push(Math.random() * 2 - 1);
  }
  return embedding;
}

/**
 * Call the search-stories endpoint with validation
 */
async function searchStories(embedding, matchCount = 10) {
  console.log(`\n🔍 Calling POST ${BASE_URL}/api/rpc/search-stories`);
  console.log(`   Embedding: ${embedding.length} dimensions`);
  console.log(`   Match count: ${matchCount}`);

  const payload = {
    embedding,
    matchCount,
  };

  try {
    const response = await fetch(`${BASE_URL}/api/rpc/search-stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok) {
      console.error(`\n❌ Error (${response.status}):`);
      console.error(JSON.stringify(json, null, 2));
      return null;
    }

    console.log(`\n✅ Success (${response.status}):`);
    console.log(JSON.stringify(json, null, 2));
    return json;
  } catch (error) {
    console.error('\n❌ Network error:', error.message);
    return null;
  }
}

/**
 * Test validation errors
 */
async function testValidationErrors() {
  console.log('\n\n📋 Testing Validation Errors\n');

  // Test 1: Invalid embedding length
  console.log('Test 1: Embedding with wrong length (1024 instead of 1536)');
  await searchStories(new Array(1024).fill(0.5), 10);

  // Test 2: Invalid matchCount (0)
  console.log('\n\nTest 2: matchCount=0 (below minimum of 1)');
  const validEmbedding = generateMockEmbedding();
  await searchStories(validEmbedding, 0);

  // Test 3: Invalid matchCount (101)
  console.log('\n\nTest 3: matchCount=101 (above maximum of 100)');
  await searchStories(validEmbedding, 101);

  // Test 4: Invalid embedding type (string)
  console.log('\n\nTest 4: Embedding as string (invalid type)');
  try {
    const response = await fetch(`${BASE_URL}/api/rpc/search-stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedding: 'not-an-array', matchCount: 10 }),
    });
    const json = await response.json();
    console.log(`Response (${response.status}):`, JSON.stringify(json, null, 2));
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

/**
 * Test valid requests
 */
async function testValidRequests() {
  console.log('\n\n✨ Testing Valid Requests\n');

  const embedding = generateMockEmbedding();

  // Test 1: Default matchCount (10)
  console.log('Test 1: Valid search with default matchCount');
  await searchStories(embedding);

  // Test 2: Custom matchCount (20)
  console.log('\n\nTest 2: Valid search with matchCount=20');
  await searchStories(embedding, 20);

  // Test 3: Minimum matchCount (1)
  console.log('\n\nTest 3: Valid search with matchCount=1 (minimum)');
  await searchStories(embedding, 1);

  // Test 4: Maximum matchCount (100)
  console.log('\n\nTest 4: Valid search with matchCount=100 (maximum)');
  await searchStories(embedding, 100);
}

/**
 * Demonstrate response structure
 */
async function explainResponseStructure() {
  console.log('\n\n📚 Response Structure\n');
  console.log('Successful response:');
  console.log(`
{
  "results": [
    {
      "id": "uuid",
      "title": "Story Title",
      "summary": "Brief description",
      "cover_url": "https://...",
      "similarity": 0.92
    },
    ...
  ],
  "count": 10  // Number of results returned
}
  `);

  console.log('\nError response (validation failure):');
  console.log(`
{
  "error": "Invalid search input",
  "details": [
    {
      "code": "array_type",
      "message": "Expected array, received string",
      "path": ["embedding"]
    }
  ]
}
  `);

  console.log('\nError response (server error):');
  console.log(`
{
  "error": "error message from server"
}
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                  pgvector Search Integration Test                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${BASE_URL}/api/rpc/search-stories`);
  console.log('Validator: SearchSchema (embedding: 1536 dims, matchCount: 1-100)');
  console.log('\nSchema Definition:');
  console.log(`
  {
    embedding: z.array(z.number()).length(1536),
    matchCount: z.number().int().min(1).max(100).optional().default(10)
  }
  `);

  // Show response structure first
  explainResponseStructure();

  // Test valid requests
  await testValidRequests();

  // Test validation errors
  await testValidationErrors();

  console.log('\n\n✅ Integration test completed!\n');
}

main().catch(console.error);
