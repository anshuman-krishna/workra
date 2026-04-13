import mongoose from 'mongoose';
import { EventModel, type EventDoc } from '../models/event.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { forbidden, notFound } from '../utils/errors.js';
import * as activityLog from './activity-log.service.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  PublicEvent,
  PublicMember,
} from '@workra/shared';

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

function toPublicEvent(event: EventDoc, creator: PublicMember): PublicEvent {
  return {
    id: String(event._id),
    roomId: String(event.roomId),
    title: event.title,
    description: event.description ?? null,
    type: event.type as PublicEvent['type'],
    date: event.date.toISOString(),
    createdBy: creator,
    createdAt: event.createdAt.toISOString(),
  };
}

async function assertMember(userId: string, roomId: string) {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');
  return membership;
}

async function loadMember(userId: mongoose.Types.ObjectId): Promise<PublicMember> {
  const user = await User.findById(userId).select('displayName avatarSeed').lean();
  if (!user) return { id: String(userId), displayName: 'unknown', avatarSeed: '00000000' };
  const u = user as unknown as PopulatedUser;
  return { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed };
}

async function loadMemberMap(
  ids: mongoose.Types.ObjectId[],
): Promise<Map<string, PublicMember>> {
  const unique = Array.from(new Set(ids.map((id) => String(id))));
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select('displayName avatarSeed')
    .lean();
  return new Map(
    (users as unknown as PopulatedUser[]).map((u) => [
      String(u._id),
      { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed },
    ]),
  );
}

// bare yyyy-mm-dd inputs are interpreted as utc midnight so events anchor cleanly.
// full iso datetimes are passed through untouched.
function parseDateInput(input: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T00:00:00.000Z`);
  }
  return new Date(input);
}

export async function createEvent(
  userId: string,
  roomId: string,
  input: CreateEventInput,
): Promise<PublicEvent> {
  await assertMember(userId, roomId);

  const event = await EventModel.create({
    roomId: new mongoose.Types.ObjectId(roomId),
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    date: parseDateInput(input.date),
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  void activityLog.record({
    userId,
    roomId,
    type: 'event_created',
    entityId: String(event._id),
    metadata: {
      title: event.title,
      eventType: event.type,
      date: event.date.toISOString(),
    },
  });

  const creator = await loadMember(event.createdBy);
  return toPublicEvent(event, creator);
}

export async function listEvents(
  userId: string,
  roomId: string,
  query: ListEventsQuery,
): Promise<PublicEvent[]> {
  await assertMember(userId, roomId);

  const filter: Record<string, unknown> = { roomId };
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = parseDateInput(query.from);
    if (query.to) range.$lte = parseDateInput(query.to);
    filter.date = range;
  }
  if (query.type) filter.type = query.type;

  const events = await EventModel.find(filter).sort({ date: 1, _id: 1 });
  if (events.length === 0) return [];

  const creatorMap = await loadMemberMap(
    events.map((e) => e.createdBy),
  );

  return events.map((e) => {
    const creator = creatorMap.get(String(e.createdBy)) ?? {
      id: String(e.createdBy),
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    return toPublicEvent(e, creator);
  });
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  if (!mongoose.isValidObjectId(eventId)) throw notFound('event not found');
  const event = await EventModel.findById(eventId);
  if (!event) throw notFound('event not found');

  // creators can always remove their own event. room owners can clean up anything
  // on the room calendar (planning often requires this). everyone else is blocked.
  const isCreator = String(event.createdBy) === userId;
  if (!isCreator) {
    const membership = await Membership.findOne({ userId, roomId: event.roomId });
    if (!membership || membership.role !== 'owner') {
      throw forbidden('cannot delete others\' events');
    }
  }

  await event.deleteOne();

  void activityLog.record({
    userId,
    roomId: String(event.roomId),
    type: 'event_deleted',
    entityId: String(event._id),
    metadata: {
      title: event.title,
      eventType: event.type,
      date: event.date.toISOString(),
    },
  });
}

export { toPublicEvent };
