import type { AuthResponse, Club, ClubStats, SessionUser, Shot, ShotsPage, TrainingSession } from './types'

// Auth-ready API client. The backend already enforces JWT + rotating
// refresh tokens; this client speaks that protocol in full so a hosted
// deployment only has to disable auto-login (VITE_AUTO_LOGIN=false) to
// get a real login flow. Locally, it signs in as the seeded demo user.

const BASE = '/api/v1'
const STORAGE_KEY = 'swing-stack.tokens'

interface TokenPair {
  access: string
  refresh: string
}

export class AuthRequiredError extends Error {
  constructor() {
    super('authentication required')
  }
}

function readStored(): TokenPair | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TokenPair
    return parsed.access && parsed.refresh ? parsed : null
  } catch {
    return null
  }
}

let tokens: TokenPair | null = readStored()
let refreshing: Promise<boolean> | null = null

function storeTokens(next: TokenPair | null) {
  tokens = next
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  else localStorage.removeItem(STORAGE_KEY)
}

const USER_KEY = 'swing-stack.user'

export function currentUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function hasSession(): boolean {
  return tokens !== null
}

async function postAuth(path: string, body: Record<string, string>): Promise<AuthResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error ?? `auth failed (${res.status})`)
  }
  const auth = (await res.json()) as AuthResponse
  storeTokens({ access: auth.access_token, refresh: auth.refresh_token })
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user))
  return auth
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const auth = await postAuth('/auth/login', { email, password })
  return auth.user
}

export function logout(): void {
  const refresh = tokens?.refresh
  storeTokens(null)
  localStorage.removeItem(USER_KEY)
  if (refresh) {
    void fetch(`${BASE}/auth/logout`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => undefined)
  }
}

// Refresh tokens are single-use (the backend rotates on every refresh),
// so concurrent 401s must share one refresh call.
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refresh = tokens?.refresh
    if (!refresh) return false
    try {
      await postAuth('/auth/refresh', { refresh_token: refresh })
      return true
    } catch {
      storeTokens(null)
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!tokens) throw new AuthRequiredError()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.access}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (res.status === 401) {
    if (retry && (await refreshSession())) return apiFetch<T>(path, init, false)
    storeTokens(null)
    throw new AuthRequiredError()
  }
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status})`)
  return (await res.json()) as T
}

const apiGet = <T,>(path: string) => apiFetch<T>(path)

// Dev convenience: sign in as the seeded demo user when no session
// exists. Set VITE_AUTO_LOGIN=false to require the login form instead.
// Single-flight so StrictMode's double effect run performs one login.
let autoLogin: Promise<void> | null = null

export function ensureSession(): Promise<void> {
  if (tokens) return Promise.resolve()
  if (import.meta.env.VITE_AUTO_LOGIN === 'false') return Promise.reject(new AuthRequiredError())
  autoLogin ??= login(
    import.meta.env.VITE_DEMO_EMAIL ?? 'demo@swing-stack.dev',
    import.meta.env.VITE_DEMO_PASSWORD ?? 'demo-password-123',
  )
    .then(() => undefined)
    .finally(() => {
      autoLogin = null
    })
  return autoLogin
}

async function allShots(): Promise<Shot[]> {
  const shots: Shot[] = []
  let page = 1
  for (;;) {
    const res = await apiGet<ShotsPage>(`/shots?include=trajectory&per_page=200&page=${page}`)
    shots.push(...res.shots)
    if (shots.length >= res.total || res.shots.length === 0) return shots
    page += 1
  }
}

export const api = {
  sessions: () => apiGet<TrainingSession[]>('/sessions'),
  clubs: () => apiGet<Club[]>('/clubs'),
  clubStats: () => apiGet<ClubStats[]>('/stats/clubs'),
  shots: allShots,
  setShotExcluded: (id: string, excluded: boolean) =>
    apiFetch<Shot>(`/shots/${id}`, { method: 'PATCH', body: JSON.stringify({ excluded }) }),
}
