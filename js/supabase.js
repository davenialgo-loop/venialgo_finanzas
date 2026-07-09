const SUPABASE_URL = 'https://umodatusvvpbgolrizrc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtb2RhdHVzdnZwYmdvbHJpenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjcyOTYsImV4cCI6MjA5ODM0MzI5Nn0.SCyHueIKSMOP_lZBaTesagWorPvN351X3_naQ2Y3NCA';
const STORAGE_KEY = 'sb-umodatusvvpbgolrizrc-auth-token';

const _initialHash = window.location.hash;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const listeners = new Map();
let nextId = 1;

function notifyListeners(event, session) {
    listeners.forEach(cb => { try { cb(event, session); } catch (e) { console.error('Auth listener error:', e); } });
}

function loadSession() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const session = JSON.parse(raw);
            const now = Math.floor(Date.now() / 1000);
            if (session.expires_at && session.expires_at < now) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return session;
        }
    } catch (e) {}
    return null;
}

function saveSession(session) {
    try {
        if (session) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {}
}

async function supabaseFetch(path, options = {}) {
    const url = SUPABASE_URL + path;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    };
    if (options.token) {
        headers['Authorization'] = 'Bearer ' + options.token;
    }
    const res = await fetch(url, {
        method: options.method || 'POST',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data.msg || data.error_description || data.error || data.message || ('HTTP ' + res.status);
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

function processRecoveryHash() {
    const hash = _initialHash;
    if (!hash || !hash.includes('type=recovery')) return null;
    try {
        const params = new URLSearchParams(hash.replace('#', ''));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const expires_in = parseInt(params.get('expires_in') || '3600');
        if (!access_token) return null;
        const now = Math.floor(Date.now() / 1000);
        const session = {
            access_token,
            refresh_token,
            expires_in,
            expires_at: now + expires_in,
            token_type: params.get('token_type') || 'bearer',
            user: { id: params.get('user_id') || '', email: params.get('email') || '' }
        };
        saveSession(session);
        window.location.hash = '';
        return session;
    } catch (e) { return null; }
}

supabase.auth = {
    getSession() {
        const session = loadSession();
        return Promise.resolve({ data: { session }, error: null });
    },

    async signUp({ email, password }) {
        try {
            const data = await supabaseFetch('/auth/v1/signup', {
                body: { email, password }
            });
            if (data.access_token) {
                const session = {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_in: data.expires_in,
                    expires_at: data.expires_at,
                    token_type: data.token_type || 'bearer',
                    user: data.user
                };
                saveSession(session);
                notifyListeners('SIGNED_IN', session);
                return { data: { user: data.user, session }, error: null };
            }
            return { data: { user: data, session: null }, error: null };
        } catch (err) {
            return { data: { user: null, session: null }, error: { message: err.message, status: err.status, data: err.data } };
        }
    },

    async signInWithPassword({ email, password }) {
        try {
            const data = await supabaseFetch('/auth/v1/token?grant_type=password', {
                body: { email, password }
            });
            const session = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: data.expires_in,
                expires_at: data.expires_at,
                token_type: data.token_type || 'bearer',
                user: data.user
            };
            saveSession(session);
            notifyListeners('SIGNED_IN', session);
            return { data: { user: data.user, session }, error: null };
        } catch (err) {
            return { data: { user: null, session: null }, error: { message: err.message, status: err.status, data: err.data } };
        }
    },

    async signOut() {
        const session = loadSession();
        if (session) {
            try {
                await supabaseFetch('/auth/v1/logout', {
                    method: 'POST',
                    token: session.access_token
                });
            } catch (e) {}
        }
        saveSession(null);
        notifyListeners('SIGNED_OUT', null);
        return { error: null };
    },

    async resetPasswordForEmail(email, options = {}) {
        try {
            const body = { email };
            if (options.redirectTo) body.redirect_to = options.redirectTo;
            await supabaseFetch('/auth/v1/recover', { body });
            return { error: null, data: {} };
        } catch (err) {
            return { data: { user: null, session: null }, error: { message: err.message } };
        }
    },

    async updateUser(attributes) {
        const session = loadSession();
        if (!session) {
            return { data: { user: null }, error: { message: 'No hay sesión activa' } };
        }
        try {
            const data = await supabaseFetch('/auth/v1/user', {
                method: 'PUT',
                token: session.access_token,
                body: attributes
            });
            return { data: { user: data }, error: null };
        } catch (err) {
            return { data: { user: null }, error: { message: err.message } };
        }
    },

    onAuthStateChange(callback) {
        const id = nextId++;
        listeners.set(id, callback);
        const session = loadSession();
        if (session) {
            setTimeout(() => callback('INITIAL_SESSION', session), 0);
        }
        return {
            data: {
                subscription: {
                    unsubscribe: () => { listeners.delete(id); }
                }
            }
        };
    }
};
