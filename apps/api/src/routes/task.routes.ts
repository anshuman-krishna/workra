import { Router } from 'express';
import { updateTaskSchema } from '@workra/shared';
import * as taskController from '../controllers/task.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';

// task routes scoped to a task id (not nested under /rooms/:id)
// membership is enforced inside the service since we resolve roomId from the task
const router = Router();

router.use(requireAuth);

router.get('/:id', taskController.get);
router.patch('/:id', validateBody(updateTaskSchema), taskController.update);
router.delete('/:id', taskController.remove);
router.get('/:id/sessions', taskController.listSessionsForTask);

export default router;
