export async function onRequest(request: Request) {
  return new Response(JSON.stringify({ status: 'ok', service: 'comics-worker' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
