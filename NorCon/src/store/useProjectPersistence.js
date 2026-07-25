// Hook to auto-save project state to Redis and load on login
import { useCallback } from 'react';

async function readError(res, fallback) {
  const text = await res.text().catch(() => '');
  if (!text) return `${fallback} (${res.status})`;
  try {
    const parsed = JSON.parse(text);
    return `${parsed.error || fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

export function useProjectPersistence() {
  // Save project state to Redis. App.jsx handles debouncing so callers can await
  // this function and show accurate save status.
  const saveState = useCallback(async (projectCode, state, memberCode) => {
    if (!projectCode) return;
    const res = await fetch('/api/state', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: projectCode, state, memberCode }),
    });
    if (!res.ok) {
      throw new Error(await readError(res, 'Failed to save project state'));
    }
    return res.json();
  }, []);

  // Load project state by code
  const loadState = useCallback(async (projectCode, memberCode) => {
    const params = new URLSearchParams({
      code: projectCode.toUpperCase(),
      memberCode: (memberCode || '').toUpperCase(),
    });
    const res = await fetch(`/api/state?${params.toString()}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) {
      throw new Error(await readError(res, 'Failed to load project'));
    }
    const data = await res.json();
    return data.state;
  }, []);

  // Authenticate a team member
  const authenticate = useCallback(async (projectCode, memberCode) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectCode, memberCode }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Authentication failed'));
    const data = await res.json();
    return data; // { member, state }
  }, []);

  return { saveState, loadState, authenticate };
}
