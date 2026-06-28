import express from 'express';
import cors from 'cors';

const coreRouter = express.Router();
coreRouter.use(cors());

// Liveness/readiness probe. Unauthenticated by design — mounted before any
// auth middleware so orchestrators can health-check the process directly.
coreRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'wallet' });
});

export { coreRouter };
