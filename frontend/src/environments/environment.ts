export const environment = {
  production: false,
  /** Relative so the dev-server proxy (proxy.conf.json) forwards to FastAPI. */
  apiUrl: '/api/v1',
  siteUrl: 'http://localhost:4200',
  siteName: 'CardArena',
  /** Login, profiles, stats, leaderboard and multiplayer. Off while the site is bots-only (no backend). */
  accountsEnabled: false,
  /** Analytics stays off in development so local testing doesn't skew the numbers. */
  gaMeasurementId: '',
};
