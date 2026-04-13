import type { Request, Response, NextFunction } from 'express';
import type { Types } from 'mongoose';
import { User } from '../models/user.model.js';
import { Room } from '../models/room.model.js';
import { Session } from '../models/session.model.js';
import { Membership } from '../models/membership.model.js';

interface UserRow {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

interface RoomRow {
  _id: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId;
  inviteCode: string;
  createdAt: Date;
}

export const getStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [userCount, roomCount, sessionCount, membershipCount] = await Promise.all([
      User.countDocuments(),
      Room.countDocuments(),
      Session.countDocuments(),
      Membership.countDocuments(),
    ]);
    res.json({ stats: { userCount, roomCount, sessionCount, membershipCount } });
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as unknown as Promise<UserRow[]>,
      User.countDocuments(),
    ]);

    res.json({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

export const listRooms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      Room.find()
        .select('name ownerId inviteCode createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as unknown as Promise<RoomRow[]>,
      Room.countDocuments(),
    ]);

    // count members per room
    const roomIds = rooms.map((r) => r._id);
    const memberCounts = await Membership.aggregate([
      { $match: { roomId: { $in: roomIds } } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      memberCounts.map((m: { _id: unknown; count: number }) => [String(m._id), m.count]),
    );

    res.json({
      rooms: rooms.map((r) => ({
        id: String(r._id),
        name: r.name,
        ownerId: String(r.ownerId),
        inviteCode: r.inviteCode,
        memberCount: countMap.get(String(r._id)) ?? 0,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};
