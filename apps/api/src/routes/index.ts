import { Router } from 'express';
import mongoose from 'mongoose';
import { getMetrics } from '../utils/metrics.js';
import authRoutes from './auth.routes.js';
import roomRoutes from './room.routes.js';
import userRoutes from './user.routes.js';
import sessionRoutes from './session.routes.js';
import taskRoutes from './task.routes.js';
import fileRoutes from './file.routes.js';
import messageRoutes from './message.routes.js';
import eventRoutes from './event.routes.js';
import adminRoutes from './admin.routes.js';

const bootTime = Date.now();

const router = Router();

router.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    db: dbStatus,
    uptime: Math.floor((Date.now() - bootTime) / 1000),
    metrics: getMetrics(),
  });
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
