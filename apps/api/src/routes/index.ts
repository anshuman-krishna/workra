import { Router } from 'express';
import authRoutes from './auth.routes.js';
import roomRoutes from './room.routes.js';
import userRoutes from './user.routes.js';
import sessionRoutes from './session.routes.js';
import taskRoutes from './task.routes.js';
import fileRoutes from './file.routes.js';
import messageRoutes from './message.routes.js';
import eventRoutes from './event.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);
router.use('/users', userRoutes);
router.use('/sessions', sessionRoutes);
router.use('/tasks', taskRoutes);
router.use('/files', fileRoutes);
router.use('/messages', messageRoutes);
router.use('/events', eventRoutes);
router.use('/admin', adminRoutes);

export default router;
