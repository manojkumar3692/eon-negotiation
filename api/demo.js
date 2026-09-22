// No process-local sessions on Vercel: wire durable transactions before enabling.
export default function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 res.status(503).json({ error: 'LOCAL_DEMO_ONLY', message: 'Production negotiation is not connected. Run npm run dev locally.' });
}
