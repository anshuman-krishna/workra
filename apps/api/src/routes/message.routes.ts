import { Router } from 'express';
import * as messageController from '../controllers/message.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.delete('/:id', messageController.remove);

export default router;
