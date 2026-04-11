import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

// calendar events: deliberate, human-scheduled items (a deadline, a meeting, a milestone).
// separate from sessions (which are records of work already done) and tasks (which are
// stateful units of intent). events are the "what's on the wall" layer of the calendar.
export const EVENT_TYPES = ['deadline', 'meeting', 'milestone'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const eventSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    type: { type: String, enum: EVENT_TYPES, required: true },
    // single calendar day anchor. we store UTC midnight so aggregations can group cleanly;
    // the frontend re-interprets in the user's local timezone when rendering.
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

// primary read path: list a room's upcoming and past events in date order
eventSchema.index({ roomId: 1, date: 1 });

export type EventDoc = InferSchemaType<typeof eventSchema> & {
  _id: Schema.Types.ObjectId;
};

export const EventModel: Model<EventDoc> = model<EventDoc>('Event', eventSchema);
