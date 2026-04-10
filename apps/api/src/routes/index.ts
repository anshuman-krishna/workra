import { Router } from 'express';
import authRoutes from './auth.routes.js';
import roomRoutes from './room.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);
router.use('/users', userRoutes);

export default router;
