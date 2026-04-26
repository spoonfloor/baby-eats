import { compare } from 'npm:bcryptjs@2.4.3';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  const configuredHash = String(Deno.env.get('SPLASH_PASSWORD_HASH') || '').trim();
  if (!configuredHash) {
    return jsonResponse(500, { ok: false, error: 'Password gate is not configured.' });
  }

  let password = '';
  try {
    const body = await req.json();
    password = String(body?.password || '');
  } catch (_) {
    return jsonResponse(400, { ok: false, error: 'Invalid request payload.' });
  }

  if (!password) {
    return jsonResponse(400, { ok: false, error: 'Password is required.' });
  }

  const isValid = await compare(password, configuredHash).catch(() => false);
  if (!isValid) {
    return jsonResponse(401, { ok: false, error: 'Invalid password.' });
  }

  return jsonResponse(200, { ok: true });
});
