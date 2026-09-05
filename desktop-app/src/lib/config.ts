export const API_BASE = 'https://dj-scratch.vercel.app';
export const POLL_MS = 15000;
export const APP_VERSION = '1.0.0';

export const PERIODS = [
  { value: '7day', label: '7 days' },
  { value: '1month', label: '1 month' },
  { value: '3month', label: '3 months' },
  { value: '6month', label: '6 months' },
  { value: '12month', label: '12 months' },
  { value: 'overall', label: 'Overall' },
] as const;

export type Period = (typeof PERIODS)[number]['value'];
