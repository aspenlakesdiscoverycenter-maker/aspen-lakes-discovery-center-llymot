import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

/**
 * Enhanced Daily Report Data Structures
 */
interface MealDescription {
  description: string;
  amount?: string;
}

interface MealsData {
  breakfast?: MealDescription;
  lunch?: MealDescription;
  snack?: MealDescription;
  dinner?: MealDescription;
}

interface NapTimeData {
  startTime?: string;
  endTime?: string;
  duration?: string;
}

interface MediaFile {
  url: string;
  filename: string;
  uploadedAt: string;
  size?: number;
}

interface MedicationReport {
  medicationName: string;
  dosage: string;
  time: string;
  administeredBy: string;
  notes?: string;
}

interface IncidentReport {
  type: string;
  description: string;
  time: string;
  actionTaken: string;
  reportedBy: string;
  severity: 'low' | 'medium' | 'high';
}

export function registerEnhancedDailyReportRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * Helper to enrich report with reactions and comments
   */
  async function enrichReportWithInteractions(reportId: string, parentId?: string) {
    const reactions = await app.db.query.reportReactions.findMany({
      where: eq(schema.reportReactions.reportId, reportId),
    });

    const comments = await app.db.query.reportComments.findMany({
      where: eq(schema.reportComments.reportId, reportId),
    });

    // Get parent names for comments
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const parentProfile = await app.db.query.userProfiles.findFirst({
          where: eq(schema.userProfiles.userId, comment.parentId),
        });

        return {
          id: comment.id,
          parentId: comment.parentId,
          parentName: `${parentProfile?.firstName} ${parentProfile?.lastName}`,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          canEdit: parentId === comment.parentId,
        };
      })
    );

    // Count reactions by type
    const reactionCounts = {
      heart: reactions.filter((r) => r.reactionType === 'heart').length,
      thumbs_up: reactions.filter((r) => r.reactionType === 'thumbs_up').length,
      smile: reactions.filter((r) => r.reactionType === 'smile').length,
      love: reactions.filter((r) => r.reactionType === 'love').length,
    };

    // Get parent's own reaction if they have one
    const parentReaction = parentId
      ? reactions.find((r) => r.parentId === parentId)?.reactionType
      : null;

    return {
      reactionCounts,
      parentReaction,
      comments: enrichedComments,
      totalComments: comments.length,
      totalReactions: reactions.length,
    };
  }

  // ==================== STAFF ENDPOINTS ====================

  /**
   * POST /api/staff/daily-reports/media/upload
   * Upload photo or video to daily report
   * (Simulated - in production would use S3 or similar)
   */
  app.fastify.post(
    '/api/staff/daily-reports/media/upload',
    {
      schema: {
        description: 'Upload photo or video for daily report',
        tags: ['daily-reports'],
        body: {
          type: 'object',
          properties: {
            fileData: { type: 'string', description: 'Base64 encoded file or URL' },
            filename: { type: 'string' },
            fileType: { type: 'string', enum: ['photo', 'video'] },
            mimeType: { type: 'string' },
            size: { type: 'number' },
          },
          required: ['fileData', 'filename', 'fileType', 'mimeType'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              filename: { type: 'string' },
              uploadedAt: { type: 'string' },
              size: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { fileData, filename, fileType, mimeType, size } = request.body as {
        fileData: string;
        filename: string;
        fileType: 'photo' | 'video';
        mimeType: string;
        size?: number;
      };

      // Validate file types and sizes
      const photoMimeTypes = ['image/jpeg', 'image/png'];
      const videoMimeTypes = ['video/mp4', 'video/quicktime'];
      const maxPhotoSize = 10 * 1024 * 1024; // 10MB
      const maxVideoSize = 100 * 1024 * 1024; // 100MB

      if (fileType === 'photo') {
        if (!photoMimeTypes.includes(mimeType)) {
          reply.code(400);
          return { error: 'Invalid photo format. Supported: jpg, png' };
        }
        if (size && size > maxPhotoSize) {
          reply.code(400);
          return { error: 'Photo exceeds 10MB limit' };
        }
      } else if (fileType === 'video') {
        if (!videoMimeTypes.includes(mimeType)) {
          reply.code(400);
          return { error: 'Invalid video format. Supported: mp4, mov' };
        }
        if (size && size > maxVideoSize) {
          reply.code(400);
          return { error: 'Video exceeds 100MB limit' };
        }
      }

      // In production, upload to S3/cloud storage
      // For now, simulate with data URL
      const uploadedAt = new Date();
      const simulatedUrl = `https://media.daycare.app/${fileType}s/${Date.now()}-${filename}`;

      reply.code(201);
      return {
        url: simulatedUrl,
        filename,
        uploadedAt: uploadedAt.toISOString(),
        size: size || 0,
      };
    }
  );

  // POST /api/staff/daily-reports and PUT routes are in dailyreports.ts
  // This file provides enhancements for media uploads and parent interactions

  // ==================== PARENT ENDPOINTS ====================

  /**
   * GET /api/parent/daily-reports/:childId
   * Get daily reports for child with reactions and comments
   */
  app.fastify.get(
    '/api/parent/daily-reports/:childId/enhanced',
    {
      schema: {
        description: 'Get daily reports with reactions and comments',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
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

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'parent') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

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

      const reports = await app.db.query.dailyReports.findMany({
        where: eq(schema.dailyReports.childId, childId),
      });

      const enriched = await Promise.all(
        reports.map(async (report) => {
          const interactions = await enrichReportWithInteractions(report.id, userId);

          return {
            id: report.id,
            childId: report.childId,
            date: report.date.toISOString(),
            mealsTaken: report.mealsTaken,
            napTime: report.napTime,
            activities: report.activities,
            mood: report.mood,
            notes: report.notes,
            photos: report.photos,
            videos: report.videos,
            medications: report.medications,
            incidents: report.incidents,
            createdAt: report.createdAt.toISOString(),
            ...interactions,
          };
        })
      );

      return enriched;
    }
  );

  /**
   * POST /api/parent/daily-reports/:reportId/reactions
   * Add or update parent's reaction to a report
   */
  app.fastify.post(
    '/api/parent/daily-reports/:reportId/reactions',
    {
      schema: {
        description: 'Add or update reaction to daily report',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { reportId: { type: 'string' } },
          required: ['reportId'],
        },
        body: {
          type: 'object',
          properties: {
            reactionType: {
              type: 'string',
              enum: ['heart', 'thumbs_up', 'smile', 'love'],
            },
          },
          required: ['reactionType'],
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { reportId } = request.params as { reportId: string };
      const { reactionType } = request.body as {
        reactionType: 'heart' | 'thumbs_up' | 'smile' | 'love';
      };

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'parent') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const report = await app.db.query.dailyReports.findFirst({
        where: eq(schema.dailyReports.id, reportId),
      });

      if (!report) {
        reply.code(404);
        return { error: 'Report not found' };
      }

      const hasAccess = await app.db.query.childParents.findFirst({
        where: and(
          eq(schema.childParents.childId, report.childId),
          eq(schema.childParents.parentId, userId)
        ),
      });

      if (!hasAccess) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      // Check if parent already has a reaction
      const existingReaction = await app.db.query.reportReactions.findFirst({
        where: and(
          eq(schema.reportReactions.reportId, reportId),
          eq(schema.reportReactions.parentId, userId)
        ),
      });

      if (existingReaction) {
        // Update existing reaction
        const [updated] = await app.db
          .update(schema.reportReactions)
          .set({ reactionType, updatedAt: new Date() })
          .where(eq(schema.reportReactions.id, existingReaction.id))
          .returning();

        reply.code(201);
        return { id: updated.id };
      } else {
        // Create new reaction
        const [created] = await app.db
          .insert(schema.reportReactions)
          .values({
            reportId,
            parentId: userId,
            reactionType,
          })
          .returning();

        reply.code(201);
        return { id: created.id };
      }
    }
  );

  /**
   * DELETE /api/parent/daily-reports/:reportId/reactions
   * Remove parent's reaction from a report
   */
  app.fastify.delete(
    '/api/parent/daily-reports/:reportId/reactions',
    {
      schema: {
        description: 'Remove reaction from daily report',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { reportId: { type: 'string' } },
          required: ['reportId'],
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
      const { reportId } = request.params as { reportId: string };

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'parent') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      await app.db.delete(schema.reportReactions).where(
        and(
          eq(schema.reportReactions.reportId, reportId),
          eq(schema.reportReactions.parentId, userId)
        )
      );

      return { success: true };
    }
  );

  /**
   * POST /api/parent/daily-reports/:reportId/comments
   * Add comment to daily report
   */
  app.fastify.post(
    '/api/parent/daily-reports/:reportId/comments',
    {
      schema: {
        description: 'Add comment to daily report',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { reportId: { type: 'string' } },
          required: ['reportId'],
        },
        body: {
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
          required: ['content'],
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { reportId } = request.params as { reportId: string };
      const { content } = request.body as { content: string };

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'parent') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const report = await app.db.query.dailyReports.findFirst({
        where: eq(schema.dailyReports.id, reportId),
      });

      if (!report) {
        reply.code(404);
        return { error: 'Report not found' };
      }

      const hasAccess = await app.db.query.childParents.findFirst({
        where: and(
          eq(schema.childParents.childId, report.childId),
          eq(schema.childParents.parentId, userId)
        ),
      });

      if (!hasAccess) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const [comment] = await app.db
        .insert(schema.reportComments)
        .values({
          reportId,
          parentId: userId,
          content,
        })
        .returning();

      reply.code(201);
      return { id: comment.id };
    }
  );

  /**
   * PUT /api/parent/daily-reports/comments/:commentId
   * Update own comment
   */
  app.fastify.put(
    '/api/parent/daily-reports/comments/:commentId',
    {
      schema: {
        description: 'Update own comment',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { commentId: { type: 'string' } },
          required: ['commentId'],
        },
        body: {
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
          required: ['content'],
        },
        response: {
          200: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { commentId } = request.params as { commentId: string };
      const { content } = request.body as { content: string };

      const comment = await app.db.query.reportComments.findFirst({
        where: eq(schema.reportComments.id, commentId),
      });

      if (!comment) {
        reply.code(404);
        return { error: 'Comment not found' };
      }

      if (comment.parentId !== userId) {
        reply.code(403);
        return { error: 'Can only edit your own comments' };
      }

      const [updated] = await app.db
        .update(schema.reportComments)
        .set({ content, updatedAt: new Date() })
        .where(eq(schema.reportComments.id, commentId))
        .returning();

      return { id: updated.id };
    }
  );

  /**
   * DELETE /api/parent/daily-reports/comments/:commentId
   * Delete own comment
   */
  app.fastify.delete(
    '/api/parent/daily-reports/comments/:commentId',
    {
      schema: {
        description: 'Delete own comment',
        tags: ['daily-reports'],
        params: {
          type: 'object',
          properties: { commentId: { type: 'string' } },
          required: ['commentId'],
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
      const { commentId } = request.params as { commentId: string };

      const comment = await app.db.query.reportComments.findFirst({
        where: eq(schema.reportComments.id, commentId),
      });

      if (!comment) {
        reply.code(404);
        return { error: 'Comment not found' };
      }

      if (comment.parentId !== userId) {
        reply.code(403);
        return { error: 'Can only delete your own comments' };
      }

      await app.db.delete(schema.reportComments).where(eq(schema.reportComments.id, commentId));

      return { success: true };
    }
  );
}
