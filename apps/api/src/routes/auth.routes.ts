import { Router } from 'express';
import { signupSchema, loginSchema } from '@workra/shared';
import * as authController from '../controllers/auth.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post('/signup', authLimiter, validateBody(signupSchema), authController.signup);
router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);

export default router;
