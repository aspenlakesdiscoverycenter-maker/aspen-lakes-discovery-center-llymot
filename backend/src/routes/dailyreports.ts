import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

/**
 * Daily report data structures
 */
interface MealsTaken {
  breakfast?: string;
  lunch?: string;
  snack?: string;
  dinner?: string;
}

interface NapTime {
  startTime?: string;
  endTime?: string;
  duration?: string;
}

export function registerDailyReportRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * Helper function to enrich daily report with child name
   */
  async function enrichReportWithChildName(
    report: typeof schema.dailyReports.$inferSelect
  ): Promise<{
    id: string;
    childId: string;
    childName: string;
    date: Date;
    mealsTaken: MealsTaken | null;
    napTime: NapTime | null;
    activities: string | null;
    mood: string | null;
    notes: string | null;
    photos: string[] | null;
    createdAt: Date;
  }> {
    const child = await app.db.query.children.findFirst({
      where: eq(schema.children.id, report.childId),
    });

    return {
      id: report.id,
      childId: report.childId,
      childName: child ? `${child.firstName} ${child.lastName}` : 'Unknown',
      date: report.date,
      mealsTaken: report.mealsTaken as MealsTaken | null,
      napTime: report.napTime as NapTime | null,
      activities: report.activities,
      mood: report.mood,
      notes: report.notes,
      photos: report.photos as string[] | null,
      createdAt: report.createdAt,
    };
  }

  // ==================== STAFF ENDPOINTS ====================

  /**
   * GET /api/staff/daily-reports
   * Get all daily reports created by staff member
   */
  app.fastify.get(
    '/api/staff/daily-reports',
    {
      schema: {
        description: 'Get all daily reports for authenticated staff',
        tags: ['daily-reports'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                childId: { type: 'string' },
                childName: { type: 'string' },
                date: { type: 'string' },
                mealsTaken: { type: 'object' },
                napTime: { type: 'object' },
                activities: { type: 'string' },
                mood: { type: 'string' },
                notes: { type: 'string' },
                photos: { type: 'array' },
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

      const userId = session.user.id;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const reports = await app.db.query.dailyReports.findMany({
        where: eq(schema.dailyReports.staffId, userId),
      });

      // Enrich with child names
      const enriched = await Promise.all(reports.map(enrichReportWithChildName));

      return enriched.map((r) => ({
        id: r.id,
        childId: r.childId,
        childName: r.childName,
        date: r.date.toISOString(),
        mealsTaken: r.mealsTaken,
        napTime: r.napTime,
        activities: r.activities,
        mood: r.mood,
        notes: r.notes,
        photos: r.photos,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );

  /**
   * GET /api/staff/daily-reports/:childId
   * Get daily reports for a specific child (with optional date range)
   */
  app.fastify.get(
    '/api/staff/daily-reports/:childId',
    {
      schema: {
        description: 'Get daily reports for a specific child',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { childId } = request.params as { childId: string };
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const conditions = [eq(schema.dailyReports.childId, childId)];

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        conditions.push(gte(schema.dailyReports.date, start));
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(schema.dailyReports.date, end));
      }

      const reports = await app.db.query.dailyReports.findMany({
        where: and(...conditions),
      });

      // Enrich with child names
      const enriched = await Promise.all(reports.map(enrichReportWithChildName));

      return enriched.map((r) => ({
        id: r.id,
        childId: r.childId,
        childName: r.childName,
        date: r.date.toISOString(),
        mealsTaken: r.mealsTaken,
        napTime: r.napTime,
        activities: r.activities,
        mood: r.mood,
        notes: r.notes,
        photos: r.photos,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );

  /**
   * POST /api/staff/daily-reports
   * Create a new daily report
   */
  app.fastify.post(
    '/api/staff/daily-reports',
    {
      schema: {
        description: 'Create a new daily report',
        tags: ['daily-reports'],
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            date: { type: 'string', description: 'ISO date string' },
            mealsTaken: {
              type: 'object',
              properties: {
                breakfast: { type: 'string' },
                lunch: { type: 'string' },
                snack: { type: 'string' },
                dinner: { type: 'string' },
              },
            },
            napTime: {
              type: 'object',
              properties: {
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                duration: { type: 'string' },
              },
            },
            activities: { type: 'string' },
            mood: {
              type: 'string',
              enum: ['happy', 'good', 'neutral', 'fussy', 'upset'],
            },
            notes: { type: 'string' },
            photos: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of photo URLs',
            },
          },
          required: ['childId', 'date'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              childId: { type: 'string' },
              childName: { type: 'string' },
              date: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { childId, date, mealsTaken, napTime, activities, mood, notes, photos } =
        request.body as {
          childId: string;
          date: string;
          mealsTaken?: MealsTaken;
          napTime?: NapTime;
          activities?: string;
          mood?: 'happy' | 'good' | 'neutral' | 'fussy' | 'upset';
          notes?: string;
          photos?: string[];
        };

      // Verify child exists
      const child = await app.db.query.children.findFirst({
        where: eq(schema.children.id, childId),
      });

      if (!child) {
        reply.code(404);
        return { error: 'Child not found' };
      }

      const [report] = await app.db
        .insert(schema.dailyReports)
        .values({
          childId,
          staffId: userId,
          date: new Date(date),
          mealsTaken: mealsTaken || null,
          napTime: napTime || null,
          activities: activities || null,
          mood: (mood || null) as 'happy' | 'good' | 'neutral' | 'fussy' | 'upset' | null,
          notes: notes || null,
          photos: photos || null,
        })
        .returning();

      reply.code(201);
      return {
        id: report.id,
        childId: report.childId,
        childName: `${child.firstName} ${child.lastName}`,
        date: report.date.toISOString(),
      };
    }
  );

  /**
   * PUT /api/staff/daily-reports/:id
   * Update an existing daily report
   */
  app.fastify.put(
    '/api/staff/daily-reports/:id',
    {
      schema: {
        description: 'Update an existing daily report',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            mealsTaken: { type: 'object' },
            napTime: { type: 'object' },
            activities: { type: 'string' },
            mood: { type: 'string' },
            notes: { type: 'string' },
            photos: { type: 'array' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              childId: { type: 'string' },
              childName: { type: 'string' },
              date: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params as { id: string };

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const existingReport = await app.db.query.dailyReports.findFirst({
        where: eq(schema.dailyReports.id, id),
      });

      if (!existingReport) {
        reply.code(404);
        return { error: 'Report not found' };
      }

      // Verify staff member owns the report (or is director)
      if (existingReport.staffId !== userId && userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Can only update your own reports' };
      }

      const { mealsTaken, napTime, activities, mood, notes, photos } = request.body as {
        mealsTaken?: MealsTaken;
        napTime?: NapTime;
        activities?: string;
        mood?: string;
        notes?: string;
        photos?: string[];
      };

      const updateData: Record<string, unknown> = {};
      if (mealsTaken !== undefined) updateData.mealsTaken = mealsTaken;
      if (napTime !== undefined) updateData.napTime = napTime;
      if (activities !== undefined) updateData.activities = activities;
      if (mood !== undefined) updateData.mood = mood;
      if (notes !== undefined) updateData.notes = notes;
      if (photos !== undefined) updateData.photos = photos;
      updateData.updatedAt = new Date();

      const [updated] = await app.db
        .update(schema.dailyReports)
        .set(updateData)
        .where(eq(schema.dailyReports.id, id))
        .returning();

      const child = await app.db.query.children.findFirst({
        where: eq(schema.children.id, updated.childId),
      });

      return {
        id: updated.id,
        childId: updated.childId,
        childName: child ? `${child.firstName} ${child.lastName}` : 'Unknown',
        date: updated.date.toISOString(),
      };
    }
  );

  /**
   * DELETE /api/staff/daily-reports/:id
   * Delete a daily report
   */
  app.fastify.delete(
    '/api/staff/daily-reports/:id',
    {
      schema: {
        description: 'Delete a daily report',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params as { id: string };

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const existingReport = await app.db.query.dailyReports.findFirst({
        where: eq(schema.dailyReports.id, id),
      });

      if (!existingReport) {
        reply.code(404);
        return { error: 'Report not found' };
      }

      // Verify staff member owns the report (or is director)
      if (existingReport.staffId !== userId && userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Can only delete your own reports' };
      }

      await app.db.delete(schema.dailyReports).where(eq(schema.dailyReports.id, id));

      return { success: true };
    }
  );

  // ==================== PARENT ENDPOINTS ====================

  /**
   * GET /api/parent/daily-reports
   * Get daily reports for all parent's children
   */
  app.fastify.get(
    '/api/parent/daily-reports',
    {
      schema: {
        description: "Get daily reports for all parent's children",
        tags: ['daily-reports'],
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is parent
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'parent') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      // Get all children for this parent
      const parentChildren = await app.db.query.childParents.findMany({
        where: eq(schema.childParents.parentId, userId),
      });

      if (parentChildren.length === 0) {
        return [];
      }

      const childIds = parentChildren.map((pc) => pc.childId);

      // Get all reports for these children
      const reports = await app.db.query.dailyReports.findMany({
        where: (table, { inArray: inArrayOp }) => inArrayOp(table.childId, childIds),
      });

      // Enrich with child names
      const enriched = await Promise.all(reports.map(enrichReportWithChildName));

      return enriched.map((r) => ({
        id: r.id,
        childId: r.childId,
        childName: r.childName,
        date: r.date.toISOString(),
        mealsTaken: r.mealsTaken,
        napTime: r.napTime,
        activities: r.activities,
        mood: r.mood,
        notes: r.notes,
        photos: r.photos,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );

  /**
   * GET /api/parent/daily-reports/:childId
   * Get daily reports for a specific child (with optional date range)
   */
  app.fastify.get(
    '/api/parent/daily-reports/:childId',
    {
      schema: {
        description: 'Get daily reports for a specific child',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { childId } = request.params as { childId: string };
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      // Verify user is parent
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'parent') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      // Verify parent has access to this child
      const hasAccess = await app.db.query.childParents.findFirst({
        where: and(
          eq(schema.childParents.childId, childId),
          eq(schema.childParents.parentId, userId)
        ),
      });

      if (!hasAccess) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const conditions = [eq(schema.dailyReports.childId, childId)];

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        conditions.push(gte(schema.dailyReports.date, start));
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(schema.dailyReports.date, end));
      }

      const reports = await app.db.query.dailyReports.findMany({
        where: and(...conditions),
      });

      // Enrich with child names
      const enriched = await Promise.all(reports.map(enrichReportWithChildName));

      return enriched.map((r) => ({
        id: r.id,
        childId: r.childId,
        childName: r.childName,
        date: r.date.toISOString(),
        mealsTaken: r.mealsTaken,
        napTime: r.napTime,
        activities: r.activities,
        mood: r.mood,
        notes: r.notes,
        photos: r.photos,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );
}
