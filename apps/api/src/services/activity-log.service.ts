import { ActivityLog, type ActivityType } from '../models/activity-log.model.js';
import { logger } from '../utils/logger.js';

interface RecordInput {
  userId: string;
  roomId: string;
  type: ActivityType;
  metadata?: Record<string, unknown>;
}

// fire-and-forget: a failed activity write must never break the action that triggered it.
// callers may await this for tests, but production code can ignore the promise.
export async function record(input: RecordInput): Promise<void> {
  try {
    await ActivityLog.create({
      userId: input.userId,
      roomId: input.roomId,
      type: input.type,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    logger.warn({ err, input }, 'failed to write activity log');
  }
}
