import { Router } from 'express';
import { createRoomSchema, joinRoomSchema } from '@workra/shared';
import * as roomController from '../controllers/room.controller.js';
import * as sessionController from '../controllers/session.controller.js';
import { requireAuth, requireRoomRole } from '../middlewares/auth.middleware.js';
import { validateBody, validateQuery } from '../middlewares/validate.middleware.js';
import { listSessionsQuerySchema } from '@workra/shared';

const router = Router();

router.use(requireAuth);

router.get('/', roomController.listRooms);
router.post('/', validateBody(createRoomSchema), roomController.createRoom);
router.post('/join', validateBody(joinRoomSchema), roomController.joinRoom);

router.get('/:id', roomController.getRoom);
router.get('/:id/invite', requireRoomRole(['owner']), roomController.getRoomInvite);

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

export default router;
