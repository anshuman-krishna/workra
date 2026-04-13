import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin']));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.get('/rooms', adminController.listRooms);

export default router;
