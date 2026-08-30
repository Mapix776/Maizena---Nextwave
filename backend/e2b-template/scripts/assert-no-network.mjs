let blocked = false;
let detail = '';
try {
  const response = await fetch('https://example.com', {
    signal: AbortSignal.timeout(5_000),
  });
  detail = `unexpected status ${response.status}`;
} catch (error) {
  blocked = true;
  detail = error instanceof Error ? error.name : 'connection rejected';
}

if (!blocked) throw new Error(`Outbound network was not blocked: ${detail}`);
console.log(JSON.stringify({ gate: 'network-denial', blocked: true, detail }));
