import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerParentRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * GET /api/parent/children
   * Get all children linked to authenticated parent
   */
  app.fastify.get(
    '/api/parent/children',
    {
      schema: {
        description: 'Get all children linked to authenticated parent',
        tags: ['parent'],
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

      const userId = session.user.id;

      const userChildren = await app.db.query.childParents.findMany({
        where: eq(schema.childParents.parentId, userId),
        with: {
          child: true,
        },
      });

      return userChildren.map((cp) => cp.child);
    }
  );

  /**
   * GET /api/parent/child/:childId/attendance
   * Get attendance records for a specific child
   */
  app.fastify.get(
    '/api/parent/child/:childId/attendance',
    {
      schema: {
        description: 'Get attendance records for a specific child',
        tags: ['parent'],
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
                notes: { type: 'string' },
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

      const { childId } = request.params as { childId: string };
      const userId = session.user.id;

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

      return app.db.query.attendance.findMany({
        where: eq(schema.attendance.childId, childId),
      });
    }
  );

  /**
   * GET /api/parent/child/:childId/daily-reports
   * Get daily reports for a specific child
   */
  app.fastify.get(
    '/api/parent/child/:childId/daily-reports',
    {
      schema: {
        description: 'Get daily reports for a specific child',
        tags: ['parent'],
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
                mealsTaken: { type: 'object' },
                napTime: { type: 'object' },
                activities: { type: 'string' },
                mood: { type: 'string' },
                notes: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { childId } = request.params as { childId: string };
      const userId = session.user.id;

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

      return app.db.query.dailyReports.findMany({
        where: eq(schema.dailyReports.childId, childId),
      });
    }
  );

  /**
   * GET /api/parent/messages
   * Get all messages for authenticated parent (direct + group)
   */
  app.fastify.get(
    '/api/parent/messages',
    {
      schema: {
        description: 'Get all messages for authenticated parent',
        tags: ['parent'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                senderId: { type: 'string' },
                recipientId: { type: 'string' },
                groupId: { type: 'string' },
                subject: { type: 'string' },
                content: { type: 'string' },
                isRead: { type: 'boolean' },
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

      const messages = await app.db
        .select()
        .from(schema.messages)
        .where(
          and(
            // Messages where parent is recipient (direct messages)
            // or messages in groups parent is member of
          )
        );

      // Get direct messages to parent
      const directMessages = await app.db.query.messages.findMany({
        where: eq(schema.messages.recipientId, userId),
      });

      return directMessages;
    }
  );

  /**
   * POST /api/parent/messages
   * Send a message (to staff or in a group)
   */
  app.fastify.post(
    '/api/parent/messages',
    {
      schema: {
        description: 'Send a message to staff or director',
        tags: ['parent'],
        body: {
          type: 'object',
          properties: {
            recipientId: { type: 'string', description: 'Staff member ID (for direct messages)' },
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
   * GET /api/parent/invoices
   * Get all invoices for authenticated parent
   */
  app.fastify.get(
    '/api/parent/invoices',
    {
      schema: {
        description: 'Get all invoices for authenticated parent',
        tags: ['parent'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                amount: { type: 'number' },
                dueDate: { type: 'string' },
                status: { type: 'string' },
                description: { type: 'string' },
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

      return app.db.query.invoices.findMany({
        where: eq(schema.invoices.parentId, userId),
        with: {
          payments: true,
        },
      });
    }
  );

  /**
   * GET /api/parent/invoices/:invoiceId
   * Get a specific invoice
   */
  app.fastify.get(
    '/api/parent/invoices/:invoiceId',
    {
      schema: {
        description: 'Get a specific invoice',
        tags: ['parent'],
        params: {
          type: 'object',
          properties: { invoiceId: { type: 'string' } },
          required: ['invoiceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              parentId: { type: 'string' },
              amount: { type: 'number' },
              dueDate: { type: 'string' },
              status: { type: 'string' },
              description: { type: 'string' },
              payments: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { invoiceId } = request.params as { invoiceId: string };
      const userId = session.user.id;

      const invoice = await app.db.query.invoices.findFirst({
        where: and(
          eq(schema.invoices.id, invoiceId),
          eq(schema.invoices.parentId, userId)
        ),
        with: {
          payments: true,
        },
      });

      if (!invoice) {
        reply.code(404);
        return { error: 'Invoice not found' };
      }

      return invoice;
    }
  );

  /**
   * POST /api/parent/invoices/:invoiceId/pay
   * Create a payment for an invoice
   */
  app.fastify.post(
    '/api/parent/invoices/:invoiceId/pay',
    {
      schema: {
        description: 'Create a payment for an invoice',
        tags: ['parent'],
        params: {
          type: 'object',
          properties: { invoiceId: { type: 'string' } },
          required: ['invoiceId'],
        },
        body: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Amount in cents' },
            paymentMethod: {
              type: 'string',
              enum: ['credit_card', 'bank_transfer', 'check', 'cash'],
            },
          },
          required: ['amount', 'paymentMethod'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              invoiceId: { type: 'string' },
              amount: { type: 'number' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { invoiceId } = request.params as { invoiceId: string };
      const { amount, paymentMethod } = request.body as {
        amount: number;
        paymentMethod: 'credit_card' | 'bank_transfer' | 'check' | 'cash';
      };
      const userId = session.user.id;

      // Verify invoice belongs to parent
      const invoice = await app.db.query.invoices.findFirst({
        where: and(
          eq(schema.invoices.id, invoiceId),
          eq(schema.invoices.parentId, userId)
        ),
      });

      if (!invoice) {
        reply.code(404);
        return { error: 'Invoice not found' };
      }

      const [payment] = await app.db
        .insert(schema.payments)
        .values({
          invoiceId,
          amount,
          paymentMethod,
          status: 'pending',
        })
        .returning();

      // Update invoice status if fully paid
      const totalPaid = invoice.amount;
      if (totalPaid >= invoice.amount) {
        await app.db
          .update(schema.invoices)
          .set({ status: 'paid', paidDate: new Date() })
          .where(eq(schema.invoices.id, invoiceId));
      } else if (totalPaid > 0) {
        await app.db
          .update(schema.invoices)
          .set({ status: 'partial' })
          .where(eq(schema.invoices.id, invoiceId));
      }

      reply.code(201);
      return payment;
    }
  );

  /**
   * GET /api/parent/forms
   * Get all active forms available to parents
   */
  app.fastify.get(
    '/api/parent/forms',
    {
      schema: {
        description: 'Get all active forms available to parents',
        tags: ['parent'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                content: { type: 'object' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      return app.db.query.forms.findMany({
        where: eq(schema.forms.isActive, true),
      });
    }
  );

  /**
   * GET /api/parent/form/:formId/submissions
   * Get parent's submissions for a form
   */
  app.fastify.get(
    '/api/parent/form/:formId/submissions',
    {
      schema: {
        description: "Get parent's submissions for a form",
        tags: ['parent'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                formId: { type: 'string' },
                responses: { type: 'object' },
                status: { type: 'string' },
                submittedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { formId } = request.params as { formId: string };
      const userId = session.user.id;

      return app.db.query.formSubmissions.findMany({
        where: and(
          eq(schema.formSubmissions.formId, formId),
          eq(schema.formSubmissions.parentId, userId)
        ),
      });
    }
  );

  /**
   * POST /api/parent/form/:formId/submit
   * Submit a form
   */
  app.fastify.post(
    '/api/parent/form/:formId/submit',
    {
      schema: {
        description: 'Submit a form',
        tags: ['parent'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
        },
        body: {
          type: 'object',
          properties: {
            responses: { type: 'object' },
            childId: { type: 'string', description: 'Optional: associated child' },
          },
          required: ['responses'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              formId: { type: 'string' },
              status: { type: 'string' },
              submittedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { formId } = request.params as { formId: string };
      const { responses, childId } = request.body as {
        responses: Record<string, any>;
        childId?: string;
      };
      const userId = session.user.id;

      // Verify form exists and is active
      const form = await app.db.query.forms.findFirst({
        where: and(
          eq(schema.forms.id, formId),
          eq(schema.forms.isActive, true)
        ),
      });

      if (!form) {
        reply.code(404);
        return { error: 'Form not found' };
      }

      const [submission] = await app.db
        .insert(schema.formSubmissions)
        .values({
          formId,
          parentId: userId,
          childId: childId || null,
          responses,
          status: 'submitted',
          submittedAt: new Date(),
        })
        .returning();

      reply.code(201);
      return submission;
    }
  );
}
