/**
 * YASHRAJ FRAMES – AI STUDIO
 * Clerk Authentication + Supabase Realtime Cloud Sync Module
 * Handles cross-device realtime sync (mobile <-> desktop) and subscription tiers.
 */

import { Clerk } from '@clerk/clerk-js';
import { createClient } from '@supabase/supabase-js';

const CLERK_PUBLISHABLE_KEY = (
  [
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    import.meta.env.CLERK_PUBLISHABLE_KEY
  ].find((k) => typeof k === 'string' && k.trim().startsWith('pk_')) || ''
).trim();
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (
  [import.meta.env.VITE_SUPABASE_ANON_KEY].find(
    (k) => typeof k === 'string' && k.trim() && !k.trim().startsWith('sb_secret_')
  ) || ''
).trim();

let clerkUiLoadPromise = null;

function deriveClerkFrontendDomain(publishableKey) {
  const parts = String(publishableKey || '').trim().split('_');
  if (parts.length < 3) return '';
  let b64 = parts.slice(2).join('_').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  try {
    const decoded = atob(b64).trim();
    return decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
  } catch {
    return '';
  }
}

function loadClerkUiBundle(publishableKey) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (window.__internal_ClerkUICtor) {
    return Promise.resolve(window.__internal_ClerkUICtor);
  }
  if (clerkUiLoadPromise) {
    return clerkUiLoadPromise;
  }
  const clerkDomain = deriveClerkFrontendDomain(publishableKey);
  if (!clerkDomain) {
    return Promise.reject(new Error('Invalid Clerk publishable key domain'));
  }

  clerkUiLoadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.__internal_ClerkUICtor) {
        resolve(window.__internal_ClerkUICtor);
      } else {
        clerkUiLoadPromise = null;
        reject(new Error('Clerk UI bundle loaded without __internal_ClerkUICtor'));
      }
    };

    const existing = document.querySelector('script[data-clerk-ui-bundle="true"]');
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        finish();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => {
        clerkUiLoadPromise = null;
        reject(new Error('Failed to load @clerk/ui bundle'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-clerk-ui-bundle', 'true');
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      finish();
    };
    script.onerror = () => {
      clerkUiLoadPromise = null;
      script.remove();
      reject(new Error('Failed to load @clerk/ui bundle'));
    };
    document.head.appendChild(script);
  });

  return clerkUiLoadPromise;
}

function getAppBaseUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

export const ADMIN_EMAIL = 'yashrajart1999@gmail.com';

export function isClerkAdminUser(user) {
  if (!user) return false;
  const target = ADMIN_EMAIL.toLowerCase();
  const primary = user.primaryEmailAddress?.emailAddress;
  if (typeof primary === 'string' && primary.trim().toLowerCase() === target) {
    return true;
  }
  if (Array.isArray(user.emailAddresses)) {
    return user.emailAddresses.some(
      (entry) => typeof entry?.emailAddress === 'string' && entry.emailAddress.trim().toLowerCase() === target
    );
  }
  return false;
}

export function isClerkHashRoute(hashValue = '') {
  const h = String(hashValue || '');
  return /^#\/($|create|sso-callback|verify|factor-|reset-password|protect-check|choose|tasks)/.test(h);
}

export const PLAN_CATALOG = {
  free: {
    id: 'free',
    name: 'Studio Starter',
    badge: 'FREE',
    priceLabel: '₹0 / month',
    styleLimit: 25,
    orderLimit: 50,
    features: [
      'Up to 25 custom synced studio styles',
      'Up to 50 cloud workshop job slips',
      'Live Mobile <-> Desktop Realtime sync',
      'Client QR Pass & Digital Order Receipt'
    ]
  },
  studio_pro: {
    id: 'studio_pro',
    name: 'Yashraj Pro Studio',
    badge: 'PRO',
    priceLabel: '₹499 / month',
    styleLimit: 1000,
    orderLimit: 5000,
    features: [
      'Unlimited studio prompts & mobile photo uploads',
      'Unlimited cloud job slips & WhatsApp alerts',
      'Instant multi-device Realtime workshop sync',
      'Priority AI Auto Take & showroom branding'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Multi-Branch Enterprise',
    badge: 'STUDIO+',
    priceLabel: '₹1,299 / month',
    styleLimit: 10000,
    orderLimit: 50000,
    features: [
      'Everything in Yashraj Pro Studio',
      'Multi-counter & photographer seat sync',
      'Dedicated cloud backup & catalog presets',
      'Custom studio domain & receipt footer'
    ]
  }
};

function mapStyleFromDb(row) {
  if (!row) return null;
  const img = row.reference_image || row.thumbnail || 'assets/prompts/01.jpeg';
  return {
    id: Number(row.id),
    title: row.title || 'Untitled Style',
    category: row.category || 'Other',
    prompt: row.prompt || '',
    referenceImage: img,
    thumbnail: row.thumbnail || img,
    image: img,
    aspectRatio: row.aspect_ratio || '2:3',
    description: row.description || `${row.category || 'Studio'} photography with studio lighting`,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isCustom: true,
    createdAt: row.created_at || new Date().toISOString()
  };
}

function mapStyleToDb(style, userId) {
  const img = style.referenceImage || style.image || style.thumbnail || 'assets/prompts/01.jpeg';
  return {
    id: Number(style.id),
    user_id: userId,
    title: style.title,
    category: style.category || 'Other',
    prompt: style.prompt,
    reference_image: img,
    thumbnail: style.thumbnail || img,
    aspect_ratio: style.aspectRatio || '2:3',
    description: style.description || '',
    tags: Array.isArray(style.tags) ? style.tags : [],
    is_custom: true,
    created_at: style.createdAt || new Date().toISOString()
  };
}

function mapOrderFromDb(row) {
  if (!row) return null;
  return {
    orderNum: row.order_num,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || '',
    styleName: row.style_name || '',
    photoUrl: row.photo_url || 'assets/prompts/01.jpeg',
    frameDetails: row.frame_details || '',
    mediaLabel: row.media_label || 'Museum Fine Art Canvas',
    price: Number(row.price) || 0,
    advance: Number(row.advance) || 0,
    balance: Number(row.balance) || 0,
    delivery: row.delivery || 'Tomorrow by 6:00 PM',
    notes: row.notes || '',
    status: row.status || 'in-progress',
    date: row.order_date || '',
    contact: row.contact || {},
    createdAt: row.created_at || new Date().toISOString()
  };
}

function mapOrderToDb(order, userId) {
  return {
    user_id: userId,
    order_num: String(order.orderNum),
    customer_name: order.customerName || 'Valued Customer',
    customer_phone: order.customerPhone || '',
    style_name: order.styleName || '',
    photo_url: order.photoUrl || 'assets/prompts/01.jpeg',
    frame_details: order.frameDetails || '',
    media_label: order.mediaLabel || 'Museum Fine Art Canvas',
    price: Number(order.price) || 0,
    advance: Number(order.advance) || 0,
    balance: Number(order.balance) || 0,
    delivery: order.delivery || 'Tomorrow by 6:00 PM',
    notes: order.notes || '',
    status: order.status || 'in-progress',
    order_date: order.date || '',
    contact: order.contact || {},
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export class StudioCloudSync {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.clerk = null;
    this.supabase = null;
    this.realtimeChannel = null;
    this.user = null;
    this.subscription = null;
    this.realtimeConnected = false;
    this.lastSyncedUserId = null;
    this.clerkConfigured = Boolean(CLERK_PUBLISHABLE_KEY);
    this.supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
    this.clerkLoaded = false;
    this.clerkError = null;
    this.initPromise = null;
    this.mountedButtonEl = null;
    this.mountedAuthEl = null;
    this.adminRealtimeChannel = null;
    this.adminPollTimer = null;
  }

  async getSessionJwt() {
    if (!this.clerkLoaded && this.initPromise) {
      try {
        await this.initPromise;
      } catch {
        // ignore init failure
      }
    }
    const session = this.clerk?.session || this.clerk?.client?.activeSessions?.[0] || null;
    if (!session || typeof session.getToken !== 'function') return null;
    try {
      const token = await session.getToken();
      if (token) return token;
      return await session.getToken({ skipCache: true });
    } catch {
      return null;
    }
  }

  async apiFetch(endpoint, options = {}) {
    const token = await this.getSessionJwt();
    if (!token) {
      return { ok: false, status: 401, data: { error: 'Session token unavailable — please sign out and sign in again' } };
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      const res = await fetch(endpoint, {
        method: options.method || 'GET',
        signal: controller ? controller.signal : undefined,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        const snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        data = {
          error: `HTTP ${res.status} (${endpoint}): Non-JSON response${snippet ? ` — ${snippet}` : ''}`
        };
      }
      if (!res.ok && !data.error) {
        data.error = `HTTP ${res.status} (${endpoint})`;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      const msg = err?.name === 'AbortError'
        ? `Request timed out (${endpoint})`
        : (err?.message || 'Network error');
      return { ok: false, status: 0, data: { error: msg } };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  isAdmin() {
    return isClerkAdminUser(this.user);
  }

  getUserIdentityMeta() {
    if (!this.user) {
      return { email: '', fullName: '', avatarUrl: '' };
    }
    const email = (
      this.user.primaryEmailAddress?.emailAddress ||
      (this.user.emailAddresses && this.user.emailAddresses[0]?.emailAddress) ||
      ''
    ).trim();
    const fullName = (
      this.user.fullName ||
      [this.user.firstName, this.user.lastName].filter(Boolean).join(' ') ||
      this.user.username ||
      ''
    ).trim();
    const avatarUrl = (this.user.imageUrl || '').trim();
    return { email, fullName, avatarUrl };
  }

  getConfigStatus() {
    return {
      clerkConfigured: this.clerkConfigured,
      clerkLoaded: this.clerkLoaded,
      clerkError: this.clerkError,
      supabaseConfigured: this.supabaseConfigured,
      isSignedIn: Boolean(this.user),
      realtimeConnected: this.realtimeConnected,
      isFullyReady: this.clerkConfigured && this.supabaseConfigured
    };
  }

  async getClerkToken() {
    if (!this.clerk || !this.clerk.session) return null;
    try {
      const templated = await this.clerk.session.getToken({ template: 'supabase' });
      if (templated) return templated;
    } catch {
      // Fallback to default Clerk session token (Clerk Third-Party Auth integration)
    }
    try {
      return await this.clerk.session.getToken();
    } catch {
      return null;
    }
  }

  init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (this.supabaseConfigured) {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          accessToken: () => this.getClerkToken()
        });
      }

      if (this.clerkConfigured) {
        try {
          const ClerkUI = await loadClerkUiBundle(CLERK_PUBLISHABLE_KEY);
          const appBaseUrl = getAppBaseUrl();
          const routerNavigate = (to, replace = false) => {
            try {
              const target = new URL(String(to || '/'), window.location.href);
              if (target.origin !== window.location.origin) {
                return;
              }
              const nextRelative = `${target.pathname}${target.search}${target.hash}`;
              window.history[replace ? 'replaceState' : 'pushState'](null, '', nextRelative);
              window.dispatchEvent(new Event('popstate'));
              window.dispatchEvent(new Event('hashchange'));
            } catch {
              // ignore invalid router target
            }
          };

          this.clerk = new Clerk(CLERK_PUBLISHABLE_KEY);
          await this.clerk.load({
            ui: ClerkUI ? { ClerkUI } : undefined,
            signInUrl: appBaseUrl,
            signInFallbackRedirectUrl: appBaseUrl,
            signUpFallbackRedirectUrl: appBaseUrl,
            signInForceRedirectUrl: appBaseUrl,
            signUpForceRedirectUrl: appBaseUrl,
            afterSignOutUrl: appBaseUrl,
            routerPush: (to) => routerNavigate(to, false),
            routerReplace: (to) => routerNavigate(to, true),
            appearance: {
              variables: {
                colorPrimary: '#D6B879',
                colorPrimaryForeground: '#111215',
                colorBackground: '#18191E',
                colorForeground: '#F8FAFC',
                colorMuted: '#242731',
                colorMutedForeground: '#CBD5E1',
                colorInput: '#242731',
                colorInputForeground: '#FFFFFF',
                colorNeutral: '#E2E8F0',
                colorBorder: 'rgba(255, 255, 255, 0.18)',
                colorRing: 'rgba(214, 184, 121, 0.45)',
                colorDanger: '#F87171',
                colorSuccess: '#4ADE80',
                colorWarning: '#FBBF24',
                colorModalBackdrop: 'rgba(10, 11, 14, 0.8)',
                colorText: '#F8FAFC',
                colorTextSecondary: '#CBD5E1',
                colorTextOnPrimaryBackground: '#111215',
                colorInputBackground: '#242731',
                colorInputText: '#FFFFFF',
                borderRadius: '14px'
              },
              elements: {
                rootBox: {
                  width: '100%'
                },
                cardBox: {
                  width: '100%',
                  boxShadow: 'none'
                },
                card: {
                  backgroundColor: '#18191E',
                  border: '1px solid rgba(214, 184, 121, 0.25)',
                  color: '#F8FAFC'
                },
                headerTitle: {
                  color: '#FFFFFF'
                },
                headerSubtitle: {
                  color: '#CBD5E1'
                },
                socialButtonsBlockButton: {
                  backgroundColor: '#FFFFFF',
                  color: '#111215',
                  borderColor: '#E2E8F0'
                },
                socialButtonsBlockButtonText: {
                  color: '#111215',
                  fontWeight: '600'
                },
                dividerLine: {
                  backgroundColor: 'rgba(255, 255, 255, 0.16)'
                },
                dividerText: {
                  color: '#CBD5E1'
                },
                formFieldLabel: {
                  color: '#F1F5F9'
                },
                formFieldHintText: {
                  color: '#CBD5E1'
                },
                formFieldInput: {
                  backgroundColor: '#242731',
                  color: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.22)'
                },
                formFieldAction: {
                  color: '#E8D09E'
                },
                formButtonPrimary: {
                  backgroundColor: '#D6B879',
                  color: '#111215',
                  fontWeight: '700'
                },
                footer: {
                  background: '#141519',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                },
                footerActionText: {
                  color: '#CBD5E1'
                },
                footerActionLink: {
                  color: '#E8D09E',
                  fontWeight: '600'
                },
                identityPreviewText: {
                  color: '#FFFFFF'
                },
                identityPreviewEditButton: {
                  color: '#E8D09E'
                },
                otpCodeFieldInput: {
                  backgroundColor: '#242731',
                  color: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.28)'
                },
                userButtonPopoverCard: {
                  backgroundColor: '#18191E',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  color: '#F8FAFC'
                },
                userButtonPopoverActionButton: {
                  color: '#F8FAFC'
                },
                userButtonPopoverActionButtonText: {
                  color: '#F8FAFC'
                },
                userButtonPopoverFooter: {
                  background: '#141519'
                }
              }
            }
          });

          this.clerkLoaded = true;
          this.clerkError = null;
          this.user = this.clerk.user || null;
          this.clerk.addListener(({ user }) => {
            const prevId = this.user ? this.user.id : null;
            const nextId = user ? user.id : null;
            this.user = user || null;
            if (prevId !== nextId) {
              if (!prevId && nextId) {
                this.unmountAuthComponent();
                if (typeof window !== 'undefined' && (isClerkHashRoute(window.location.hash) || window.location.search.includes('__clerk') || window.location.search.includes('intent='))) {
                  window.history.replaceState(null, '', getAppBaseUrl());
                }
                if (typeof this.callbacks.onAuthSuccess === 'function') {
                  this.callbacks.onAuthSuccess(user);
                }
              }
              this.handleAuthTransition();
            } else {
              this.notifyAuthChange();
            }
          });

          void this.handleAuthTransition();
        } catch (err) {
          this.clerkLoaded = false;
          this.clerkError = err?.message || 'Unable to load Clerk Sign-In';
          this.initPromise = null;
          console.warn('Clerk initialization error:', err);
          this.notifyAuthChange();
        }
      } else {
        this.notifyAuthChange();
      }
    })();
    return this.initPromise;
  }

  async handleAuthTransition() {
    this.notifyAuthChange();
    if (!this.user) {
      this.lastSyncedUserId = null;
      this.subscription = null;
      await this.unsubscribeRealtime();
      this.notifyAuthChange();
      return;
    }

    if (this.lastSyncedUserId !== this.user.id) {
      this.lastSyncedUserId = this.user.id;
      await this.bootstrapCloudState();
      if (this.supabase) {
        await this.subscribeRealtime();
      }
    }
  }

  notifyAuthChange() {
    if (typeof this.callbacks.onAuthChange === 'function') {
      this.callbacks.onAuthChange({
        user: this.user,
        subscription: this.subscription,
        status: this.getConfigStatus()
      });
    }
  }

  mountUserButton(el) {
    if (!this.clerk || !this.clerkLoaded || !this.user || !el) return;
    if (this.mountedButtonEl === el && el.childElementCount > 0) return;
    try {
      if (this.mountedButtonEl && this.mountedButtonEl !== el) {
        this.clerk.unmountUserButton(this.mountedButtonEl);
      }
      this.clerk.mountUserButton(el);
      this.mountedButtonEl = el;
    } catch (err) {
      console.warn('Clerk UserButton mount failed:', err);
    }
  }

  unmountUserButton(el) {
    if (!this.clerk || !this.clerkLoaded || !el || this.mountedButtonEl !== el) return;
    try {
      this.clerk.unmountUserButton(el);
      this.mountedButtonEl = null;
    } catch {
      // ignore unmount error
    }
  }

  hasPendingCallbackHash() {
    return typeof window !== 'undefined' && isClerkHashRoute(window.location.hash);
  }

  unmountAuthComponent() {
    const slot = this.mountedAuthEl;
    this.mountedAuthEl = null;
    if (this.clerk && slot) {
      try {
        this.clerk.unmountSignIn(slot);
      } catch {
        // ignore unmount error
      }
      // Do NOT clear slot.innerHTML synchronously: Clerk/React unmounts portal children asynchronously.
      setTimeout(() => {
        if (slot.childNodes.length === 0 && slot.parentNode) {
          slot.parentNode.removeChild(slot);
        }
      }, 600);
    }
    if (typeof window !== 'undefined' && isClerkHashRoute(window.location.hash)) {
      window.history.replaceState(null, '', getAppBaseUrl());
    }
  }

  async openSignIn(mountEl, initialMode = 'signIn') {
    if (!this.clerkConfigured) return { ok: false, reason: 'missing_key' };
    if (this.initPromise) {
      await this.initPromise;
    } else if (!this.clerkLoaded) {
      await this.init();
    }
    if (!this.clerk || !this.clerkLoaded) {
      return { ok: false, reason: this.clerkError || 'not_loaded' };
    }
    const appBaseUrl = getAppBaseUrl();
    try {
      if (mountEl) {
        this.unmountAuthComponent();
        const currentHash = window.location.hash || '';
        if (!isClerkHashRoute(currentHash) || (initialMode === 'signUp' && !currentHash.startsWith('#/create') && !currentHash.startsWith('#/sso-callback'))) {
          const targetHash = initialMode === 'signUp' ? '#/create' : '#/';
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${targetHash}`);
        }
        const slot = document.createElement('div');
        slot.className = 'clerk-auth-slot';
        mountEl.appendChild(slot);
        this.mountedAuthEl = slot;
        this.clerk.mountSignIn(slot, {
          routing: 'hash',
          oauthFlow: 'popup',
          withSignUp: true,
          fallbackRedirectUrl: appBaseUrl,
          forceRedirectUrl: appBaseUrl
        });
        return { ok: true };
      }
      this.clerk.openSignIn({
        oauthFlow: 'popup',
        withSignUp: true,
        fallbackRedirectUrl: appBaseUrl,
        forceRedirectUrl: appBaseUrl
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err?.message || 'open_signin_failed' };
    }
  }

  async openSignUp(mountEl) {
    return this.openSignIn(mountEl, 'signUp');
  }

  openUserProfile() {
    if (!this.clerk || !this.clerkLoaded || !this.user) return false;
    try {
      this.clerk.openUserProfile();
      return true;
    } catch (err) {
      console.warn('Clerk openUserProfile failed:', err);
      return false;
    }
  }

  async signOut() {
    if (!this.clerk) return;
    await this.unsubscribeRealtime();
    await this.clerk.signOut();
    this.user = null;
    this.subscription = null;
    this.lastSyncedUserId = null;
    this.notifyAuthChange();
  }

  getActivePlanMeta() {
    const pubMeta = (this.user && this.user.publicMetadata && typeof this.user.publicMetadata === 'object')
      ? this.user.publicMetadata
      : {};
    const tier = (this.subscription && this.subscription.plan_tier) || pubMeta.planTier || 'free';
    const base = PLAN_CATALOG[tier] || PLAN_CATALOG.free;
    const isAdmin = this.isAdmin();
    const defaultStatus = isAdmin ? 'active' : 'pending';
    const rawStatus = (this.subscription && this.subscription.plan_status) || pubMeta.planStatus || defaultStatus;
    const isAccessAllowed = isAdmin || rawStatus === 'active';
    return {
      ...base,
      status: rawStatus,
      isAdmin,
      isAccessAllowed,
      styleLimit: Number(this.subscription?.style_limit) || base.styleLimit,
      orderLimit: Number(this.subscription?.order_limit) || base.orderLimit,
      promptCopyCount: Number(this.subscription?.prompt_copy_count ?? pubMeta.promptCopyCount) || 0,
      aiRedirectCount: Number(this.subscription?.ai_redirect_count ?? pubMeta.aiRedirectCount) || 0,
      lastPromptTitle: this.subscription?.last_prompt_title || pubMeta.lastPromptTitle || '',
      adminNote: this.subscription?.admin_note || pubMeta.adminNote || '',
      approvedAt: this.subscription?.approved_at || pubMeta.approvedAt || null,
      pausedAt: this.subscription?.paused_at || pubMeta.pausedAt || null,
      currentPeriodEnd: this.subscription?.current_period_end || null
    };
  }

  async refreshSubscriptionFromServer() {
    if (!this.user) return null;
    const res = await this.apiFetch('/api/subscription/status');
    if (res.ok && res.data?.subscription) {
      this.subscription = res.data.subscription;
      this.notifyAuthChange();
      return this.subscription;
    }
    return null;
  }

  async bootstrapCloudState() {
    if (!this.user) return;
    const userId = this.user.id;

    try {
      // 1. Fetch authoritative subscription & lock status from server API (zero RLS/JWT dependency)
      await this.refreshSubscriptionFromServer();

      if (!this.supabase) {
        this.notifyAuthChange();
        return;
      }

      // 2. Fetch styles, orders, and preferences in parallel from Supabase
      const [stylesRes, ordersRes, prefsRes] = await Promise.all([
        this.supabase
          .from('studio_styles')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        this.supabase
          .from('shop_orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        this.supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      const remoteStyles = Array.isArray(stylesRes.data)
        ? stylesRes.data.map(mapStyleFromDb).filter(Boolean)
        : [];
      const remoteOrders = Array.isArray(ordersRes.data)
        ? ordersRes.data.map(mapOrderFromDb).filter(Boolean)
        : [];
      const remotePrefs = prefsRes.data || null;

      if (typeof this.callbacks.onCloudBootstrap === 'function') {
        await this.callbacks.onCloudBootstrap({
          styles: remoteStyles,
          orders: remoteOrders,
          preferences: remotePrefs,
          subscription: this.subscription
        });
      }

      this.notifyAuthChange();
    } catch (err) {
      console.warn('Cloud bootstrap error:', err);
    }
  }

  async subscribeRealtime() {
    if (!this.supabase || !this.user) return;
    await this.unsubscribeRealtime();

    const userId = this.user.id;
    const token = await this.getClerkToken();
    if (token && this.supabase.realtime && typeof this.supabase.realtime.setAuth === 'function') {
      this.supabase.realtime.setAuth(token);
    }

    this.realtimeChannel = this.supabase
      .channel(`studio-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'studio_styles', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (typeof this.callbacks.onStyleRealtime === 'function') {
            this.callbacks.onStyleRealtime({
              eventType: payload.eventType,
              style: payload.new ? mapStyleFromDb(payload.new) : null,
              oldId: payload.old ? Number(payload.old.id) : null
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_orders', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (typeof this.callbacks.onOrderRealtime === 'function') {
            this.callbacks.onOrderRealtime({
              eventType: payload.eventType,
              order: payload.new ? mapOrderFromDb(payload.new) : null,
              oldOrderNum: payload.old ? payload.old.order_num : null
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${userId}` },
        async () => {
          await this.refreshSubscriptionFromServer();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new && typeof this.callbacks.onPreferencesRealtime === 'function') {
            this.callbacks.onPreferencesRealtime(payload.new);
          }
        }
      )
      .subscribe((status) => {
        this.realtimeConnected = status === 'SUBSCRIBED';
        this.notifyAuthChange();
      });
  }

  async unsubscribeRealtime() {
    this.realtimeConnected = false;
    if (this.supabase && this.realtimeChannel) {
      try {
        await this.supabase.removeChannel(this.realtimeChannel);
      } catch {
        // ignore channel cleanup errors
      }
      this.realtimeChannel = null;
    }
    await this.unsubscribeAdminRealtime();
  }

  async recordPromptUsage({ pinId = null, pinTitle = '', category = '', actionType = 'copy', aiTarget = null } = {}) {
    if (!this.user) return { ok: false };
    const isRedirect = actionType === 'ai_redirect';

    const res = await this.apiFetch('/api/telemetry/track', {
      method: 'POST',
      body: {
        pinId: pinId ? Number(pinId) : null,
        pinTitle: pinTitle || '',
        category: category || '',
        actionType: isRedirect ? 'ai_redirect' : 'copy',
        aiTarget: aiTarget || null
      }
    });

    if (res.status === 403 && res.data?.locked) {
      if (!this.subscription) this.subscription = {};
      this.subscription.plan_status = res.data.status || 'paused';
      this.notifyAuthChange();
      return { ok: false, locked: true };
    }

    if (res.ok && this.subscription) {
      this.subscription.prompt_copy_count = Number(res.data.promptCopyCount) || this.subscription.prompt_copy_count;
      this.subscription.ai_redirect_count = Number(res.data.aiRedirectCount) || this.subscription.ai_redirect_count;
      if (pinTitle) this.subscription.last_prompt_title = pinTitle;
      this.subscription.last_active_at = new Date().toISOString();
    }
    return { ok: res.ok };
  }

  async requestSubscriptionUpgrade(planTier) {
    if (!this.user) return { ok: false, error: 'Sign in first' };
    if (!PLAN_CATALOG[planTier]) return { ok: false, error: 'Invalid plan tier' };

    const res = await this.apiFetch('/api/subscription/request', {
      method: 'POST',
      body: { planTier }
    });

    if (!res.ok) {
      return { ok: false, error: res.data?.error || 'Unable to submit request' };
    }
    if (res.data?.subscription) {
      this.subscription = res.data.subscription;
      this.notifyAuthChange();
    }
    return { ok: true, subscription: res.data?.subscription || null };
  }

  async fetchAdminDashboardData() {
    if (!this.isAdmin()) return { ok: false, error: `Admin access restricted to ${ADMIN_EMAIL}` };
    const res = await this.apiFetch('/api/admin/dashboard');
    if (!res.ok) {
      let detail = res.data?.error || `Failed to load admin console (HTTP ${res.status || 0})`;
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const health = await healthRes.json();
          if (!health.clerkReady) {
            detail = 'Server missing CLERK_SECRET_KEY in deployed Environment Variables.';
          } else if (!health.supabaseReady) {
            detail = 'Server missing SUPABASE_SECRET_KEY or VITE_SUPABASE_URL in deployed Environment Variables.';
          }
        } else {
          detail = `${detail} (API health returned HTTP ${healthRes.status})`;
        }
      } catch {
        // ignore secondary health error
      }
      return {
        ok: false,
        status: res.status,
        error: detail
      };
    }
    return {
      ok: true,
      users: Array.isArray(res.data?.users) ? res.data.users : [],
      logs: Array.isArray(res.data?.logs) ? res.data.logs : [],
      needsSqlMigration: false,
      onlySelfVisible: false
    };
  }

  async adminUpdateSubscription(targetUserId, updates = {}) {
    if (!this.isAdmin()) return { ok: false, error: 'Unauthorized' };
    if (!targetUserId) return { ok: false, error: 'Missing user ID' };

    const res = await this.apiFetch('/api/admin/subscription', {
      method: 'POST',
      body: {
        targetUserId,
        ...updates
      }
    });

    if (!res.ok) {
      return { ok: false, error: res.data?.error || 'Update failed' };
    }

    if (res.data?.row && this.user && res.data.row.user_id === this.user.id) {
      this.subscription = res.data.row;
      this.notifyAuthChange();
    }

    return { ok: true, row: res.data?.row || null };
  }

  async subscribeAdminRealtime(onUpdate) {
    if (!this.isAdmin()) return;
    await this.unsubscribeAdminRealtime();

    if (this.supabase) {
      const token = await this.getClerkToken();
      if (token && this.supabase.realtime && typeof this.supabase.realtime.setAuth === 'function') {
        this.supabase.realtime.setAuth(token);
      }

      this.adminRealtimeChannel = this.supabase
        .channel('studio-admin-console')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions' }, () => {
          if (typeof onUpdate === 'function') onUpdate('subscriptions');
        })
        .subscribe();
    }

    this.adminPollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && typeof onUpdate === 'function') {
        onUpdate('poll');
      }
    }, 15000);
  }

  async unsubscribeAdminRealtime() {
    if (this.adminPollTimer) {
      clearInterval(this.adminPollTimer);
      this.adminPollTimer = null;
    }
    if (this.supabase && this.adminRealtimeChannel) {
      try {
        await this.supabase.removeChannel(this.adminRealtimeChannel);
      } catch {
        // ignore cleanup error
      }
      this.adminRealtimeChannel = null;
    }
  }

  async upsertStyle(style) {
    if (!this.supabase || !this.user) return { synced: false };
    const row = mapStyleToDb(style, this.user.id);
    const { error } = await this.supabase
      .from('studio_styles')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsertStyle failed:', error);
      return { synced: false, error };
    }
    return { synced: true };
  }

  async upsertStylesBatch(styles) {
    if (!this.supabase || !this.user || !Array.isArray(styles) || styles.length === 0) {
      return { synced: false };
    }
    const rows = styles.map(s => mapStyleToDb(s, this.user.id));
    const { error } = await this.supabase
      .from('studio_styles')
      .upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase batch upsertStyles failed:', error);
      return { synced: false, error };
    }
    return { synced: true };
  }

  async deleteStyle(styleId) {
    if (!this.supabase || !this.user) return { synced: false };
    const { error } = await this.supabase
      .from('studio_styles')
      .delete()
      .eq('id', Number(styleId))
      .eq('user_id', this.user.id);
    if (error) {
      console.warn('Supabase deleteStyle failed:', error);
      return { synced: false, error };
    }
    return { synced: true };
  }

  async upsertOrder(order) {
    if (!this.supabase || !this.user) return { synced: false };
    const row = mapOrderToDb(order, this.user.id);
    const { error } = await this.supabase
      .from('shop_orders')
      .upsert(row, { onConflict: 'user_id,order_num' });
    if (error) {
      console.warn('Supabase upsertOrder failed:', error);
      return { synced: false, error };
    }
    return { synced: true };
  }

  async upsertOrdersBatch(orders) {
    if (!this.supabase || !this.user || !Array.isArray(orders) || orders.length === 0) {
      return { synced: false };
    }
    const rows = orders.map(o => mapOrderToDb(o, this.user.id));
    const { error } = await this.supabase
      .from('shop_orders')
      .upsert(rows, { onConflict: 'user_id,order_num' });
    if (error) {
      console.warn('Supabase batch upsertOrders failed:', error);
      return { synced: false, error };
    }
    return { synced: true };
  }

  async upsertPreferences(prefs) {
    if (!this.supabase || !this.user) return { synced: false };
    const row = {
      user_id: this.user.id,
      favorites: Array.isArray(prefs.favorites) ? prefs.favorites : [],
      recent_ids: Array.isArray(prefs.recentIds) ? prefs.recentIds : [],
      default_ai_app: prefs.defaultAiApp || null,
      shop_contact: prefs.shopContact || {},
      updated_at: new Date().toISOString()
    };
    const { error } = await this.supabase
      .from('user_preferences')
      .upsert(row, { onConflict: 'user_id' });
    if (error) {
      console.warn('Supabase upsertPreferences failed:', error);
      return { synced: false, error };
    }
    return { synced: true };
  }
}

export function compressImageFileForCloud(file, maxEdge = 960, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Invalid image payload'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h || (w <= maxEdge && h <= maxEdge && dataUrl.length < 350000)) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
