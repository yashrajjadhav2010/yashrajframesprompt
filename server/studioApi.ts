import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

export const ADMIN_EMAIL = 'yashrajart1999@gmail.com';

const PLAN_LIMITS: Record<string, { styleLimit: number; orderLimit: number }> = {
  free: { styleLimit: 25, orderLimit: 50 },
  studio_pro: { styleLimit: 1000, orderLimit: 5000 },
  enterprise: { styleLimit: 10000, orderLimit: 50000 }
};

interface EnvConfig {
  clerkSecretKey: string;
  clerkPublishableKey: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
}

interface JwkKey {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  use?: string;
  alg?: string;
}

let cachedEnv: EnvConfig | null = null;
let cachedJwks: { fetchedAt: number; keys: JwkKey[] } = { fetchedAt: 0, keys: [] };

function readDotEnvFiles(): Record<string, string> {
  const result: Record<string, string> = {};
  const root = process.cwd();
  for (const file of ['.env', '.env.local']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const raw = fs.readFileSync(full, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val) result[key] = val;
    }
  }
  return result;
}

function getEnvConfig(): EnvConfig {
  if (cachedEnv && cachedEnv.clerkSecretKey && cachedEnv.supabaseUrl && cachedEnv.supabaseSecretKey) {
    return cachedEnv;
  }
  const fileEnv = readDotEnvFiles();
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = (process.env[k] || fileEnv[k] || '').trim();
      if (v) return v;
    }
    return '';
  };

  const supabaseUrl = pick(['VITE_SUPABASE_URL', 'SUPABASE_URL'])
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');

  cachedEnv = {
    clerkSecretKey: pick(['CLERK_SECRET_KEY']),
    clerkPublishableKey: pick(['VITE_CLERK_PUBLISHABLE_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_PUBLISHABLE_KEY']),
    supabaseUrl,
    supabaseSecretKey: pick(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
  };
  return cachedEnv;
}

function base64UrlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return Buffer.from(b64, 'base64');
}

function deriveClerkFrontendDomain(publishableKey: string): string {
  const parts = String(publishableKey || '').trim().split('_');
  if (parts.length < 3) return '';
  try {
    const decoded = base64UrlDecode(parts.slice(2).join('_')).toString('utf8').trim();
    return decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
  } catch {
    return '';
  }
}

async function getClerkJwks(forceRefresh = false): Promise<JwkKey[]> {
  const now = Date.now();
  if (!forceRefresh && cachedJwks.keys.length > 0 && now - cachedJwks.fetchedAt < 10 * 60 * 1000) {
    return cachedJwks.keys;
  }
  const cfg = getEnvConfig();
  let keys: JwkKey[] = [];

  if (cfg.clerkSecretKey) {
    const res = await fetch('https://api.clerk.com/v1/jwks', {
      headers: { Authorization: `Bearer ${cfg.clerkSecretKey}` }
    });
    if (res.ok) {
      const json = (await res.json()) as { keys?: JwkKey[] };
      if (Array.isArray(json.keys)) keys = json.keys;
    }
  }

  if (keys.length === 0 && cfg.clerkPublishableKey) {
    const domain = deriveClerkFrontendDomain(cfg.clerkPublishableKey);
    if (domain) {
      const res = await fetch(`https://${domain}/.well-known/jwks.json`);
      if (res.ok) {
        const json = (await res.json()) as { keys?: JwkKey[] };
        if (Array.isArray(json.keys)) keys = json.keys;
      }
    }
  }

  if (keys.length > 0) {
    cachedJwks = { fetchedAt: now, keys };
  }
  return keys;
}

async function verifyClerkJwt(token: string): Promise<{ sub: string } | null> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  let header: { kid?: string; alg?: string };
  let payload: { sub?: string; exp?: number; nbf?: number };
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.sub) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < nowSec - 15) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > nowSec + 15) return null;

  let keys = await getClerkJwks(false);
  let jwk = keys.find(k => !header.kid || k.kid === header.kid);
  if (!jwk) {
    keys = await getClerkJwks(true);
    jwk = keys.find(k => !header.kid || k.kid === header.kid);
  }
  if (!jwk) return null;

  try {
    const publicKey = crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' });
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);
    const valid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
    if (!valid) return null;
    return { sub: String(payload.sub) };
  } catch {
    return null;
  }
}

interface ClerkUserRecord {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: Array<{ id: string; email_address: string }>;
  public_metadata?: Record<string, unknown>;
  created_at?: number;
  last_active_at?: number | null;
  last_sign_in_at?: number | null;
}

function getClerkPrimaryEmail(user: ClerkUserRecord): string {
  const list = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primary = list.find(e => e.id === user.primary_email_address_id) || list[0];
  return (primary?.email_address || '').trim();
}

function isClerkRecordAdmin(user: ClerkUserRecord): boolean {
  const target = ADMIN_EMAIL.toLowerCase();
  const list = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  return list.some(e => typeof e.email_address === 'string' && e.email_address.trim().toLowerCase() === target);
}

function getClerkDisplayName(user: ClerkUserRecord): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user.username) return user.username;
  const email = getClerkPrimaryEmail(user);
  return email ? email.split('@')[0] : 'Studio Member';
}

async function clerkRequest<T = unknown>(endpoint: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const cfg = getEnvConfig();
  if (!cfg.clerkSecretKey) {
    return { ok: false, status: 500, data: { error: 'CLERK_SECRET_KEY not configured' } as unknown as T };
  }
  const res = await fetch(`https://api.clerk.com/v1${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.clerkSecretKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

async function supaRest<T = unknown>(
  tablePath: string,
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const cfg = getEnvConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseSecretKey) {
    return { ok: false, status: 500, data: null, error: 'Supabase not configured' };
  }
  const headers: Record<string, string> = {
    apikey: cfg.supabaseSecretKey,
    Authorization: `Bearer ${cfg.supabaseSecretKey}`,
    'Content-Type': 'application/json'
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${tablePath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const errMsg = (parsed && typeof parsed === 'object' && 'message' in parsed)
      ? String((parsed as { message: unknown }).message)
      : `HTTP ${res.status}`;
    return { ok: false, status: res.status, data: null, error: errMsg };
  }
  return { ok: true, status: res.status, data: parsed as T };
}

function mapStatusForLegacySupabaseConstraint(status: string): string {
  if (status === 'paused') return 'canceled';
  if (status === 'pending') return 'trialing';
  return status;
}

function mapSupabaseStatusBack(
  supaStatus: string | undefined,
  metaStatus: unknown,
  isAdmin = false
): string {
  if (isAdmin) return 'active';
  if (typeof metaStatus === 'string' && ['active', 'paused', 'pending'].includes(metaStatus)) {
    return metaStatus;
  }
  if (metaStatus === 'trialing') return 'pending';
  if (metaStatus === 'canceled' || metaStatus === 'past_due') return 'paused';
  if (supaStatus === 'canceled' || supaStatus === 'past_due') return 'paused';
  if (supaStatus === 'trialing' || supaStatus === 'pending') return 'pending';
  // Manual approval policy: accounts remain pending until Admin explicitly approves them
  return 'pending';
}

interface PromptLogEntry {
  id: string;
  user_id: string;
  email: string;
  pin_id: number | null;
  pin_title: string;
  category: string;
  action_type: 'copy' | 'ai_redirect';
  ai_target: string | null;
  created_at: string;
}

function buildMergedSubscriber(
  clerkUser: ClerkUserRecord,
  supaRow?: Record<string, unknown> | null,
  styleCount = 0,
  orderCount = 0
) {
  const meta = (clerkUser.public_metadata && typeof clerkUser.public_metadata === 'object')
    ? clerkUser.public_metadata
    : {};
  const email = getClerkPrimaryEmail(clerkUser) || (typeof supaRow?.email === 'string' ? supaRow.email : '');
  const fullName = getClerkDisplayName(clerkUser);
  const tier = (typeof meta.planTier === 'string' && PLAN_LIMITS[meta.planTier])
    ? meta.planTier
    : ((typeof supaRow?.plan_tier === 'string' && PLAN_LIMITS[supaRow.plan_tier]) ? supaRow.plan_tier : 'free');
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
  const isTargetAdmin = isClerkRecordAdmin(clerkUser);
  const status = mapSupabaseStatusBack(
    typeof supaRow?.plan_status === 'string' ? supaRow.plan_status : undefined,
    meta.planStatus,
    isTargetAdmin
  );

  const copyCount = Math.max(
    Number(meta.promptCopyCount) || 0,
    Number(supaRow?.prompt_copy_count) || 0
  );
  const redirectCount = Math.max(
    Number(meta.aiRedirectCount) || 0,
    Number(supaRow?.ai_redirect_count) || 0
  );

  const lastActiveMs = Math.max(
    meta.lastActiveAt ? Date.parse(String(meta.lastActiveAt)) || 0 : 0,
    supaRow?.last_active_at ? Date.parse(String(supaRow.last_active_at)) || 0 : 0,
    Number(clerkUser.last_active_at) || 0,
    Number(clerkUser.last_sign_in_at) || 0,
    Number(clerkUser.created_at) || 0
  );

  return {
    user_id: clerkUser.id,
    email,
    full_name: fullName,
    avatar_url: clerkUser.image_url || '',
    plan_tier: tier,
    plan_status: status,
    style_limit: Number(supaRow?.style_limit) || limits.styleLimit,
    order_limit: Number(supaRow?.order_limit) || limits.orderLimit,
    prompt_copy_count: copyCount,
    ai_redirect_count: redirectCount,
    last_prompt_title: (typeof meta.lastPromptTitle === 'string' ? meta.lastPromptTitle : '') || (typeof supaRow?.last_prompt_title === 'string' ? supaRow.last_prompt_title : ''),
    last_active_at: lastActiveMs ? new Date(lastActiveMs).toISOString() : new Date().toISOString(),
    created_at: clerkUser.created_at ? new Date(clerkUser.created_at).toISOString() : (typeof supaRow?.created_at === 'string' ? supaRow.created_at : new Date().toISOString()),
    admin_note: (typeof meta.adminNote === 'string' ? meta.adminNote : '') || (typeof supaRow?.admin_note === 'string' ? supaRow.admin_note : ''),
    approved_at: (typeof meta.approvedAt === 'string' ? meta.approvedAt : null) || (typeof supaRow?.approved_at === 'string' ? supaRow.approved_at : null),
    paused_at: (typeof meta.pausedAt === 'string' ? meta.pausedAt : null) || (typeof supaRow?.paused_at === 'string' ? supaRow.paused_at : null),
    customStyleCount: styleCount,
    shopOrderCount: orderCount
  };
}

async function syncUserSubscriptionRowToSupabase(
  userId: string,
  payload: {
    email?: string;
    plan_tier?: string;
    plan_status?: string;
    style_limit?: number;
    order_limit?: number;
  }
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString()
  };
  if (payload.email !== undefined) row.email = payload.email;
  if (payload.plan_tier !== undefined) row.plan_tier = payload.plan_tier;
  if (payload.plan_status !== undefined) row.plan_status = payload.plan_status;
  if (payload.style_limit !== undefined) row.style_limit = payload.style_limit;
  if (payload.order_limit !== undefined) row.order_limit = payload.order_limit;

  const firstAttempt = await supaRest('user_subscriptions?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: row
  });
  if (firstAttempt.ok) return firstAttempt;

  // Fallback when old check constraint rejects 'paused' / 'pending' — still triggers Realtime wake-up!
  if (payload.plan_status && (payload.plan_status === 'paused' || payload.plan_status === 'pending')) {
    const legacyRow = {
      ...row,
      plan_status: mapStatusForLegacySupabaseConstraint(payload.plan_status)
    };
    return supaRest('user_subscriptions?on_conflict=user_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: legacyRow
    });
  }
  return firstAttempt;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function authenticateRequest(req: IncomingMessage): Promise<{ user: ClerkUserRecord; isAdmin: boolean } | null> {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const verified = await verifyClerkJwt(token);
  if (!verified?.sub) return null;

  const clerkRes = await clerkRequest<ClerkUserRecord>(`/users/${encodeURIComponent(verified.sub)}`);
  if (!clerkRes.ok || !clerkRes.data?.id) return null;

  return {
    user: clerkRes.data,
    isAdmin: isClerkRecordAdmin(clerkRes.data)
  };
}

export async function handleStudioApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const rawUrl = req.url || '/';
  const pathname = rawUrl.split('?')[0];
  if (!pathname.startsWith('/api/')) return false;

  const method = (req.method || 'GET').toUpperCase();

  if (pathname === '/api/health' && method === 'GET') {
    const cfg = getEnvConfig();
    sendJson(res, 200, {
      ok: true,
      clerkReady: Boolean(cfg.clerkSecretKey),
      supabaseReady: Boolean(cfg.supabaseUrl && cfg.supabaseSecretKey)
    });
    return true;
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    sendJson(res, 401, { ok: false, error: 'Authentication required' });
    return true;
  }

  // 1. Current user's authoritative subscription & telemetry
  if (pathname === '/api/subscription/status' && method === 'GET') {
    const email = getClerkPrimaryEmail(auth.user);
    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? { ...auth.user.public_metadata }
      : {};
    const subRes = await supaRest<Array<Record<string, unknown>>>(
      `user_subscriptions?user_id=eq.${encodeURIComponent(auth.user.id)}&select=*`
    );
    let supaRow = Array.isArray(subRes.data) && subRes.data[0] ? subRes.data[0] : null;
    const defaultStatus = auth.isAdmin ? 'active' : 'pending';
    let userRecord = auth.user;

    if (!auth.isAdmin && typeof currentMeta.planStatus !== 'string') {
      const nextMeta = {
        ...currentMeta,
        planTier: typeof currentMeta.planTier === 'string' ? currentMeta.planTier : 'free',
        planStatus: 'pending',
        lastActiveAt: new Date().toISOString()
      };
      const clerkPatch = await clerkRequest<ClerkUserRecord>(
        `/users/${encodeURIComponent(auth.user.id)}/metadata`,
        { method: 'PATCH', body: JSON.stringify({ public_metadata: nextMeta }) }
      );
      if (clerkPatch.ok && clerkPatch.data?.id) {
        userRecord = clerkPatch.data;
      }
    }

    if (!supaRow || (!auth.isAdmin && typeof currentMeta.planStatus !== 'string')) {
      const created = await syncUserSubscriptionRowToSupabase(auth.user.id, {
        email,
        plan_tier: typeof currentMeta.planTier === 'string' ? currentMeta.planTier : 'free',
        plan_status: defaultStatus,
        style_limit: PLAN_LIMITS.free.styleLimit,
        order_limit: PLAN_LIMITS.free.orderLimit
      });
      if (Array.isArray(created.data) && created.data[0]) {
        supaRow = created.data[0] as Record<string, unknown>;
      }
    }

    const subscription = buildMergedSubscriber(userRecord, supaRow);
    sendJson(res, 200, {
      ok: true,
      isAdmin: auth.isAdmin,
      subscription
    });
    return true;
  }

  // 2. Request plan upgrade (puts user into 'pending' approval)
  if (pathname === '/api/subscription/request' && method === 'POST') {
    const body = await readJsonBody(req);
    const planTier = String(body.planTier || '');
    if (!PLAN_LIMITS[planTier]) {
      sendJson(res, 400, { ok: false, error: 'Invalid subscription tier' });
      return true;
    }

    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? auth.user.public_metadata
      : {};
    if (currentMeta.planStatus === 'paused') {
      sendJson(res, 403, { ok: false, error: 'Account is currently paused by Studio Admin' });
      return true;
    }

    const nextMeta = {
      ...currentMeta,
      planTier,
      planStatus: 'pending',
      lastActiveAt: new Date().toISOString()
    };

    const clerkPatch = await clerkRequest<ClerkUserRecord>(
      `/users/${encodeURIComponent(auth.user.id)}/metadata`,
      { method: 'PATCH', body: JSON.stringify({ public_metadata: nextMeta }) }
    );
    if (!clerkPatch.ok) {
      sendJson(res, 500, { ok: false, error: 'Unable to save subscription request' });
      return true;
    }

    await syncUserSubscriptionRowToSupabase(auth.user.id, {
      email: getClerkPrimaryEmail(auth.user),
      plan_tier: planTier,
      plan_status: 'pending'
    });

    const subscription = buildMergedSubscriber(clerkPatch.data || auth.user, null);
    sendJson(res, 200, { ok: true, subscription });
    return true;
  }

  // 3. Track prompt copy or AI Auto Take redirect (blocks paused/pending users server-side!)
  if (pathname === '/api/telemetry/track' && method === 'POST') {
    const body = await readJsonBody(req);
    const currentMerged = buildMergedSubscriber(auth.user, null);

    if (!auth.isAdmin && currentMerged.plan_status !== 'active') {
      sendJson(res, 403, {
        ok: false,
        locked: true,
        status: currentMerged.plan_status,
        error: 'Prompt access is locked until approved by Studio Admin.'
      });
      return true;
    }

    const actionType = body.actionType === 'ai_redirect' ? 'ai_redirect' : 'copy';
    const pinId = body.pinId ? Number(body.pinId) : null;
    const pinTitle = String(body.pinTitle || 'Studio Prompt').slice(0, 120);
    const category = String(body.category || 'Studio').slice(0, 60);
    const aiTarget = body.aiTarget ? String(body.aiTarget).slice(0, 40) : null;
    const nowIso = new Date().toISOString();

    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? auth.user.public_metadata
      : {};
    const prevLogs = Array.isArray(currentMeta.recentPromptLogs) ? (currentMeta.recentPromptLogs as PromptLogEntry[]) : [];
    const newLog: PromptLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: auth.user.id,
      email: getClerkPrimaryEmail(auth.user),
      pin_id: pinId,
      pin_title: pinTitle,
      category,
      action_type: actionType,
      ai_target: aiTarget,
      created_at: nowIso
    };

    const nextCopyCount = (Number(currentMeta.promptCopyCount) || 0) + (actionType === 'copy' ? 1 : 0);
    const nextRedirectCount = (Number(currentMeta.aiRedirectCount) || 0) + (actionType === 'ai_redirect' ? 1 : 0);

    const nextMeta = {
      ...currentMeta,
      planTier: currentMerged.plan_tier,
      planStatus: currentMerged.plan_status,
      promptCopyCount: nextCopyCount,
      aiRedirectCount: nextRedirectCount,
      lastPromptTitle: pinTitle,
      lastActiveAt: nowIso,
      recentPromptLogs: [newLog, ...prevLogs].slice(0, 25)
    };

    await clerkRequest(`/users/${encodeURIComponent(auth.user.id)}/metadata`, {
      method: 'PATCH',
      body: JSON.stringify({ public_metadata: nextMeta })
    });

    sendJson(res, 200, {
      ok: true,
      promptCopyCount: nextCopyCount,
      aiRedirectCount: nextRedirectCount,
      lastPromptTitle: pinTitle
    });
    return true;
  }

  // 4. Admin Dashboard (Strictly yashrajart1999@gmail.com)
  if (pathname === '/api/admin/dashboard' && method === 'GET') {
    if (!auth.isAdmin) {
      sendJson(res, 403, { ok: false, error: `Admin access restricted to ${ADMIN_EMAIL}` });
      return true;
    }

    const [clerkUsersRes, subsRes, stylesRes, ordersRes] = await Promise.all([
      clerkRequest<ClerkUserRecord[]>('/users?limit=100&order_by=-last_active_at'),
      supaRest<Array<Record<string, unknown>>>('user_subscriptions?select=*'),
      supaRest<Array<{ id: number; user_id: string }>>('studio_styles?select=id,user_id'),
      supaRest<Array<{ order_num: string; user_id: string }>>('shop_orders?select=order_num,user_id')
    ]);

    if (!clerkUsersRes.ok || !Array.isArray(clerkUsersRes.data)) {
      sendJson(res, 500, { ok: false, error: 'Unable to fetch Clerk users directory' });
      return true;
    }

    const subMap = new Map<string, Record<string, unknown>>();
    if (Array.isArray(subsRes.data)) {
      for (const r of subsRes.data) {
        if (typeof r.user_id === 'string') subMap.set(r.user_id, r);
      }
    }

    const styleCounts: Record<string, number> = {};
    if (Array.isArray(stylesRes.data)) {
      for (const s of stylesRes.data) {
        styleCounts[s.user_id] = (styleCounts[s.user_id] || 0) + 1;
      }
    }

    const orderCounts: Record<string, number> = {};
    if (Array.isArray(ordersRes.data)) {
      for (const o of ordersRes.data) {
        orderCounts[o.user_id] = (orderCounts[o.user_id] || 0) + 1;
      }
    }

    const users = clerkUsersRes.data.map(cu =>
      buildMergedSubscriber(
        cu,
        subMap.get(cu.id) || null,
        styleCounts[cu.id] || 0,
        orderCounts[cu.id] || 0
      )
    );

    const allLogs: PromptLogEntry[] = [];
    for (const cu of clerkUsersRes.data) {
      const metaLogs = cu.public_metadata?.recentPromptLogs;
      if (Array.isArray(metaLogs)) {
        for (const item of metaLogs) {
          if (item && typeof item === 'object') {
            allLogs.push({
              ...(item as PromptLogEntry),
              user_id: cu.id,
              email: (item as PromptLogEntry).email || getClerkPrimaryEmail(cu)
            });
          }
        }
      }
    }
    allLogs.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));

    sendJson(res, 200, {
      ok: true,
      users,
      logs: allLogs.slice(0, 120)
    });
    return true;
  }

  // 5. Admin Approve / Pause / Change Tier / Save Note (Strictly yashrajart1999@gmail.com)
  if (pathname === '/api/admin/subscription' && method === 'POST') {
    if (!auth.isAdmin) {
      sendJson(res, 403, { ok: false, error: `Admin access restricted to ${ADMIN_EMAIL}` });
      return true;
    }

    const body = await readJsonBody(req);
    const targetUserId = String(body.targetUserId || '').trim();
    if (!targetUserId) {
      sendJson(res, 400, { ok: false, error: 'Missing targetUserId' });
      return true;
    }

    const targetRes = await clerkRequest<ClerkUserRecord>(`/users/${encodeURIComponent(targetUserId)}`);
    if (!targetRes.ok || !targetRes.data?.id) {
      sendJson(res, 404, { ok: false, error: 'Subscriber not found in Clerk' });
      return true;
    }

    const targetUser = targetRes.data;
    const isTargetAdmin = isClerkRecordAdmin(targetUser);
    const prevMeta = (targetUser.public_metadata && typeof targetUser.public_metadata === 'object')
      ? { ...targetUser.public_metadata }
      : {};

    const nextTier = (typeof body.plan_tier === 'string' && PLAN_LIMITS[body.plan_tier])
      ? body.plan_tier
      : (typeof prevMeta.planTier === 'string' && PLAN_LIMITS[prevMeta.planTier] ? prevMeta.planTier : 'free');
    const limits = PLAN_LIMITS[nextTier] || PLAN_LIMITS.free;

    let nextStatus = typeof prevMeta.planStatus === 'string'
      ? prevMeta.planStatus
      : (isTargetAdmin ? 'active' : 'pending');
    if (typeof body.plan_status === 'string' && ['active', 'paused', 'pending'].includes(body.plan_status)) {
      if (isTargetAdmin && body.plan_status === 'paused') {
        sendJson(res, 400, { ok: false, error: 'Admin account cannot be paused' });
        return true;
      }
      nextStatus = body.plan_status;
    }

    const nowIso = new Date().toISOString();
    const nextMeta: Record<string, unknown> = {
      ...prevMeta,
      planTier: nextTier,
      planStatus: nextStatus,
      styleLimit: limits.styleLimit,
      orderLimit: limits.orderLimit
    };

    if (body.plan_status === 'active') {
      nextMeta.approvedAt = nowIso;
    } else if (body.plan_status === 'paused') {
      nextMeta.pausedAt = nowIso;
    }

    if (typeof body.admin_note === 'string') {
      nextMeta.adminNote = body.admin_note.trim();
    }

    const clerkPatch = await clerkRequest<ClerkUserRecord>(
      `/users/${encodeURIComponent(targetUserId)}/metadata`,
      {
        method: 'PATCH',
        body: JSON.stringify({ public_metadata: nextMeta })
      }
    );

    if (!clerkPatch.ok) {
      sendJson(res, 500, { ok: false, error: 'Failed to update subscriber metadata in Clerk' });
      return true;
    }

    await syncUserSubscriptionRowToSupabase(targetUserId, {
      email: getClerkPrimaryEmail(targetUser),
      plan_tier: nextTier,
      plan_status: nextStatus,
      style_limit: limits.styleLimit,
      order_limit: limits.orderLimit
    });

    const row = buildMergedSubscriber(clerkPatch.data || targetUser, null);
    sendJson(res, 200, { ok: true, row });
    return true;
  }

  sendJson(res, 404, { ok: false, error: 'API route not found' });
  return true;
}
