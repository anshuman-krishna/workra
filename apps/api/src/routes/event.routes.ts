import { Router } from 'express';
import * as eventController from '../controllers/event.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { writeLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.use(requireAuth);
router.delete('/:id', writeLimiter, eventController.remove);

export default router;
