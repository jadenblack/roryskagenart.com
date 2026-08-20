export default function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return res.status(200).json({
      authenticated: true,
      user: {
        id: 'master_rory_skagen',
        email: 'rory@ventureio.com',
        name: 'Rory Skagen',
        role: 'admin',
      },
    });
  }

  return res.status(200).json({
    authenticated: false,
    user: null,
  });
}
