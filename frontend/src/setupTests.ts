// Test setup: rewrite requests targeting http://api to http://localhost:3001
// This helps tests that use the 'api' host to resolve to the local Next dev server.
const originalFetch = (globalThis as any).fetch;

(globalThis as any).fetch = async (input: RequestInfo, init?: RequestInit) => {
  try {
    let url: string;
    if (typeof input === 'string') url = input;
    else url = (input as Request).url;

    if (url.startsWith('http://api/')) {
      const newUrl = url.replace('http://api', 'http://localhost:3001');
      if (typeof input === 'string') input = newUrl;
      else input = new Request(newUrl, input as RequestInit);
    }
  } catch (e) {
    // ignore and proceed to original fetch
  }

  if (originalFetch) return originalFetch(input, init as any);
  // Fallback to global fetch if original not present
  return (globalThis as any).fetch(input, init as any);
};
