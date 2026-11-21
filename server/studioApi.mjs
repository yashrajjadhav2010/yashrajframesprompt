import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ADMIN_EMAIL = 'yashrajart1999@gmail.com';
export const APPROVAL_WHATSAPP_NUMBER = '917588598293';

const PLAN_LIMITS = {
  free: { styleLimit: 25, orderLimit: 50 },
  studio_pro: { styleLimit: 1000, orderLimit: 5000 },
  enterprise: { styleLimit: 10000, orderLimit: 50000 }
};

function getReceiptsStorageDir() {
  const candidates = [
    path.join(process.cwd(), '.yashraj_receipts'),
    '/tmp/yashraj_receipts'
  ];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // Try next directory
    }
  }
  return '/tmp';
}

const RECEIPT_STORAGE_BUCKET = 'payment-receipts';
let receiptBucketEnsured = false;

function escapeHtmlSafe(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function verifyShareToken(expected, provided) {
  const a = String(expected || '').trim();
  const b = String(provided || '').trim();
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

async function ensureSupabaseReceiptBucket(cfg) {
  if (receiptBucketEnsured || !cfg.supabaseUrl || !cfg.supabaseSecretKey) return receiptBucketEnsured;
  try {
    const res = await fetch(`${cfg.supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseSecretKey,
        Authorization: `Bearer ${cfg.supabaseSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: RECEIPT_STORAGE_BUCKET,
        name: RECEIPT_STORAGE_BUCKET,
        public: false,
        file_size_limit: 3145728
      })
    });
    if (res.ok || res.status === 409) {
      receiptBucketEnsured = true;
    }
  } catch {
    // Non-fatal; disk fallback still works
  }
  return receiptBucketEnsured;
}

async function uploadReceiptToSupabaseStorage(safeId, ext, mime, buf, metaObj) {
  const cfg = getEnvConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseSecretKey) return false;
  try {
    await ensureSupabaseReceiptBucket(cfg);
    const headersBase = {
      apikey: cfg.supabaseSecretKey,
      Authorization: `Bearer ${cfg.supabaseSecretKey}`,
      'x-upsert': 'true'
    };
    const [imgRes, metaRes] = await Promise.all([
      fetch(`${cfg.supabaseUrl}/storage/v1/object/${RECEIPT_STORAGE_BUCKET}/${encodeURIComponent(safeId)}.${ext}`, {
        method: 'POST',
        headers: { ...headersBase, 'Content-Type': mime },
        body: buf
      }),
      fetch(`${cfg.supabaseUrl}/storage/v1/object/${RECEIPT_STORAGE_BUCKET}/${encodeURIComponent(safeId)}.json`, {
        method: 'POST',
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify(metaObj)
      })
    ]);
    return imgRes.ok && metaRes.ok;
  } catch {
    return false;
  }
}

async function readReceiptFromSupabaseStorage(safeId) {
  const cfg = getEnvConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseSecretKey) return null;
  try {
    const headers = {
      apikey: cfg.supabaseSecretKey,
      Authorization: `Bearer ${cfg.supabaseSecretKey}`
    };
    const metaRes = await fetch(
      `${cfg.supabaseUrl}/storage/v1/object/${RECEIPT_STORAGE_BUCKET}/${encodeURIComponent(safeId)}.json`,
      { headers }
    );
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    const ext = ['jpeg', 'png', 'webp'].includes(meta?.ext) ? meta.ext : 'jpeg';
    const imgRes = await fetch(
      `${cfg.supabaseUrl}/storage/v1/object/${RECEIPT_STORAGE_BUCKET}/${encodeURIComponent(safeId)}.${ext}`,
      { headers }
    );
    if (!imgRes.ok) return null;
    const arrayBuf = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    try {
      const dir = getReceiptsStorageDir();
      fs.writeFileSync(path.join(dir, `${safeId}.${ext}`), buffer);
      fs.writeFileSync(path.join(dir, `${safeId}.json`), JSON.stringify(meta));
    } catch {
      // Ignore cache write error
    }
    return { meta, buffer };
  } catch {
    return null;
  }
}

async function savePaymentReceiptImage(requestId, ownerUserId, receiptDataUrl, details = {}) {
  const raw = String(receiptDataUrl || '').trim();
  const match = raw.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return { ok: false, error: 'Invalid payment receipt image. Please upload a JPG, PNG, or WebP screenshot.' };
  }
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
  const mime = `image/${ext}`;
  const b64 = match[2].replace(/\s+/g, '');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.length < 120) {
    return { ok: false, error: 'Payment receipt image appears empty or corrupted.' };
  }
  if (buf.length > 2.2 * 1024 * 1024) {
    return { ok: false, error: 'Payment receipt image is too large (max 2 MB).' };
  }
  const safeId = String(requestId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  if (!safeId) {
    return { ok: false, error: 'Invalid receipt reference ID.' };
  }
  const shareToken = crypto.randomBytes(16).toString('hex');
  const metaObj = {
    requestId: safeId,
    ownerUserId: String(ownerUserId || ''),
    shareToken,
    planTier: String(details.planTier || 'studio_pro'),
    userName: String(details.userName || '').slice(0, 80),
    userEmail: String(details.userEmail || '').slice(0, 120),
    utrRef: String(details.utrRef || '').slice(0, 80),
    payerNote: String(details.payerNote || '').slice(0, 180),
    fileName: String(details.fileName || 'payment-receipt.jpg').slice(0, 80),
    mime,
    ext,
    sizeBytes: buf.length,
    savedAt: new Date().toISOString()
  };

  let diskSaved = false;
  try {
    const dir = getReceiptsStorageDir();
    fs.writeFileSync(path.join(dir, `${safeId}.${ext}`), buf);
    fs.writeFileSync(path.join(dir, `${safeId}.json`), JSON.stringify(metaObj));
    diskSaved = true;
  } catch (err) {
    console.warn('[Yashraj Studio API] Could not write receipt to disk:', err?.message || err);
  }

  const cloudSaved = await uploadReceiptToSupabaseStorage(safeId, ext, mime, buf, metaObj);
  return { ok: true, mime, ext, sizeBytes: buf.length, shareToken, diskSaved, cloudSaved };
}

async function readPaymentReceiptImage(requestId) {
  const safeId = String(requestId || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,48}$/.test(safeId)) return null;
  const dirs = [
    path.join(process.cwd(), '.yashraj_receipts'),
    '/tmp/yashraj_receipts'
  ];
  for (const dir of dirs) {
    try {
      const metaPath = path.join(dir, `${safeId}.json`);
      if (!fs.existsSync(metaPath)) continue;
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const ext = ['jpeg', 'png', 'webp'].includes(meta?.ext) ? meta.ext : 'jpeg';
      const imgPath = path.join(dir, `${safeId}.${ext}`);
      if (!fs.existsSync(imgPath)) continue;
      const buffer = fs.readFileSync(imgPath);
      return { meta, buffer };
    } catch {
      // Try next dir
    }
  }
  return await readReceiptFromSupabaseStorage(safeId);
}

let cachedEnv = null;
let cachedJwks = { fetchedAt: 0, keys: [] };
let cachedAdminDir = { fetchedAt: 0, ids: null, pinBadges: {} };

const VALID_BADGE_TONES = new Set(['crimson', 'amazon', 'flipkart', 'gold', 'emerald', 'violet']);

function normalizeSpotlightBadgeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const rawLabel = typeof entry.label === 'string'
    ? entry.label
    : (typeof entry.l === 'string' ? entry.l : '');
  const cleanLabel = rawLabel
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  if (!cleanLabel) return null;
  const rawTone = String(entry.tone || entry.t || 'crimson').trim().toLowerCase();
  const cleanTone = VALID_BADGE_TONES.has(rawTone) ? rawTone : 'crimson';
  return { l: cleanLabel, t: cleanTone };
}

function compactPinBadgesMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  const keys = Object.keys(raw).slice(-140);
  for (const key of keys) {
    const cleanId = String(key || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(cleanId)) continue;
    const norm = normalizeSpotlightBadgeEntry(raw[key]);
    if (norm) out[cleanId] = norm;
  }
  return out;
}

function expandPinBadgesMap(raw) {
  const compact = compactPinBadgesMap(raw);
  const expanded = {};
  for (const [pinId, entry] of Object.entries(compact)) {
    expanded[pinId] = { label: entry.l, tone: entry.t };
  }
  return expanded;
}

function readDotEnvFiles() {
  const result = {};
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

function getEnvConfig() {
  if (cachedEnv && cachedEnv.clerkSecretKey && cachedEnv.supabaseUrl && cachedEnv.supabaseSecretKey) {
    return cachedEnv;
  }
  const fileEnv = readDotEnvFiles();
  const pick = (keys) => {
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

function base64UrlDecode(str) {
  let b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return Buffer.from(b64, 'base64');
}

function deriveClerkFrontendDomain(publishableKey) {
  const parts = String(publishableKey || '').trim().split('_');
  if (parts.length < 3) return '';
  try {
    const decoded = base64UrlDecode(parts.slice(2).join('_')).toString('utf8').trim();
    return decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
  } catch {
    return '';
  }
}

async function getClerkJwks(forceRefresh = false, issuerUrl = '') {
  const now = Date.now();
  if (!forceRefresh && cachedJwks.keys.length > 0 && now - cachedJwks.fetchedAt < 10 * 60 * 1000) {
    return cachedJwks.keys;
  }
  const cfg = getEnvConfig();
  let keys = [];

  if (cfg.clerkSecretKey) {
    try {
      const res = await fetch('https://api.clerk.com/v1/jwks', {
        headers: { Authorization: `Bearer ${cfg.clerkSecretKey}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.keys)) keys = json.keys;
      }
    } catch {
      // fall through to issuer / domain JWKS
    }
  }

  if (keys.length === 0 && issuerUrl && /^https:\/\/[^/]+/i.test(issuerUrl)) {
    try {
      const cleanIss = issuerUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanIss}/.well-known/jwks.json`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.keys)) keys = json.keys;
      }
    } catch {
      // fall through
    }
  }

  if (keys.length === 0 && cfg.clerkPublishableKey) {
    const domain = deriveClerkFrontendDomain(cfg.clerkPublishableKey);
    if (domain) {
      try {
        const res = await fetch(`https://${domain}/.well-known/jwks.json`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.keys)) keys = json.keys;
        }
      } catch {
        // ignore
      }
    }
  }

  if (keys.length > 0) {
    cachedJwks = { fetchedAt: now, keys };
  }
  return keys;
}

async function verifyClerkJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { ok: false, reason: 'Malformed session token' };

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  } catch {
    return { ok: false, reason: 'Unable to decode session token' };
  }

  if (!payload?.sub) return { ok: false, reason: 'Session token missing subject' };
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < nowSec - 60) {
    return { ok: false, reason: 'Session token expired — please sign in again' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf > nowSec + 60) {
    return { ok: false, reason: 'Session token not active yet' };
  }

  const issuerUrl = typeof payload.iss === 'string' ? payload.iss : '';
  let keys = await getClerkJwks(false, issuerUrl);
  let jwk = keys.find(k => !header.kid || k.kid === header.kid);
  if (!jwk) {
    keys = await getClerkJwks(true, issuerUrl);
    jwk = keys.find(k => !header.kid || k.kid === header.kid);
  }
  if (!jwk) return { ok: false, reason: 'Unable to fetch Clerk JWKS verification keys' };

  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);
    const valid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
    if (!valid) return { ok: false, reason: 'Invalid session token signature' };
    return { ok: true, sub: String(payload.sub) };
  } catch {
    return { ok: false, reason: 'JWT signature verification error' };
  }
}

function getClerkPrimaryEmail(user) {
  const list = Array.isArray(user?.email_addresses) ? user.email_addresses : [];
  const primary = list.find(e => e.id === user.primary_email_address_id) || list[0];
  return (primary?.email_address || '').trim();
}

function isClerkRecordAdmin(user) {
  const target = ADMIN_EMAIL.toLowerCase();
  const list = Array.isArray(user?.email_addresses) ? user.email_addresses : [];
  return list.some(e => typeof e?.email_address === 'string' && e.email_address.trim().toLowerCase() === target);
}

function getClerkDisplayName(user) {
  const full = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user?.username) return user.username;
  const email = getClerkPrimaryEmail(user);
  return email ? email.split('@')[0] : 'Studio Member';
}

async function clerkRequest(endpoint, init = {}) {
  const cfg = getEnvConfig();
  if (!cfg.clerkSecretKey) {
    return { ok: false, status: 500, data: { error: 'CLERK_SECRET_KEY is not configured on the server' } };
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
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function supaRest(tablePath, options = {}) {
  const cfg = getEnvConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseSecretKey) {
    return { ok: false, status: 500, data: null, error: 'SUPABASE_SECRET_KEY or VITE_SUPABASE_URL not configured on server' };
  }
  const headers = {
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
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const errMsg = (parsed && typeof parsed === 'object' && 'message' in parsed)
      ? String(parsed.message)
      : `HTTP ${res.status}`;
    return { ok: false, status: res.status, data: null, error: errMsg };
  }
  return { ok: true, status: res.status, data: parsed };
}

function mapStatusForLegacySupabaseConstraint(status) {
  if (status === 'paused') return 'canceled';
  if (status === 'pending') return 'trialing';
  return status;
}

function mapSupabaseStatusBack(supaStatus, metaStatus, isAdmin = false) {
  if (isAdmin) return 'active';
  if (typeof metaStatus === 'string' && ['active', 'paused', 'pending'].includes(metaStatus)) {
    return metaStatus;
  }
  if (metaStatus === 'trialing') return 'pending';
  if (metaStatus === 'canceled' || metaStatus === 'past_due') return 'paused';
  if (supaStatus === 'canceled' || supaStatus === 'past_due') return 'paused';
  if (supaStatus === 'trialing' || supaStatus === 'pending') return 'pending';
  return 'pending';
}

const VALIDITY_PRESET_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365
};

function resolveValidityUpdate(body, prevMeta = {}, isTargetAdmin = false) {
  if (isTargetAdmin) {
    return { provided: true, expiresAt: null, validityLabel: 'Lifetime (Admin)', validityPreset: 'lifetime' };
  }

  const preset = typeof body?.validity_preset === 'string' ? body.validity_preset.trim() : '';
  if (preset === 'lifetime') {
    return { provided: true, expiresAt: null, validityLabel: 'Lifetime', validityPreset: 'lifetime' };
  }
  if (VALIDITY_PRESET_DAYS[preset]) {
    const days = VALIDITY_PRESET_DAYS[preset];
    const labelMap = { '7d': '7-Day Trial', '30d': '30 Days', '90d': '90 Days', '365d': '1 Year' };
    return {
      provided: true,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      validityLabel: labelMap[preset] || `${days} Days`,
      validityPreset: preset
    };
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'access_expires_at')) {
    const rawExp = body.access_expires_at;
    if (rawExp === null || rawExp === '') {
      return { provided: true, expiresAt: null, validityLabel: 'Lifetime', validityPreset: 'lifetime' };
    }
    if (typeof rawExp === 'string') {
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(rawExp.trim())
        ? `${rawExp.trim()}T23:59:59.999Z`
        : rawExp.trim();
      const ms = Date.parse(normalized);
      if (!Number.isNaN(ms)) {
        return {
          provided: true,
          expiresAt: new Date(ms).toISOString(),
          validityLabel: 'Custom Date',
          validityPreset: 'custom'
        };
      }
    }
  }

  // If approving an expired user without specifying a new validity, clear stale expiry to Lifetime
  if (body?.plan_status === 'active' && typeof prevMeta.accessExpiresAt === 'string') {
    const prevMs = Date.parse(prevMeta.accessExpiresAt);
    if (!Number.isNaN(prevMs) && prevMs <= Date.now()) {
      return { provided: true, expiresAt: null, validityLabel: 'Lifetime', validityPreset: 'lifetime' };
    }
  }

  return { provided: false };
}

function buildMergedSubscriber(clerkUser, supaRow = null, styleCount = 0, orderCount = 0) {
  const meta = (clerkUser?.public_metadata && typeof clerkUser.public_metadata === 'object')
    ? clerkUser.public_metadata
    : {};
  const email = getClerkPrimaryEmail(clerkUser) || (typeof supaRow?.email === 'string' ? supaRow.email : '');
  const fullName = getClerkDisplayName(clerkUser);
  const tier = (typeof meta.planTier === 'string' && PLAN_LIMITS[meta.planTier])
    ? meta.planTier
    : ((typeof supaRow?.plan_tier === 'string' && PLAN_LIMITS[supaRow.plan_tier]) ? supaRow.plan_tier : 'free');
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
  const isTargetAdmin = isClerkRecordAdmin(clerkUser);
  const baseStatus = mapSupabaseStatusBack(
    typeof supaRow?.plan_status === 'string' ? supaRow.plan_status : undefined,
    meta.planStatus,
    isTargetAdmin
  );

  const hasExplicitNullExpiry = meta.accessExpiresAt === null;
  const rawExpiresAt = isTargetAdmin || hasExplicitNullExpiry
    ? null
    : ((typeof meta.accessExpiresAt === 'string' && meta.accessExpiresAt)
      ? meta.accessExpiresAt
      : (typeof supaRow?.current_period_end === 'string' && supaRow.current_period_end ? supaRow.current_period_end : null));

  const expiresMs = rawExpiresAt ? Date.parse(rawExpiresAt) : NaN;
  const isPastExpiry = !isTargetAdmin && Boolean(rawExpiresAt) && Number.isFinite(expiresMs) && expiresMs <= Date.now();
  const isExpired = isPastExpiry && baseStatus === 'active';
  const effectiveStatus = isExpired ? 'pending' : baseStatus;

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
    Number(clerkUser?.last_active_at) || 0,
    Number(clerkUser?.last_sign_in_at) || 0,
    Number(clerkUser?.created_at) || 0
  );

  return {
    user_id: clerkUser.id,
    email,
    full_name: fullName,
    avatar_url: clerkUser.image_url || '',
    plan_tier: tier,
    plan_status: effectiveStatus,
    is_expired: isExpired,
    access_expires_at: rawExpiresAt,
    current_period_end: rawExpiresAt,
    validity_preset: isTargetAdmin ? 'lifetime' : (typeof meta.validityPreset === 'string' ? meta.validityPreset : (rawExpiresAt ? 'custom' : 'lifetime')),
    validity_label: isTargetAdmin ? 'Lifetime (Admin)' : (typeof meta.validityLabel === 'string' && meta.validityLabel ? meta.validityLabel : (rawExpiresAt ? 'Timed Access' : 'Lifetime')),
    style_limit: Number(supaRow?.style_limit) || limits.styleLimit,
    order_limit: Number(supaRow?.order_limit) || limits.orderLimit,
    prompt_copy_count: copyCount,
    ai_redirect_count: redirectCount,
    free_trial_used: Number(meta.freeTrialUsed) || 0,
    last_prompt_title: (typeof meta.lastPromptTitle === 'string' ? meta.lastPromptTitle : '') || (typeof supaRow?.last_prompt_title === 'string' ? supaRow.last_prompt_title : ''),
    last_active_at: lastActiveMs ? new Date(lastActiveMs).toISOString() : new Date().toISOString(),
    created_at: clerkUser.created_at ? new Date(clerkUser.created_at).toISOString() : (typeof supaRow?.created_at === 'string' ? supaRow.created_at : new Date().toISOString()),
    admin_note: (typeof meta.adminNote === 'string' ? meta.adminNote : '') || (typeof supaRow?.admin_note === 'string' ? supaRow.admin_note : ''),
    approved_at: (typeof meta.approvedAt === 'string' ? meta.approvedAt : null) || (typeof supaRow?.approved_at === 'string' ? supaRow.approved_at : null),
    paused_at: (typeof meta.pausedAt === 'string' ? meta.pausedAt : null) || (typeof supaRow?.paused_at === 'string' ? supaRow.paused_at : null),
    payment_proof: (meta.paymentProof && typeof meta.paymentProof === 'object') ? meta.paymentProof : null,
    customStyleCount: styleCount,
    shopOrderCount: orderCount
  };
}

async function syncUserSubscriptionRowToSupabase(userId, payload) {
  const row = {
    user_id: userId,
    updated_at: new Date().toISOString()
  };
  if (payload.email !== undefined) row.email = payload.email;
  if (payload.plan_tier !== undefined) row.plan_tier = payload.plan_tier;
  if (payload.plan_status !== undefined) row.plan_status = payload.plan_status;
  if (payload.style_limit !== undefined) row.style_limit = payload.style_limit;
  if (payload.order_limit !== undefined) row.order_limit = payload.order_limit;
  if (payload.current_period_end !== undefined) row.current_period_end = payload.current_period_end;

  const firstAttempt = await supaRest('user_subscriptions?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: row
  });
  if (firstAttempt.ok) return firstAttempt;

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

async function readJsonBody(req) {
  const preParsed = req?.body;
  if (preParsed && typeof preParsed === 'object' && !Buffer.isBuffer(preParsed)) {
    return preParsed;
  }
  if (typeof preParsed === 'string') {
    try {
      return preParsed.trim() ? JSON.parse(preParsed) : {};
    } catch {
      return {};
    }
  }
  if (req?.readableEnded) {
    return {};
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
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

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', extraHeaders['Cache-Control'] || 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (k.toLowerCase() !== 'cache-control' && v !== undefined) {
      res.setHeader(k, v);
    }
  }
  res.end(JSON.stringify(data));
}

async function authenticateRequest(req) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const verified = await verifyClerkJwt(token);
  if (!verified.ok) {
    return { ok: false, status: 401, error: verified.reason || 'Invalid Clerk session token' };
  }

  const clerkRes = await clerkRequest(`/users/${encodeURIComponent(verified.sub)}`);
  if (!clerkRes.ok || !clerkRes.data?.id) {
    return {
      ok: false,
      status: clerkRes.status >= 400 ? clerkRes.status : 500,
      error: clerkRes.data?.error || clerkRes.data?.errors?.[0]?.message || 'Unable to verify user with Clerk API (check CLERK_SECRET_KEY)'
    };
  }

  return {
    ok: true,
    user: clerkRes.data,
    isAdmin: isClerkRecordAdmin(clerkRes.data)
  };
}

async function resolveAdminDirectory(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAdminDir.ids && now - cachedAdminDir.fetchedAt < 60 * 1000) {
    return cachedAdminDir;
  }
  const res = await clerkRequest(`/users?email_address[]=${encodeURIComponent(ADMIN_EMAIL)}&limit=10`);
  if (res.ok && Array.isArray(res.data)) {
    const ids = new Set(res.data.map(u => u.id).filter(Boolean));
    let mergedBadges = {};
    for (const adminUser of res.data) {
      const metaBadges = adminUser?.public_metadata?.pinBadges;
      if (metaBadges && typeof metaBadges === 'object') {
        mergedBadges = { ...mergedBadges, ...compactPinBadgesMap(metaBadges) };
      }
    }
    cachedAdminDir = { fetchedAt: now, ids, pinBadges: mergedBadges };
    return cachedAdminDir;
  }
  return cachedAdminDir;
}

async function resolveAdminUserIds() {
  const dir = await resolveAdminDirectory(false);
  return dir.ids || null;
}

function mapDbStyleToClient(row, includePrompt) {
  if (!row) return null;
  const img = row.reference_image || row.thumbnail || 'assets/prompts/01.jpeg';
  const distinctThumb = row.thumbnail && row.thumbnail !== img ? row.thumbnail : undefined;
  return {
    id: Number(row.id),
    title: row.title || 'Untitled Style',
    category: row.category || 'Other',
    prompt: includePrompt ? (row.prompt || '') : '',
    promptLocked: !includePrompt,
    referenceImage: img,
    ...(distinctThumb ? { thumbnail: distinctThumb } : {}),
    aspectRatio: row.aspect_ratio || '2:3',
    description: row.description || `${row.category || 'Studio'} photography with studio lighting`,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isCustom: true,
    createdAt: row.created_at || new Date().toISOString()
  };
}

export async function handleStudioApiRequest(req, res) {
  const rawUrl = req.url || '/';
  const pathname = rawUrl.split('?')[0];
  if (!pathname.startsWith('/api/')) return false;

  const method = (req.method || 'GET').toUpperCase();

  if (pathname === '/api/health' && method === 'GET') {
    const cfg = getEnvConfig();
    sendJson(res, 200, {
      ok: true,
      clerkReady: Boolean(cfg.clerkSecretKey),
      clerkPublishableReady: Boolean(cfg.clerkPublishableKey),
      supabaseReady: Boolean(cfg.supabaseUrl && cfg.supabaseSecretKey),
      platform: process.env.VERCEL ? 'vercel' : 'node'
    });
    return true;
  }

  if (pathname === '/api/pin-badges' && method === 'GET') {
    const dir = await resolveAdminDirectory(false);
    sendJson(res, 200, {
      ok: true,
      badges: expandPinBadgesMap(dir.pinBadges)
    });
    return true;
  }

  // Signed public payment receipt image (for WhatsApp link preview & direct Admin viewing from WhatsApp chat)
  const publicReceiptImgMatch = pathname.match(/^\/api\/receipt-image\/([a-zA-Z0-9_-]{8,48})\/([a-f0-9]{16,64})$/i);
  if (publicReceiptImgMatch && method === 'GET') {
    const reqId = publicReceiptImgMatch[1];
    const token = publicReceiptImgMatch[2];
    const found = await readPaymentReceiptImage(reqId);
    if (!found) {
      sendJson(res, 404, { ok: false, error: 'Payment receipt not found.' });
      return true;
    }
    if (!verifyShareToken(found.meta?.shareToken, token)) {
      sendJson(res, 403, { ok: false, error: 'Invalid receipt share token.' });
      return true;
    }
    const ext = ['jpeg', 'png', 'webp'].includes(found.meta?.ext) ? found.meta.ext : 'jpeg';
    res.statusCode = 200;
    res.setHeader('Content-Type', found.meta?.mime || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${reqId}.${ext}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(found.buffer);
    return true;
  }

  // Signed public payment receipt viewer page with OpenGraph og:image preview card for WhatsApp
  const publicReceiptPageMatch = pathname.match(/^\/api\/receipt-proof\/([a-zA-Z0-9_-]{8,48})\/([a-f0-9]{16,64})$/i);
  if (publicReceiptPageMatch && method === 'GET') {
    const reqId = publicReceiptPageMatch[1];
    const token = publicReceiptPageMatch[2];
    const found = await readPaymentReceiptImage(reqId);
    if (!found) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html><body style="background:#0f0e0c;color:#f5f2eb;font-family:system-ui;padding:32px;text-align:center;"><h2>Receipt Not Found</h2><p>This payment receipt link is no longer available.</p></body></html>');
      return true;
    }
    if (!verifyShareToken(found.meta?.shareToken, token)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html><body style="background:#0f0e0c;color:#f5f2eb;font-family:system-ui;padding:32px;text-align:center;"><h2>Invalid Receipt Link</h2></body></html>');
      return true;
    }
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
    const origin = `${proto}://${host}`;
    const imgUrl = `${origin}/api/receipt-image/${encodeURIComponent(reqId)}/${encodeURIComponent(token)}`;
    const pageUrl = `${origin}/api/receipt-proof/${encodeURIComponent(reqId)}/${encodeURIComponent(token)}`;
    const planLabel = found.meta?.planTier === 'enterprise' ? 'Multi-Branch Enterprise (₹1,299/mo)' : 'Yashraj Pro Studio (₹499/mo)';
    const ogTitle = `Payment Receipt · ${reqId} · Yashraj Frames Studio`;
    const ogDesc = `${planLabel}${found.meta?.userName ? ` · ${found.meta.userName}` : ''}${found.meta?.utrRef ? ` · UTR: ${found.meta.utrRef}` : ''}`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlSafe(ogTitle)}</title>
  <meta name="description" content="${escapeHtmlSafe(ogDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtmlSafe(ogTitle)}" />
  <meta property="og:description" content="${escapeHtmlSafe(ogDesc)}" />
  <meta property="og:url" content="${escapeHtmlSafe(pageUrl)}" />
  <meta property="og:image" content="${escapeHtmlSafe(imgUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtmlSafe(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtmlSafe(ogDesc)}" />
  <meta name="twitter:image" content="${escapeHtmlSafe(imgUrl)}" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #0d0c0a; color: #f5f2eb; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 560px; background: #171512; border: 1px solid rgba(212,175,55,0.35); border-radius: 18px; padding: 22px; box-shadow: 0 24px 64px rgba(0,0,0,0.65); }
    .top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; }
    .badge { padding: 4px 10px; border-radius: 8px; background: rgba(37,211,102,0.16); border: 1px solid rgba(37,211,102,0.42); color: #86efac; font-size: 12px; font-weight: 700; }
    .reqid { font-family: ui-monospace, monospace; font-size: 12px; color: #f4d272; font-weight: 700; }
    h1 { margin: 0 0 10px; font-size: 20px; color: #fffdf7; }
    .meta { display: grid; gap: 6px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); font-size: 13px; color: #d6d0c4; margin-bottom: 14px; }
    .meta strong { color: #ffffff; }
    .img-wrap { background: #070706; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); padding: 8px; text-align: center; margin-bottom: 14px; }
    img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn { flex: 1 1 180px; text-align: center; padding: 12px 16px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg,#25d366,#16a34a); color: #052010; }
    .btn-secondary { background: rgba(212,175,55,0.14); border: 1px solid rgba(212,175,55,0.42); color: #f4d272; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <span class="badge">YASHRAJ FRAMES · PAYMENT RECEIPT</span>
      <span class="reqid">${escapeHtmlSafe(reqId)}</span>
    </div>
    <h1>Pro Upgrade Payment Proof</h1>
    <div class="meta">
      <div>Plan: <strong>${escapeHtmlSafe(planLabel)}</strong></div>
      ${found.meta?.userName ? `<div>Customer: <strong>${escapeHtmlSafe(found.meta.userName)}</strong></div>` : ''}
      ${found.meta?.userEmail ? `<div>Account Email: <strong>${escapeHtmlSafe(found.meta.userEmail)}</strong></div>` : ''}
      ${found.meta?.utrRef ? `<div>UTR / Ref ID: <strong>${escapeHtmlSafe(found.meta.utrRef)}</strong></div>` : ''}
      ${found.meta?.payerNote ? `<div>Note: <strong>${escapeHtmlSafe(found.meta.payerNote)}</strong></div>` : ''}
      ${found.meta?.savedAt ? `<div>Submitted: <strong>${escapeHtmlSafe(new Date(found.meta.savedAt).toLocaleString('en-IN'))}</strong></div>` : ''}
    </div>
    <div class="img-wrap">
      <img src="${escapeHtmlSafe(imgUrl)}" alt="Payment receipt screenshot for ${escapeHtmlSafe(reqId)}" />
    </div>
    <div class="actions">
      <a class="btn btn-primary" href="${escapeHtmlSafe(imgUrl)}" download="${escapeHtmlSafe(reqId)}.${escapeHtmlSafe(found.meta?.ext || 'jpg')}">Download Receipt Image</a>
      <a class="btn btn-secondary" href="${escapeHtmlSafe(origin)}/#admin">Open Admin Panel</a>
    </div>
  </div>
</body>
</html>`);
    return true;
  }

  // Public shared Studio Styles catalog (Paginated to prevent loading all cards/images at once):
  // Visual cards are visible to ALL users; prompts are included ONLY for Admin or approved active subscribers.
  if (pathname === '/api/styles' && method === 'GET') {
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const rawLimit = Number(parsedUrl.searchParams.get('limit'));
    const rawOffset = Number(parsedUrl.searchParams.get('offset'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 48) : 12;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
    const category = String(parsedUrl.searchParams.get('category') || '').trim();
    const searchQ = String(parsedUrl.searchParams.get('q') || '').trim();
    const styleId = String(parsedUrl.searchParams.get('id') || '').trim();

    let canAccessPrompts = false;
    const authHeader = String(req.headers.authorization || '');
    if (authHeader.startsWith('Bearer ')) {
      const maybeAuth = await authenticateRequest(req);
      if (maybeAuth.ok) {
        if (maybeAuth.isAdmin) {
          canAccessPrompts = true;
        } else {
          const subRes = await supaRest(
            `user_subscriptions?user_id=eq.${encodeURIComponent(maybeAuth.user.id)}&select=plan_status,current_period_end`
          );
          const supaRow = Array.isArray(subRes.data) && subRes.data[0] ? subRes.data[0] : null;
          const merged = buildMergedSubscriber(maybeAuth.user, supaRow);
          canAccessPrompts = merged.plan_status === 'active';
        }
      }
    }

    const adminDir = await resolveAdminDirectory(false);
    const adminIds = adminDir.ids || null;
    const pinBadges = expandPinBadgesMap(adminDir.pinBadges);
    const selectFields = canAccessPrompts
      ? 'id,user_id,title,category,prompt,reference_image,thumbnail,aspect_ratio,description,tags,is_custom,created_at'
      : 'id,user_id,title,category,reference_image,thumbnail,aspect_ratio,description,tags,is_custom,created_at';

    const queryParts = [
      `select=${selectFields}`,
      'order=created_at.desc',
      `limit=${styleId ? 1 : limit + 1}`,
      `offset=${styleId ? 0 : offset}`
    ];

    if (adminIds && adminIds.size > 0) {
      const safeIds = Array.from(adminIds).filter(id => /^[a-zA-Z0-9_-]+$/.test(id));
      if (safeIds.length === 1) {
        queryParts.push(`user_id=eq.${encodeURIComponent(safeIds[0])}`);
      } else if (safeIds.length > 1) {
        queryParts.push(`user_id=in.(${safeIds.join(',')})`);
      }
    }

    if (styleId && /^[a-zA-Z0-9_-]{1,64}$/.test(styleId)) {
      queryParts.push(`id=eq.${encodeURIComponent(styleId)}`);
    } else {
      if (category && category.toLowerCase() !== 'all') {
        queryParts.push(`category=eq.${encodeURIComponent(category)}`);
      }

      if (searchQ) {
        const cleanQ = searchQ.replace(/[*(),]/g, ' ').trim();
        if (cleanQ) {
          queryParts.push(`or=(title.ilike.*${encodeURIComponent(cleanQ)}*,category.ilike.*${encodeURIComponent(cleanQ)}*,description.ilike.*${encodeURIComponent(cleanQ)}*)`);
        }
      }
    }

    const stylesRes = await supaRest(`studio_styles?${queryParts.join('&')}`);
    const cacheHeaders = !authHeader
      ? { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
      : { 'Cache-Control': 'private, no-store' };

    if (!stylesRes.ok || !Array.isArray(stylesRes.data)) {
      sendJson(res, 200, {
        ok: true,
        styles: [],
        pinBadges,
        hasMore: false,
        nextOffset: offset,
        limit,
        offset,
        promptUnlocked: canAccessPrompts
      }, cacheHeaders);
      return true;
    }

    const filteredRows = (adminIds && adminIds.size > 0)
      ? stylesRes.data.filter(r => adminIds.has(r.user_id))
      : stylesRes.data;

    const hasMore = filteredRows.length > limit;
    const slicedRows = hasMore ? filteredRows.slice(0, limit) : filteredRows;
    const styles = slicedRows
      .map(r => mapDbStyleToClient(r, canAccessPrompts))
      .filter(Boolean);

    sendJson(res, 200, {
      ok: true,
      styles,
      pinBadges,
      hasMore,
      nextOffset: offset + slicedRows.length,
      limit,
      offset,
      promptUnlocked: canAccessPrompts
    }, cacheHeaders);
    return true;
  }

  // Free-trial on-demand prompt unlock (requires signed-in Clerk account, called after completing the 21s unskippable ad)
  if (pathname === '/api/trial/unlock-prompt' && method === 'POST') {
    const FREE_TRIAL_LIMIT = 5;
    const trialAuth = await authenticateRequest(req);
    if (!trialAuth.ok || !trialAuth.user) {
      sendJson(res, 401, {
        ok: false,
        requiresSignIn: true,
        error: 'Sign in required to use your 5 Free Trial prompts.'
      });
      return true;
    }

    const body = await readJsonBody(req);
    const styleId = String(body?.styleId ?? '').trim();
    const actionType = body?.actionType === 'ai_redirect' ? 'ai_redirect' : 'copy';
    const aiTarget = body?.aiTarget ? String(body.aiTarget).slice(0, 40) : null;

    if (!styleId || !/^[a-zA-Z0-9_-]{1,64}$/.test(styleId)) {
      sendJson(res, 400, { ok: false, error: 'Valid styleId is required.' });
      return true;
    }

    const authedUser = trialAuth.user;
    let isPaidUser = Boolean(trialAuth.isAdmin);
    let freeTrialUsed = null;

    if (!isPaidUser) {
      const subRes = await supaRest(
        `user_subscriptions?user_id=eq.${encodeURIComponent(authedUser.id)}&select=plan_status,current_period_end`
      );
      const supaRow = Array.isArray(subRes.data) && subRes.data[0] ? subRes.data[0] : null;
      const merged = buildMergedSubscriber(authedUser, supaRow);
      if (merged.plan_status === 'active') {
        isPaidUser = true;
      } else if (merged.plan_status === 'paused' || merged.is_expired) {
        sendJson(res, 403, {
          ok: false,
          locked: true,
          status: merged.plan_status,
          error: merged.is_expired
            ? 'Your access validity period has expired. Please contact Studio Admin to renew.'
            : 'Prompt access is currently paused by Studio Admin.'
        });
        return true;
      } else {
        const currentMeta = (authedUser.public_metadata && typeof authedUser.public_metadata === 'object')
          ? authedUser.public_metadata
          : {};
        const usedSoFar = Number(currentMeta.freeTrialUsed) || 0;
        if (usedSoFar >= FREE_TRIAL_LIMIT) {
          sendJson(res, 403, {
            ok: false,
            trialExhausted: true,
            freeTrialUsed: usedSoFar,
            error: 'All 5 free trial prompt unlocks have been used. Request Yashraj Pro approval for unlimited access.'
          });
          return true;
        }
        freeTrialUsed = usedSoFar;
      }
    }

    const adminDir = await resolveAdminDirectory(false);
    const adminIds = adminDir.ids || null;
    const styleRes = await supaRest(
      `studio_styles?id=eq.${encodeURIComponent(styleId)}&select=id,user_id,title,category,prompt&limit=1`
    );
    const row = Array.isArray(styleRes.data) && styleRes.data[0] ? styleRes.data[0] : null;
    if (!row || (adminIds && adminIds.size > 0 && !adminIds.has(row.user_id))) {
      sendJson(res, 404, { ok: false, error: 'Style not found in studio catalog.' });
      return true;
    }

    if (!isPaidUser) {
      const currentMeta = (authedUser.public_metadata && typeof authedUser.public_metadata === 'object')
        ? authedUser.public_metadata
        : {};
      const nextTrialUsed = (Number(currentMeta.freeTrialUsed) || 0) + 1;
      const nowIso = new Date().toISOString();
      const prevLogs = Array.isArray(currentMeta.recentPromptLogs) ? currentMeta.recentPromptLogs : [];
      const newLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: authedUser.id,
        email: getClerkPrimaryEmail(authedUser),
        pin_id: Number(row.id) || null,
        pin_title: `${String(row.title || 'Studio Prompt').slice(0, 100)} (Free Trial)`,
        category: String(row.category || 'Studio').slice(0, 60),
        action_type: actionType,
        ai_target: aiTarget,
        created_at: nowIso
      };
      const nextMeta = {
        ...currentMeta,
        freeTrialUsed: nextTrialUsed,
        promptCopyCount: (Number(currentMeta.promptCopyCount) || 0) + (actionType === 'copy' ? 1 : 0),
        aiRedirectCount: (Number(currentMeta.aiRedirectCount) || 0) + (actionType === 'ai_redirect' ? 1 : 0),
        lastPromptTitle: String(row.title || 'Studio Prompt').slice(0, 120),
        lastActiveAt: nowIso,
        recentPromptLogs: [newLog, ...prevLogs].slice(0, 25)
      };
      await clerkRequest(`/users/${encodeURIComponent(authedUser.id)}/metadata`, {
        method: 'PATCH',
        body: JSON.stringify({ public_metadata: nextMeta })
      });
      freeTrialUsed = nextTrialUsed;
    }

    sendJson(res, 200, {
      ok: true,
      styleId: Number(row.id),
      prompt: row.prompt || '',
      freeTrialUsed: freeTrialUsed,
      freeTrialLimit: FREE_TRIAL_LIMIT
    });
    return true;
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    sendJson(res, auth.status, { ok: false, error: auth.error });
    return true;
  }

  // 1. Current user's authoritative subscription & telemetry
  if (pathname === '/api/subscription/status' && method === 'GET') {
    const email = getClerkPrimaryEmail(auth.user);
    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? { ...auth.user.public_metadata }
      : {};
    const subRes = await supaRest(
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
      const clerkPatch = await clerkRequest(
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
        supaRow = created.data[0];
      }
    }

    let subscription = buildMergedSubscriber(userRecord, supaRow);

    // If an approved user's validity period has expired, persist the automatic lock back to Clerk + Supabase
    if (!auth.isAdmin && subscription.is_expired) {
      const expiredMeta = {
        ...((userRecord.public_metadata && typeof userRecord.public_metadata === 'object') ? userRecord.public_metadata : {}),
        planStatus: 'pending'
      };
      const [clerkLockRes] = await Promise.all([
        clerkRequest(`/users/${encodeURIComponent(auth.user.id)}/metadata`, {
          method: 'PATCH',
          body: JSON.stringify({ public_metadata: expiredMeta })
        }),
        syncUserSubscriptionRowToSupabase(auth.user.id, {
          email,
          plan_status: 'pending'
        })
      ]);
      if (clerkLockRes.ok && clerkLockRes.data?.id) {
        userRecord = clerkLockRes.data;
      }
      subscription = buildMergedSubscriber(userRecord, supaRow);
      subscription.is_expired = true;
    }

    sendJson(res, 200, {
      ok: true,
      isAdmin: auth.isAdmin,
      subscription
    });
    return true;
  }

  // 2. Request plan upgrade with mandatory payment receipt proof (puts user into 'pending' approval)
  if (pathname === '/api/subscription/request' && method === 'POST') {
    const body = await readJsonBody(req);
    const planTier = String(body.planTier || '');
    if (!PLAN_LIMITS[planTier] || planTier === 'free') {
      sendJson(res, 400, { ok: false, error: 'Invalid subscription tier' });
      return true;
    }

    const receiptDataUrl = String(body.receiptDataUrl || '').trim();
    if (!receiptDataUrl) {
      sendJson(res, 400, {
        ok: false,
        error: 'Payment receipt screenshot is required to submit a Pro approval request.'
      });
      return true;
    }

    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? auth.user.public_metadata
      : {};
    if (currentMeta.planStatus === 'paused') {
      sendJson(res, 403, { ok: false, error: 'Account is currently paused by Studio Admin' });
      return true;
    }

    const cleanUtrRef = String(body.utrRef || '').replace(/[<>]/g, '').trim().slice(0, 80);
    const cleanPayerNote = String(body.payerNote || '').replace(/[<>]/g, '').trim().slice(0, 180);
    const cleanFileName = String(body.receiptFileName || 'payment-receipt.jpg').replace(/[<>]/g, '').trim().slice(0, 80);
    const userEmail = getClerkPrimaryEmail(auth.user);
    const userName = getClerkFullName(auth.user);

    const requestId = `YFPRO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const savedReceipt = await savePaymentReceiptImage(requestId, auth.user.id, receiptDataUrl, {
      planTier,
      userName,
      userEmail,
      utrRef: cleanUtrRef,
      payerNote: cleanPayerNote,
      fileName: cleanFileName
    });
    if (!savedReceipt.ok) {
      sendJson(res, 400, { ok: false, error: savedReceipt.error || 'Invalid payment receipt image.' });
      return true;
    }

    const nowIso = new Date().toISOString();
    const shareToken = savedReceipt.shareToken || '';
    const receiptSharePath = shareToken ? `/api/receipt-proof/${requestId}/${shareToken}` : '';
    const receiptImageSharePath = shareToken ? `/api/receipt-image/${requestId}/${shareToken}` : '';

    const paymentProof = {
      requestId,
      planTier,
      utrRef: cleanUtrRef,
      payerNote: cleanPayerNote,
      fileName: cleanFileName,
      receiptAttached: true,
      receiptApiPath: `/api/subscription/receipt/${requestId}`,
      receiptSharePath,
      receiptImageSharePath,
      whatsappNumber: APPROVAL_WHATSAPP_NUMBER,
      submittedAt: nowIso
    };

    const nextMeta = {
      ...currentMeta,
      planTier,
      planStatus: 'pending',
      paymentProof,
      lastActiveAt: nowIso
    };

    const clerkPatch = await clerkRequest(
      `/users/${encodeURIComponent(auth.user.id)}/metadata`,
      { method: 'PATCH', body: JSON.stringify({ public_metadata: nextMeta }) }
    );
    if (!clerkPatch.ok) {
      sendJson(res, 500, { ok: false, error: 'Unable to save subscription request' });
      return true;
    }

    await syncUserSubscriptionRowToSupabase(auth.user.id, {
      email: userEmail,
      plan_tier: planTier,
      plan_status: 'pending'
    });

    const subscription = buildMergedSubscriber(clerkPatch.data || auth.user, null);
    sendJson(res, 200, {
      ok: true,
      subscription,
      paymentProof,
      whatsappNumber: APPROVAL_WHATSAPP_NUMBER
    });
    return true;
  }

  // 2b. Retrieve uploaded payment receipt image (strictly Admin or submitting owner)
  const receiptMatch = pathname.match(/^\/api\/subscription\/receipt\/([a-zA-Z0-9_-]{8,48})$/);
  if (receiptMatch && method === 'GET') {
    const reqId = receiptMatch[1];
    const found = await readPaymentReceiptImage(reqId);
    if (!found) {
      sendJson(res, 404, { ok: false, error: 'Payment receipt image not found.' });
      return true;
    }
    const isOwner = String(found.meta?.ownerUserId || '') === String(auth.user.id || '');
    if (!auth.isAdmin && !isOwner) {
      sendJson(res, 403, { ok: false, error: 'Forbidden' });
      return true;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', found.meta?.mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(found.buffer);
    return true;
  }

  // 3. Track prompt copy or AI Auto Take redirect (allows up to 5 free trial uses for pending accounts, blocks paused/expired)
  if (pathname === '/api/telemetry/track' && method === 'POST') {
    const FREE_TRIAL_LIMIT = 5;
    const body = await readJsonBody(req);
    const currentMerged = buildMergedSubscriber(auth.user, null);
    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? auth.user.public_metadata
      : {};
    const isTrialRequest = Boolean(body?.isTrial);
    const prevTrialUsed = Number(currentMeta.freeTrialUsed) || 0;
    const allowAsFreeTrial = (
      !auth.isAdmin &&
      currentMerged.plan_status === 'pending' &&
      !currentMerged.is_expired &&
      isTrialRequest &&
      prevTrialUsed < FREE_TRIAL_LIMIT
    );

    if (!auth.isAdmin && currentMerged.plan_status !== 'active' && !allowAsFreeTrial) {
      sendJson(res, 403, {
        ok: false,
        locked: true,
        expired: Boolean(currentMerged.is_expired),
        status: currentMerged.plan_status,
        freeTrialUsed: prevTrialUsed,
        error: currentMerged.is_expired
          ? 'Your access validity period has expired. Please contact Studio Admin to renew.'
          : 'Prompt access is locked until approved by Studio Admin.'
      });
      return true;
    }

    const actionType = body.actionType === 'ai_redirect' ? 'ai_redirect' : 'copy';
    const pinId = body.pinId ? Number(body.pinId) : null;
    const pinTitle = String(body.pinTitle || 'Studio Prompt').slice(0, 120);
    const category = String(body.category || 'Studio').slice(0, 60);
    const aiTarget = body.aiTarget ? String(body.aiTarget).slice(0, 40) : null;
    const nowIso = new Date().toISOString();

    const prevLogs = Array.isArray(currentMeta.recentPromptLogs) ? currentMeta.recentPromptLogs : [];
    const newLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: auth.user.id,
      email: getClerkPrimaryEmail(auth.user),
      pin_id: pinId,
      pin_title: allowAsFreeTrial ? `${pinTitle.slice(0, 104)} (Free Trial)` : pinTitle,
      category,
      action_type: actionType,
      ai_target: aiTarget,
      created_at: nowIso
    };

    const nextCopyCount = (Number(currentMeta.promptCopyCount) || 0) + (actionType === 'copy' ? 1 : 0);
    const nextRedirectCount = (Number(currentMeta.aiRedirectCount) || 0) + (actionType === 'ai_redirect' ? 1 : 0);
    const nextTrialUsed = allowAsFreeTrial ? (prevTrialUsed + 1) : prevTrialUsed;

    const nextMeta = {
      ...currentMeta,
      planTier: currentMerged.plan_tier,
      planStatus: currentMerged.plan_status,
      promptCopyCount: nextCopyCount,
      aiRedirectCount: nextRedirectCount,
      freeTrialUsed: nextTrialUsed,
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
      freeTrialUsed: nextTrialUsed,
      lastPromptTitle: pinTitle
    });
    return true;
  }

  // 4. Admin Dashboard (Strictly yashrajart1999@gmail.com)
  if (pathname === '/api/admin/dashboard' && method === 'GET') {
    if (!auth.isAdmin) {
      sendJson(res, 403, { ok: false, error: 'Admin access restricted to Studio Admin' });
      return true;
    }

    const [clerkUsersRes, subsRes, stylesRes, ordersRes] = await Promise.all([
      clerkRequest('/users?limit=100&order_by=-last_active_at'),
      supaRest('user_subscriptions?select=*'),
      supaRest('studio_styles?select=id,user_id'),
      supaRest('shop_orders?select=order_num,user_id')
    ]);

    if (!clerkUsersRes.ok || !Array.isArray(clerkUsersRes.data)) {
      sendJson(res, 500, {
        ok: false,
        error: clerkUsersRes.data?.error || 'Unable to fetch Clerk users directory (check CLERK_SECRET_KEY)'
      });
      return true;
    }

    const subMap = new Map();
    if (Array.isArray(subsRes.data)) {
      for (const r of subsRes.data) {
        if (typeof r.user_id === 'string') subMap.set(r.user_id, r);
      }
    }

    const styleCounts = {};
    if (Array.isArray(stylesRes.data)) {
      for (const s of stylesRes.data) {
        styleCounts[s.user_id] = (styleCounts[s.user_id] || 0) + 1;
      }
    }

    const orderCounts = {};
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

    const allLogs = [];
    for (const cu of clerkUsersRes.data) {
      const metaLogs = cu.public_metadata?.recentPromptLogs;
      if (Array.isArray(metaLogs)) {
        for (const item of metaLogs) {
          if (item && typeof item === 'object') {
            allLogs.push({
              ...item,
              user_id: cu.id,
              email: item.email || getClerkPrimaryEmail(cu)
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
      sendJson(res, 403, { ok: false, error: 'Admin access restricted to Studio Admin' });
      return true;
    }

    const body = await readJsonBody(req);
    const targetUserId = String(body.targetUserId || '').trim();
    if (!targetUserId) {
      sendJson(res, 400, { ok: false, error: 'Missing targetUserId' });
      return true;
    }

    const targetRes = await clerkRequest(`/users/${encodeURIComponent(targetUserId)}`);
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

    const validityUpdate = resolveValidityUpdate(body, prevMeta, isTargetAdmin);

    const nowIso = new Date().toISOString();
    const nextMeta = {
      ...prevMeta,
      planTier: nextTier,
      planStatus: nextStatus,
      styleLimit: limits.styleLimit,
      orderLimit: limits.orderLimit
    };

    if (validityUpdate.provided) {
      nextMeta.accessExpiresAt = validityUpdate.expiresAt;
      nextMeta.validityLabel = validityUpdate.validityLabel;
      nextMeta.validityPreset = validityUpdate.validityPreset;
    }

    if (body.plan_status === 'active') {
      nextMeta.approvedAt = nowIso;
    } else if (body.plan_status === 'paused') {
      nextMeta.pausedAt = nowIso;
    }

    if (typeof body.admin_note === 'string') {
      nextMeta.adminNote = body.admin_note.trim();
    }

    const clerkPatch = await clerkRequest(
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

    const syncPayload = {
      email: getClerkPrimaryEmail(targetUser),
      plan_tier: nextTier,
      plan_status: nextStatus,
      style_limit: limits.styleLimit,
      order_limit: limits.orderLimit
    };
    if (validityUpdate.provided) {
      syncPayload.current_period_end = validityUpdate.expiresAt;
    }

    await syncUserSubscriptionRowToSupabase(targetUserId, syncPayload);

    const row = buildMergedSubscriber(clerkPatch.data || targetUser, null);
    sendJson(res, 200, { ok: true, row });
    return true;
  }

  // 6. Publish / Update Admin Studio Styles globally (Strictly yashrajart1999@gmail.com)
  if (pathname === '/api/styles' && method === 'POST') {
    if (!auth.isAdmin) {
      sendJson(res, 403, { ok: false, error: 'Adding styles is restricted to Studio Admin' });
      return true;
    }

    const body = await readJsonBody(req);
    const inputList = Array.isArray(body.styles)
      ? body.styles
      : (body.style ? [body.style] : []);

    const rows = inputList
      .filter(s => s && typeof s === 'object' && s.title && s.prompt)
      .map(s => {
        const img = s.referenceImage || s.image || s.thumbnail || 'assets/prompts/01.jpeg';
        return {
          id: Number(s.id) || (Date.now() * 100 + Math.floor(Math.random() * 100)),
          user_id: auth.user.id,
          title: String(s.title).trim(),
          category: String(s.category || 'Other').trim(),
          prompt: String(s.prompt).trim(),
          reference_image: img,
          thumbnail: s.thumbnail || img,
          aspect_ratio: String(s.aspectRatio || '2:3'),
          description: String(s.description || ''),
          tags: Array.isArray(s.tags) ? s.tags : [],
          is_custom: true,
          created_at: s.createdAt || new Date().toISOString()
        };
      });

    if (rows.length === 0) {
      sendJson(res, 400, { ok: false, error: 'No valid style payload provided' });
      return true;
    }

    const supaRes = await supaRest('studio_styles?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: rows
    });

    if (!supaRes.ok) {
      sendJson(res, 500, { ok: false, error: supaRes.error || 'Failed to publish style to Supabase' });
      return true;
    }

    sendJson(res, 200, { ok: true, count: rows.length });
    return true;
  }

  // 7. Delete Admin Studio Style globally (Strictly yashrajart1999@gmail.com)
  if (pathname === '/api/styles' && method === 'DELETE') {
    if (!auth.isAdmin) {
      sendJson(res, 403, { ok: false, error: 'Deleting styles is restricted to Studio Admin' });
      return true;
    }

    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const body = await readJsonBody(req);
    const id = Number(parsedUrl.searchParams.get('id') || body.id);
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'Missing style id' });
      return true;
    }

    const delRes = await supaRest(`studio_styles?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'DELETE'
    });
    if (!delRes.ok) {
      sendJson(res, 500, { ok: false, error: delRes.error || 'Failed to delete style' });
      return true;
    }

    sendJson(res, 200, { ok: true, deletedId: id });
    return true;
  }

  // 8. Assign / Clear Pin Spotlight Badge globally (Strictly yashrajart1999@gmail.com)
  if (pathname === '/api/pin-badges' && method === 'POST') {
    if (!auth.isAdmin) {
      sendJson(res, 403, { ok: false, error: 'Managing spotlight badges is restricted to Studio Admin' });
      return true;
    }

    const body = await readJsonBody(req);
    const pinId = String(body.pinId ?? '').trim();
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(pinId)) {
      sendJson(res, 400, { ok: false, error: 'Valid pinId is required' });
      return true;
    }

    const currentMeta = (auth.user.public_metadata && typeof auth.user.public_metadata === 'object')
      ? { ...auth.user.public_metadata }
      : {};
    const nextBadges = compactPinBadgesMap(currentMeta.pinBadges);

    const shouldRemove = Boolean(body.remove) || !String(body.label || '').trim();
    if (shouldRemove) {
      delete nextBadges[pinId];
    } else {
      const normalized = normalizeSpotlightBadgeEntry({ label: body.label, tone: body.tone });
      if (!normalized) {
        sendJson(res, 400, { ok: false, error: 'Valid badge label is required' });
        return true;
      }
      nextBadges[pinId] = normalized;
    }

    const nextMeta = { ...currentMeta, pinBadges: nextBadges };
    const clerkPatch = await clerkRequest(
      `/users/${encodeURIComponent(auth.user.id)}/metadata`,
      {
        method: 'PATCH',
        body: JSON.stringify({ public_metadata: nextMeta })
      }
    );

    if (!clerkPatch.ok) {
      sendJson(res, 500, { ok: false, error: 'Failed to save spotlight badges in Clerk metadata' });
      return true;
    }

    const existingIds = cachedAdminDir.ids instanceof Set ? cachedAdminDir.ids : new Set([auth.user.id]);
    existingIds.add(auth.user.id);
    cachedAdminDir = {
      fetchedAt: Date.now(),
      ids: existingIds,
      pinBadges: nextBadges
    };

    const expandedAll = expandPinBadgesMap(nextBadges);
    sendJson(res, 200, {
      ok: true,
      pinId,
      badge: expandedAll[pinId] || null,
      badges: expandedAll
    });
    return true;
  }

  sendJson(res, 404, { ok: false, error: 'API route not found' });
  return true;
}
