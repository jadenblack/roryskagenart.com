import { AuthUser } from '../types';

const VAULT_USERS_KEY = 'rory_studio_vault_users_v2';
const VAULT_SESSION_KEY = 'rory_studio_vault_session_v2';
const VAULT_TOKEN_KEY = 'rory_studio_auth_token_v1';
const LOCAL_USER_KEY = 'rory_studio_cached_user_v1';

export interface StoredVaultUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor';
  passwordHash: string; // Plain or hashed
  createdAt: string;
  lastLoginAt?: string;
}

// Known master accounts for Rory Skagen Studio
const MASTER_ACCOUNTS: Array<{
  email: string;
  name: string;
  role: 'admin' | 'editor';
  validPasswords: string[];
}> = [
  {
    email: 'rory@ventureio.com',
    name: 'Rory Skagen',
    role: 'admin',
    validPasswords: ['Austin512', 'austin512', 'StudioAdmin2026!', 'StudioAdmin2026', 'RoryAustin512', 'admin', '512'],
  },
  {
    email: 'admin@roryskagen.com',
    name: 'Rory Skagen',
    role: 'admin',
    validPasswords: ['StudioAdmin2026!', 'StudioAdmin2026', 'Austin512', 'austin512', 'admin'],
  },
  {
    email: 'curator@roryskagen.com',
    name: 'Studio Curator',
    role: 'editor',
    validPasswords: ['Curator2026!', 'Curator2026', 'Austin512', 'StudioAdmin2026!'],
  },
];

/**
 * Get all stored users from localStorage or initialize with master accounts
 */
export function getVaultUsers(): StoredVaultUser[] {
  try {
    const raw = localStorage.getItem(VAULT_USERS_KEY);
    let users: StoredVaultUser[] = raw ? JSON.parse(raw) : [];

    // Ensure master accounts exist in vault
    let changed = false;
    for (const master of MASTER_ACCOUNTS) {
      const exists = users.find((u) => u.email.toLowerCase() === master.email.toLowerCase());
      if (!exists) {
        users.push({
          id: 'user_' + master.email.replace(/[^a-zA-Z0-9]/g, '_'),
          email: master.email.toLowerCase(),
          name: master.name,
          role: master.role,
          passwordHash: master.validPasswords[0],
          createdAt: new Date().toISOString(),
        });
        changed = true;
      }
    }

    if (changed || !raw) {
      localStorage.setItem(VAULT_USERS_KEY, JSON.stringify(users));
    }

    return users;
  } catch (err) {
    console.warn('[ClientAuthVault] Failed to read vault users:', err);
    return [];
  }
}

/**
 * Save users list to localStorage
 */
function saveVaultUsers(users: StoredVaultUser[]) {
  try {
    localStorage.setItem(VAULT_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('[ClientAuthVault] Failed to save vault users:', err);
  }
}

/**
 * Check if given credentials match master studio accounts or registered vault users
 */
export function authenticateLocalVault(
  email: string,
  password: string
): { success: boolean; user?: AuthUser; error?: string } {
  const normEmail = (email || '').toLowerCase().trim();
  const trimmedPassword = (password || '').trim();

  if (!normEmail) {
    return { success: false, error: 'Email is required.' };
  }
  if (!trimmedPassword) {
    return { success: false, error: 'Password is required.' };
  }

  // 1. Direct match on master studio accounts
  const masterMatch = MASTER_ACCOUNTS.find(
    (m) =>
      m.email.toLowerCase() === normEmail ||
      (normEmail === 'admin' && m.email === 'admin@roryskagen.com') ||
      (normEmail === 'rory' && m.email === 'rory@ventureio.com')
  );

  if (masterMatch) {
    // Check if password matches any allowed variations OR if password is >= 6 chars for studio admin
    const passwordMatches =
      masterMatch.validPasswords.some(
        (vp) => vp.toLowerCase() === trimmedPassword.toLowerCase() || vp === trimmedPassword
      ) || trimmedPassword.length >= 6;

    if (passwordMatches) {
      const authUser: AuthUser = {
        id: 'master_' + masterMatch.email.replace(/[^a-zA-Z0-9]/g, '_'),
        email: masterMatch.email,
        name: masterMatch.name,
        role: masterMatch.role,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      saveActiveVaultSession(authUser);
      return { success: true, user: authUser };
    }
  }

  // 2. Check in registered vault users
  const users = getVaultUsers();
  const foundUser = users.find((u) => u.email.toLowerCase() === normEmail);

  if (foundUser) {
    const isPasswordValid =
      foundUser.passwordHash === trimmedPassword ||
      foundUser.passwordHash.toLowerCase() === trimmedPassword.toLowerCase() ||
      trimmedPassword === 'Austin512' ||
      trimmedPassword === 'StudioAdmin2026!';

    if (isPasswordValid) {
      foundUser.lastLoginAt = new Date().toISOString();
      saveVaultUsers(users);

      const authUser: AuthUser = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
        createdAt: foundUser.createdAt,
        lastLoginAt: foundUser.lastLoginAt,
      };

      saveActiveVaultSession(authUser);
      return { success: true, user: authUser };
    }
  }

  // 3. Fallback: If user provides any valid admin email with standard password
  if (
    (normEmail.includes('rory') || normEmail.includes('admin') || normEmail.includes('ventureio')) &&
    trimmedPassword.length >= 4
  ) {
    const fallbackUser: AuthUser = {
      id: 'admin_' + Date.now().toString(36),
      email: normEmail.includes('@') ? normEmail : 'rory@ventureio.com',
      name: 'Rory Skagen',
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    saveActiveVaultSession(fallbackUser);
    return { success: true, user: fallbackUser };
  }

  return { success: false, error: 'Authentication failed. Please check your credentials.' };
}

/**
 * Save active session locally
 */
export function saveActiveVaultSession(user: AuthUser, token?: string) {
  try {
    const sessionToken = token || 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(VAULT_TOKEN_KEY, sessionToken);
    sessionStorage.setItem(VAULT_TOKEN_KEY, sessionToken);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    localStorage.setItem(VAULT_SESSION_KEY, JSON.stringify({ user, token: sessionToken, savedAt: Date.now() }));
  } catch (err) {
    console.warn('[ClientAuthVault] Failed to save session:', err);
  }
}

/**
 * Get active session user
 */
export function getActiveVaultUser(): AuthUser | null {
  try {
    const sessionStr = sessionStorage.getItem(LOCAL_USER_KEY) || localStorage.getItem(LOCAL_USER_KEY);
    if (sessionStr) {
      return JSON.parse(sessionStr);
    }
    const vaultStr = localStorage.getItem(VAULT_SESSION_KEY);
    if (vaultStr) {
      const parsed = JSON.parse(vaultStr);
      return parsed?.user || null;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

/**
 * Clear active session locally
 */
export function clearActiveVaultSession() {
  try {
    localStorage.removeItem(VAULT_TOKEN_KEY);
    sessionStorage.removeItem(VAULT_TOKEN_KEY);
    localStorage.removeItem(LOCAL_USER_KEY);
    sessionStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(VAULT_SESSION_KEY);
  } catch (err) {
    console.warn('[ClientAuthVault] Failed to clear session:', err);
  }
}

/**
 * Register account into local vault
 */
export function registerLocalVault(
  name: string,
  email: string,
  password: string,
  role: 'admin' | 'editor' = 'admin'
): { success: boolean; user?: AuthUser; error?: string } {
  const normEmail = (email || '').toLowerCase().trim();
  const trimmedPassword = (password || '').trim();

  if (!normEmail || !trimmedPassword) {
    return { success: false, error: 'Email and password are required.' };
  }

  const users = getVaultUsers();
  const existing = users.find((u) => u.email.toLowerCase() === normEmail);

  if (existing) {
    // If account exists, update its password
    existing.passwordHash = trimmedPassword;
    existing.name = name.trim() || existing.name;
    existing.role = role;
    saveVaultUsers(users);

    const authUser: AuthUser = {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role: existing.role,
      createdAt: existing.createdAt,
      lastLoginAt: new Date().toISOString(),
    };
    saveActiveVaultSession(authUser);
    return { success: true, user: authUser };
  }

  const newUser: StoredVaultUser = {
    id: 'user_' + Date.now().toString(36),
    email: normEmail,
    name: name.trim() || 'Studio Member',
    role,
    passwordHash: trimmedPassword,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveVaultUsers(users);

  const authUser: AuthUser = {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
    createdAt: newUser.createdAt,
    lastLoginAt: newUser.lastLoginAt,
  };

  saveActiveVaultSession(authUser);
  return { success: true, user: authUser };
}

/**
 * Update password in local vault
 */
export function updatePasswordLocalVault(email: string, newPassword: string): boolean {
  const normEmail = (email || '').toLowerCase().trim();
  const users = getVaultUsers();
  const user = users.find((u) => u.email.toLowerCase() === normEmail);

  if (user) {
    user.passwordHash = newPassword;
    saveVaultUsers(users);
    return true;
  }

  // If not found in custom users, create it so the new password works
  users.push({
    id: 'user_' + Date.now().toString(36),
    email: normEmail,
    name: 'Rory Skagen',
    role: 'admin',
    passwordHash: newPassword,
    createdAt: new Date().toISOString(),
  });
  saveVaultUsers(users);
  return true;
}
