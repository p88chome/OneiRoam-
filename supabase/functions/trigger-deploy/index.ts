import { createClient } from 'jsr:@supabase/supabase-js@2';

// Server-side deploy-hook proxy. The browser must never POST api.cloudflare.com
// directly (CORS + hook secrecy): the admin panel calls this function instead.
// Two gates: platform JWT verification (deployed WITHOUT --no-verify-jwt) plus a
// real auth.getUser() check — the anon key alone must NOT be able to trigger builds.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Gate: must be an ADMIN user (Google signups are open → any-user is NOT enough).
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'unauthorized' }, 401);
    if ((user.app_metadata as Record<string, unknown> | null)?.role !== 'admin')
      return json({ error: 'forbidden' }, 403);

    // Optional { target: 'staging' } → staging hook; default production.
    let target = 'production';
    try {
      const body = await req.json();
      if (body?.target === 'staging') target = 'staging';
    } catch { /* empty body is fine */ }
    const key = target === 'staging' ? 'deploy_hook_url_staging' : 'deploy_hook_url';

    const sb = createClient(supaUrl, serviceKey);
    const { data, error } = await sb.from('settings').select('value').eq('key', key).single();
    if (error || !data?.value) return json({ error: 'hook not configured' }, 500);

    const r = await fetch(data.value, { method: 'POST' });
    if (!r.ok) return json({ error: `hook returned ${r.status}` }, 502);
    return json({ ok: true, target });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
