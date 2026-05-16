export async function onRequest(request: Request) {
  return new Response(JSON.stringify({ status: 'ok', service: 'analytics-worker' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
