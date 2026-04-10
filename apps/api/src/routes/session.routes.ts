import { Router } from 'express';
import { startSessionSchema, stopSessionSchema } from '@workra/shared';
import * as sessionController from '../controllers/session.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/start', validateBody(startSessionSchema), sessionController.start);
router.post('/stop', validateBody(stopSessionSchema), sessionController.stop);
router.get('/active', sessionController.active);

export default router;
