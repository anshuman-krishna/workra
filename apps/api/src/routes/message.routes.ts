import { Router } from 'express';
import * as messageController from '../controllers/message.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { writeLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.use(requireAuth);
router.delete('/:id', writeLimiter, messageController.remove);

export default router;
