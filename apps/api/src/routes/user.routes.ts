import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/me', requireAuth, userController.getMe);

export default router;
