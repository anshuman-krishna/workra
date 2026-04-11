import { Router } from 'express';
import * as eventController from '../controllers/event.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.delete('/:id', eventController.remove);

export default router;
