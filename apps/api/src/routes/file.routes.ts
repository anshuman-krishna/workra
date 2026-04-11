import { Router } from 'express';
import multer from 'multer';
import * as fileController from '../controllers/file.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { env } from '../config/env.js';

// in-memory uploads keep the controller stateless. service handles persistence to storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.STORAGE_MAX_UPLOAD_BYTES },
});

const router = Router();

// local driver: signed-url byte server. must remain unauthenticated.
// signed urls embed an hmac that the controller verifies.
router.get('/local/:key', fileController.serveLocal);

router.use(requireAuth);
router.get('/:id', fileController.get);
router.get('/:id/versions', fileController.versions);
router.delete('/:id', fileController.remove);

export default router;
export const uploadMiddleware = upload.single('file');
