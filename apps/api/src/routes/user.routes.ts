import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import * as calendarController from '../controllers/calendar.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/me', requireAuth, userController.getMe);
router.get('/me/calendar', requireAuth, calendarController.getDashboardCalendar);

export default router;
