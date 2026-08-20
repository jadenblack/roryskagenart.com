export default function handler(req: any, res: any) {
  return res.status(200).json({
    authenticated: false,
    sessionExpiresAt: null,
    serverTime: new Date().toISOString(),
    authEngine: 'Vercel Serverless / Client Auth Vault',
    defaultAdminEmail: 'rory@ventureio.com',
    totalAdmins: 2,
    activeSessions: 1,
  });
}
