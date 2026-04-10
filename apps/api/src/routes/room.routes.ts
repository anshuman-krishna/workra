import { Router } from 'express';
import { createRoomSchema, joinRoomSchema } from '@workra/shared';
import * as roomController from '../controllers/room.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', roomController.listRooms);
router.post('/', validateBody(createRoomSchema), roomController.createRoom);
router.post('/join', validateBody(joinRoomSchema), roomController.joinRoom);
router.get('/:id', roomController.getRoom);

export default router;
