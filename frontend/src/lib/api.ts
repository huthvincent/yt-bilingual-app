// Central API base configuration.
// Override with VITE_API_BASE (e.g. in .env.local or at build time) when the
// backend is not running on the default local address.
export const API_BASE: string =
    (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ||
    'http://127.0.0.1:8000';

export const api = (path: string) => `${API_BASE}${path}`;
