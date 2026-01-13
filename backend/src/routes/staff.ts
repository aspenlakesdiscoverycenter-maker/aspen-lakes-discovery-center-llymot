import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerStaffRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * GET /api/staff/children
   * Get all children in the daycare
   */
  app.fastify.get(
    '/api/staff/children',
    {
      schema: {
        description: 'Get all children in the daycare',
        tags: ['staff'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                dateOfBirth: { type: 'string' },
                allergies: { type: 'string' },
                medicalNotes: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      return app.db.query.children.findMany({
        with: {
          childParents: true,
        },
      });
    }
  );

  /**
   * GET /api/staff/child/:childId
   * Get a specific child's details with parent information
   */
  app.fastify.get(
    '/api/staff/child/:childId',
    {
      schema: {
        description: "Get a specific child's details with parent information",
        tags: ['staff'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              allergies: { type: 'string' },
              medicalNotes: { type: 'string' },
              childParents: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { childId } = request.params as { childId: string };

      const child = await app.db.query.children.findFirst({
        where: eq(schema.children.id, childId),
        with: {
          childParents: true,
        },
      });

      if (!child) {
        reply.code(404);
        return { error: 'Child not found' };
      }

      return child;
    }
  );

  /**
   * POST /api/staff/attendance
   * Record child check-in or check-out
   */
  app.fastify.post(
    '/api/staff/attendance',
    {
      schema: {
        description: 'Record child check-in or check-out',
        tags: ['staff'],
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            type: { type: 'string', enum: ['check-in', 'check-out'] },
            notes: { type: 'string' },
          },
          required: ['childId', 'type'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              childId: { type: 'string' },
              checkInTime: { type: 'string' },
              checkOutTime: { type: 'string' },
              date: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { childId, type, notes } = request.body as {
        childId: string;
        type: 'check-in' | 'check-out';
        notes?: string;
      };
      const staffId = session.user.id;
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check if attendance record exists for today
      let attendanceRecord = await app.db.query.attendance.findFirst({
        where: and(
          eq(schema.attendance.childId, childId),
          eq(schema.attendance.staffId, staffId),
          // Match on date only (not time)
        ),
      });

      if (type === 'check-in') {
        if (attendanceRecord?.checkInTime && !attendanceRecord?.checkOutTime) {
          // Record already checked in today, update it
          const [updated] = await app.db
            .update(schema.attendance)
            .set({
              checkInTime: now,
              notes,
              updatedAt: now,
            })
            .where(eq(schema.attendance.id, attendanceRecord.id))
            .returning();
          reply.code(201);
          return updated;
        }

        // Create new check-in record
        const [record] = await app.db
          .insert(schema.attendance)
          .values({
            childId,
            staffId,
            checkInTime: now,
            date: todayDate,
            notes,
          })
          .returning();
        reply.code(201);
        return record;
      } else if (type === 'check-out') {
        if (!attendanceRecord) {
          reply.code(400);
          return { error: 'No check-in record found for today' };
        }

        const [updated] = await app.db
          .update(schema.attendance)
          .set({
            checkOutTime: now,
            notes: notes || attendanceRecord.notes,
            updatedAt: now,
          })
          .where(eq(schema.attendance.id, attendanceRecord.id))
          .returning();

        reply.code(201);
        return updated;
      }
    }
  );

  /**
   * GET /api/staff/attendance/:childId
   * Get attendance records for a child
   */
  app.fastify.get(
    '/api/staff/attendance/:childId',
    {
      schema: {
        description: 'Get attendance records for a child',
        tags: ['staff'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                childId: { type: 'string' },
                checkInTime: { type: 'string' },
                checkOutTime: { type: 'string' },
                date: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { childId } = request.params as { childId: string };

      return app.db.query.attendance.findMany({
        where: eq(schema.attendance.childId, childId),
      });
    }
  );

  /**
   * POST /api/staff/daily-report
   * Create a daily report for a child
   */
  app.fastify.post(
    '/api/staff/daily-report',
    {
      schema: {
        description: 'Create a daily report for a child',
        tags: ['staff'],
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            mealsTaken: { type: 'array' },
            napTime: { type: 'object' },
            activities: { type: 'string' },
            mood: { type: 'string', enum: ['happy', 'good', 'neutral', 'fussy', 'upset'] },
            notes: { type: 'string' },
            photos: { type: 'array', description: 'Array of photo URLs' },
          },
          required: ['childId'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              childId: { type: 'string' },
              date: { type: 'string' },
              mood: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { childId, mealsTaken, napTime, activities, mood, notes, photos } = request.body as {
        childId: string;
        mealsTaken?: unknown[];
        napTime?: unknown;
        activities?: string;
        mood?: 'happy' | 'good' | 'neutral' | 'fussy' | 'upset';
        notes?: string;
        photos?: string[];
      };
      const staffId = session.user.id;
      const now = new Date();

      const [report] = await app.db
        .insert(schema.dailyReports)
        .values({
          childId,
          staffId,
          date: now,
          mealsTaken: mealsTaken || null,
          napTime: napTime || null,
          activities,
          mood,
          notes,
          photos: photos || null,
        })
        .returning();

      reply.code(201);
      return report;
    }
  );

  /**
   * GET /api/staff/daily-reports/:childId
   * Get daily reports for a child
   */
  app.fastify.get(
    '/api/staff/daily-reports/:childId',
    {
      schema: {
        description: 'Get daily reports for a child',
        tags: ['staff'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                childId: { type: 'string' },
                date: { type: 'string' },
                activities: { type: 'string' },
                mood: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { childId } = request.params as { childId: string };

      return app.db.query.dailyReports.findMany({
        where: eq(schema.dailyReports.childId, childId),
      });
    }
  );

  /**
   * GET /api/staff/messages
   * Get all messages for staff member (direct + group)
   */
  app.fastify.get(
    '/api/staff/messages',
    {
      schema: {
        description: 'Get all messages for staff member',
        tags: ['staff'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                senderId: { type: 'string' },
                content: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const userId = session.user.id;

      // Get direct messages to staff
      const directMessages = await app.db.query.messages.findMany({
        where: eq(schema.messages.recipientId, userId),
      });

      return directMessages;
    }
  );

  /**
   * POST /api/staff/messages
   * Send a direct message or group message
   */
  app.fastify.post(
    '/api/staff/messages',
    {
      schema: {
        description: 'Send a direct message or group message',
        tags: ['staff'],
        body: {
          type: 'object',
          properties: {
            recipientId: { type: 'string', description: 'Staff/parent ID (for direct messages)' },
            groupId: { type: 'string', description: 'Group ID (for group messages)' },
            subject: { type: 'string' },
            content: { type: 'string' },
            childId: { type: 'string', description: 'Optional: if message is about specific child' },
          },
          required: ['content'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              senderId: { type: 'string' },
              content: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { recipientId, groupId, subject, content, childId } = request.body as {
        recipientId?: string;
        groupId?: string;
        subject?: string;
        content: string;
        childId?: string;
      };
      const userId = session.user.id;

      // Either recipientId or groupId must be provided
      if (!recipientId && !groupId) {
        reply.code(400);
        return { error: 'Either recipientId or groupId must be provided' };
      }

      // If groupId provided, verify staff is member of group
      if (groupId) {
        const isMember = await app.db.query.groupMembers.findFirst({
          where: and(
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.userId, userId)
          ),
        });

        if (!isMember) {
          reply.code(403);
          return { error: 'Not a member of this group' };
        }
      }

      const [message] = await app.db
        .insert(schema.messages)
        .values({
          senderId: userId,
          recipientId: recipientId || null,
          groupId: groupId || null,
          childId: childId || null,
          subject,
          content,
        })
        .returning();

      reply.code(201);
      return message;
    }
  );

  /**
   * POST /api/staff/message-groups
   * Create a message group (directors only)
   */
  app.fastify.post(
    '/api/staff/message-groups',
    {
      schema: {
        description: 'Create a message group (directors only)',
        tags: ['staff'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            groupType: {
              type: 'string',
              enum: ['daily_plans', 'classroom', 'announcements', 'custom'],
            },
            memberIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'groupType'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              groupType: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can create message groups' };
      }

      const { name, description, groupType, memberIds } = request.body as {
        name: string;
        description?: string;
        groupType: 'daily_plans' | 'classroom' | 'announcements' | 'custom';
        memberIds?: string[];
      };
      const userId = session.user.id;

      const [group] = await app.db
        .insert(schema.messageGroups)
        .values({
          name,
          description,
          groupType,
          createdBy: userId,
        })
        .returning();

      // Add creator as member
      await app.db.insert(schema.groupMembers).values({
        groupId: group.id,
        userId,
      });

      // Add other members if provided
      if (memberIds && memberIds.length > 0) {
        await app.db.insert(schema.groupMembers).values(
          memberIds.map((id) => ({
            groupId: group.id,
            userId: id,
          }))
        );
      }

      reply.code(201);
      return group;
    }
  );

  /**
   * GET /api/staff/message-groups
   * Get all message groups staff is member of
   */
  app.fastify.get(
    '/api/staff/message-groups',
    {
      schema: {
        description: 'Get all message groups staff is member of',
        tags: ['staff'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                groupType: { type: 'string' },
                members: { type: 'array' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const userId = session.user.id;

      const memberGroups = await app.db.query.groupMembers.findMany({
        where: eq(schema.groupMembers.userId, userId),
        with: {
          group: {
            with: {
              members: true,
            },
          },
        },
      });

      return memberGroups.map((mg) => mg.group);
    }
  );

  /**
   * GET /api/staff/schedules
   * Get staff schedules
   */
  app.fastify.get(
    '/api/staff/schedules',
    {
      schema: {
        description: 'Get staff schedules for a date range',
        tags: ['staff'],
        querystring: {
          type: 'object',
          properties: {
            staffId: { type: 'string', description: 'Get specific staff schedule (directors only)' },
            startDate: { type: 'string', description: 'Start date ISO string' },
            endDate: { type: 'string', description: 'End date ISO string' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                staffId: { type: 'string' },
                date: { type: 'string' },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { staffId, startDate, endDate } = request.query as {
        staffId?: string;
        startDate?: string;
        endDate?: string;
      };
      const userId = session.user.id;

      // Staff can only view their own schedules, directors can view all
      let queryStaffId = staffId;
      if (userProfile.role !== 'director' && staffId && staffId !== userId) {
        reply.code(403);
        return { error: 'Can only view your own schedule' };
      }
      if (!staffId && userProfile.role !== 'director') {
        queryStaffId = userId;
      }

      const conditions = [];

      if (queryStaffId) {
        conditions.push(eq(schema.staffSchedules.staffId, queryStaffId));
      }

      if (startDate) {
        conditions.push(
          gte(schema.staffSchedules.date, new Date(startDate))
        );
      }
      if (endDate) {
        conditions.push(
          lte(schema.staffSchedules.date, new Date(endDate))
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      return app.db.query.staffSchedules.findMany({
        where: whereClause,
      });
    }
  );

  /**
   * POST /api/staff/schedule
   * Create/Update staff schedule (directors only)
   */
  app.fastify.post(
    '/api/staff/schedule',
    {
      schema: {
        description: 'Create/Update staff schedule (directors only)',
        tags: ['staff'],
        body: {
          type: 'object',
          properties: {
            staffId: { type: 'string' },
            date: { type: 'string', description: 'ISO date string' },
            startTime: { type: 'string', description: 'ISO datetime string' },
            endTime: { type: 'string', description: 'ISO datetime string' },
            status: {
              type: 'string',
              enum: ['scheduled', 'confirmed', 'off', 'sick_leave', 'vacation'],
            },
            notes: { type: 'string' },
          },
          required: ['staffId', 'date', 'startTime', 'endTime'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              staffId: { type: 'string' },
              date: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can create schedules' };
      }

      const { staffId, date, startTime, endTime, status, notes } = request.body as {
        staffId: string;
        date: string;
        startTime: string;
        endTime: string;
        status?: 'scheduled' | 'confirmed' | 'off' | 'sick_leave' | 'vacation';
        notes?: string;
      };

      const [schedule] = await app.db
        .insert(schema.staffSchedules)
        .values({
          staffId,
          date: new Date(date),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: status || 'scheduled',
          notes,
        })
        .returning();

      reply.code(201);
      return schedule;
    }
  );

  /**
   * GET /api/staff/staff-list
   * Get all staff members (directors only)
   */
  app.fastify.get(
    '/api/staff/staff-list',
    {
      schema: {
        description: 'Get all staff members (directors only)',
        tags: ['staff'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can view staff list' };
      }

      return app.db.query.userProfiles.findMany({
        where: (profile, { or, eq: eqOp }) => or(
          eqOp(profile.role, 'staff'),
          eqOp(profile.role, 'director')
        ),
      });
    }
  );

  /**
   * GET /api/staff/daily-schedule
   * Get which staff are scheduled for a specific date
   */
  app.fastify.get(
    '/api/staff/daily-schedule',
    {
      schema: {
        description: 'Get which staff are scheduled for a specific date',
        tags: ['staff'],
        querystring: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'ISO date string' },
          },
          required: ['date'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                schedule: { type: 'object' },
                staff: { type: 'object' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { date } = request.query as { date: string };
      const queryDate = new Date(date);

      // Filter schedules for the given date (matching day only)
      const dayStart = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      return app.db.query.staffSchedules.findMany({
        where: and(
          gte(schema.staffSchedules.date, dayStart),
          lte(schema.staffSchedules.date, dayEnd)
        ),
      });
    }
  );
}
