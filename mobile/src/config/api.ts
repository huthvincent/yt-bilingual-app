// API Configuration
// DEV: Your Mac's local network IP (auto-detected) — for Expo Go on iPhone
const DEV_API_URL = 'http://10.217.139.31:8000';

// PROD: When you deploy the backend to cloud, put the URL here and switch
const PROD_API_URL = 'https://web-production-b50098.up.railway.app';

// Toggle between DEV and PROD:
export const API_BASE_URL = 'https://witty-comics-watch.loca.lt';

export const api = {
  processVideo: `${API_BASE_URL}/api/process-video`,
  estimateCost: `${API_BASE_URL}/api/estimate-cost`,
  history: `${API_BASE_URL}/api/history`,
  shows: `${API_BASE_URL}/api/shows`,
  favorites: `${API_BASE_URL}/api/favorites`,
  subscriptions: `${API_BASE_URL}/api/subscriptions`,
  channelUpdates: `${API_BASE_URL}/api/channel-updates`,
  processSubtitle: `${API_BASE_URL}/api/process-subtitle`,
  health: `${API_BASE_URL}/health`,
};
