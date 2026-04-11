import type { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'node:fs';
import * as fileService from '../services/file.service.js';
import { resolveLocalPath, verifyLocalKey } from '../storage/local.adapter.js';
import { badRequest, notFound, unauthorized } from '../utils/errors.js';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw badRequest('no file uploaded');
    const file = await fileService.uploadFile(userId(req), req.params.id, {
      name: req.file.originalname,
      mimeType: req.file.mimetype || 'application/octet-stream',
      buffer: req.file.buffer,
    });
    res.status(201).json({ file });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const files = await fileService.listFiles(userId(req), req.params.id);
    res.json({ files });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await fileService.getFileWithUrl(userId(req), req.params.id);
    res.json({ file });
  } catch (err) {
    next(err);
  }
}

export async function versions(req: Request, res: Response, next: NextFunction) {
  try {
    const versions = await fileService.listFileVersions(userId(req), req.params.id);
    res.json({ versions });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await fileService.deleteFile(userId(req), req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// streams local-driver bytes back. unauthenticated by design: signed url replaces auth.
// for s3/r2 the request is presigned and never hits the api at all.
export async function serveLocal(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.params.key;
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    const name = String(req.query.name ?? 'download');
    if (!key || !sig || !exp || !verifyLocalKey(key, exp, sig)) {
      throw notFound('file not found');
    }

    const fullPath = resolveLocalPath(key);
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      throw notFound('file not found');
    }

    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${sanitize(name)}"`);
    const buffer = await fs.readFile(fullPath);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
}

function sanitize(name: string): string {
  return name.replace(/["\\\r\n]/g, '_');
}
