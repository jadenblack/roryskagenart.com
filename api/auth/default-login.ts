export default function handler(req: any, res: any) {
  const user = {
    id: 'master_rory_skagen',
    email: 'rory@ventureio.com',
    name: 'Rory Skagen',
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  const token = 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

  return res.status(200).json({
    success: true,
    authenticated: true,
    user,
    token,
    message: 'Signed in with default credentials.',
  });
}
