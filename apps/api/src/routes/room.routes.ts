import { Router } from 'express';
import {
  createEventSchema,
  createMessageSchema,
  createRoomSchema,
  createTaskSchema,
  joinRoomSchema,
  listActivityQuerySchema,
  listEventsQuerySchema,
  listMessagesQuerySchema,
  listSessionsQuerySchema,
  listTasksQuerySchema,
  reportQuerySchema,
} from '@workra/shared';
import * as roomController from '../controllers/room.controller.js';
import * as sessionController from '../controllers/session.controller.js';
import * as taskController from '../controllers/task.controller.js';
import * as fileController from '../controllers/file.controller.js';
import * as activityController from '../controllers/activity.controller.js';
import * as messageController from '../controllers/message.controller.js';
import * as eventController from '../controllers/event.controller.js';
import * as calendarController from '../controllers/calendar.controller.js';
import * as reportController from '../controllers/report.controller.js';
import { requireAuth, requireRoomRole } from '../middlewares/auth.middleware.js';
import { validateBody, validateQuery } from '../middlewares/validate.middleware.js';
import { uploadMiddleware } from './file.routes.js';

const router = Router();

router.use(requireAuth);

router.get('/', roomController.listRooms);
router.post('/', validateBody(createRoomSchema), roomController.createRoom);
router.post('/join', validateBody(joinRoomSchema), roomController.joinRoom);

router.get('/:id', roomController.getRoom);
router.get('/:id/invite', requireRoomRole(['owner']), roomController.getRoomInvite);
router.get(
  '/:id/members',
  requireRoomRole(['owner', 'collaborator', 'client']),
  roomController.listRoomMembers,
);

router.get(
  '/:id/sessions',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateQuery(listSessionsQuerySchema),
  sessionController.listRoomSessions,
);

router.get(
  '/:id/session-stats',
  requireRoomRole(['owner', 'collaborator', 'client']),
  sessionController.getRoomSessionStats,
);

router.get(
  '/:id/tasks',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateQuery(listTasksQuerySchema),
  taskController.list,
);

router.post(
  '/:id/tasks',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateBody(createTaskSchema),
  taskController.create,
);

router.get(
  '/:id/files',
  requireRoomRole(['owner', 'collaborator', 'client']),
  fileController.list,
);

router.post(
  '/:id/files',
  requireRoomRole(['owner', 'collaborator', 'client']),
  uploadMiddleware,
  fileController.upload,
);

router.get(
  '/:id/activity',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateQuery(listActivityQuerySchema),
  activityController.listRoomActivity,
);

router.get(
  '/:id/messages',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateQuery(listMessagesQuerySchema),
  messageController.list,
);

router.post(
  '/:id/messages',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateBody(createMessageSchema),
  messageController.send,
);

router.get(
  '/:id/events',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateQuery(listEventsQuerySchema),
  eventController.list,
);

router.post(
  '/:id/events',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateBody(createEventSchema),
  eventController.create,
);

router.get(
  '/:id/calendar',
  requireRoomRole(['owner', 'collaborator', 'client']),
  calendarController.getRoomCalendar,
);

router.get(
  '/:id/report',
  requireRoomRole(['owner', 'collaborator', 'client']),
  validateQuery(reportQuerySchema),
  reportController.getRoomReport,
);

export default router;
