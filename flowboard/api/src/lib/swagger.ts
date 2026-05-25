import swaggerJsdoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'FlowBoard API',
      version: '1.0.0',
      description:
        'Task management REST API. Protected endpoints require a Bearer JWT ' +
        'obtained from POST /auth/login or POST /auth/register.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    // Apply bearerAuth globally — Swagger UI will inject the Authorization header
    // on every "Try it out" request once the user clicks Authorize and enters the token.
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        TokenPair: {
          type: 'object',
          required: ['accessToken', 'refreshToken'],
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGci...' },
            refreshToken: { type: 'string', example: 'eyJhbGci...' },
          },
        },
        Board: {
          type: 'object',
          required: ['id', 'name', 'ownerId', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', minLength: 1, maxLength: 255, example: 'My Board' },
            ownerId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        BoardWithTasks: {
          allOf: [
            { $ref: '#/components/schemas/Board' },
            {
              type: 'object',
              required: ['tasks'],
              properties: {
                tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
              },
            },
          ],
        },
        Task: {
          type: 'object',
          required: ['id', 'title', 'status', 'priority', 'boardId', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', minLength: 1, maxLength: 255, example: 'Fix login bug' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            boardId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditLog: {
          type: 'object',
          required: ['id', 'userId', 'action', 'entity', 'entityId', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            action: { type: 'string', example: 'CREATE_TASK' },
            entity: { type: 'string', example: 'Task' },
            entityId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'message', 'code'],
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation error' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
