import { mkdir, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  emailRequestSchema,
  tokenSchema,
  resetSchema,
} from '../src/modules/auth/auth.schema.js';
import {
  createCourseSchema,
  updateCourseSchema,
  lecturerSchema,
  studentSchema,
} from '../src/modules/courses/courses.schema.js';
import { userStateSchema } from '../src/modules/users/users.service.js';

type ObjectSchema = Record<string, unknown>;
const str = { type: 'string' };
const date = { type: ['string', 'null'], format: 'date-time' };
const uuid = { type: 'string', format: 'uuid' };
const message = {
  type: 'object',
  required: ['message'],
  properties: { message: str },
  additionalProperties: false,
};
const user = {
  type: 'object',
  required: ['id', 'email', 'name', 'role', 'isActive', 'emailVerifiedAt', 'lecturerApprovedAt'],
  properties: {
    id: uuid,
    email: { type: 'string', format: 'email' },
    name: str,
    role: { type: 'string', enum: ['STUDENT', 'LECTURER', 'ADMIN'] },
    isActive: { type: 'boolean' },
    emailVerifiedAt: date,
    lecturerApprovedAt: date,
  },
  additionalProperties: false,
};
const course = {
  type: 'object',
  required: [
    'id',
    'title',
    'description',
    'status',
    'archivedAt',
    'ownerId',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: uuid,
    title: str,
    description: str,
    status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] },
    archivedAt: date,
    ownerId: uuid,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};
const membership = {
  type: 'object',
  required: ['courseId', 'memberId', 'kind', 'enrolled'],
  properties: {
    courseId: uuid,
    memberId: uuid,
    kind: { type: 'string', enum: ['STUDENT', 'LECTURER'] },
    enrolled: { type: 'boolean' },
  },
  additionalProperties: false,
};
const audit = {
  type: 'object',
  required: ['id', 'actorId', 'action', 'resourceId', 'requestId', 'metadata', 'createdAt'],
  properties: {
    id: uuid,
    actorId: { type: ['string', 'null'], format: 'uuid' },
    action: str,
    resourceId: uuid,
    requestId: str,
    metadata: { type: ['object', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};
const list = (item: ObjectSchema) => ({
  type: 'object',
  required: ['items', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: item },
    page: { type: 'integer' },
    limit: { type: 'integer' },
  },
  additionalProperties: false,
});
const paths: Record<string, Record<string, unknown>> = {};
function add(
  method: string,
  path: string,
  summary: string,
  options: {
    body?: z.ZodType;
    data?: ObjectSchema;
    public?: boolean;
    roles?: string[];
    status?: number;
    paginated?: boolean;
    details?: string;
  } = {},
) {
  const parameters: unknown[] = [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: uuid,
  }));
  if (method !== 'get')
    parameters.push({
      name: 'Origin',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uri' },
      description: 'Must exactly match an origin in FRONTEND_ORIGINS.',
    });
  if (options.paginated)
    for (const [name, max, initial] of [
      ['page', 10000, 1],
      ['limit', 100, 20],
    ] as const)
      parameters.push({
        name,
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: max, default: initial },
      });
  const data = options.data ?? message;
  const code = options.status ?? 200;
  const responses: Record<string, unknown> = {
    [code]: {
      description: 'Success',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['data', 'meta'],
            properties: { data, meta: { $ref: '#/components/schemas/Meta' } },
            additionalProperties: false,
          },
        },
      },
    },
  };
  for (const status of ['400', '401', '403', '404', '409', '413', '429', '500', '503'])
    responses[status] = {
      description: `HTTP ${status} safe error response`,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    };
  const description = [
    `MVP foundation. ${options.public ? 'Public account or health endpoint.' : `Allowed roles: ${(options.roles ?? ['STUDENT', 'LECTURER', 'ADMIN']).join(', ')}.`}`,
    options.details ?? '',
    path.startsWith('/auth/') && path !== '/auth/me' && path !== '/auth/logout'
      ? 'Authentication endpoints share a limit of 20 attempts per IP per 15 minutes. Other application requests share 300 requests per IP per minute.'
      : 'Application limit: 300 requests per IP per minute; health endpoints are exempt.',
    method !== 'get'
      ? 'Writes require an allowed Origin. Validation rejects unknown fields. Cookie credentials require the browser credentials option.'
      : '',
  ].join(' ');
  const operation: ObjectSchema = {
    summary,
    description,
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    security: options.public ? [] : [{ sessionCookie: [] }],
    parameters,
    responses,
  };
  if (options.body)
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: z.toJSONSchema(options.body, { io: 'input', unrepresentable: 'any' }),
        },
      },
    };
  (paths[path] ??= {})[method] = operation;
}
add('get', '/health', 'Process liveness', {
  public: true,
  data: { type: 'object', required: ['status'], properties: { status: { const: 'ok' } } },
  details: 'Does not query the database.',
});
add('get', '/ready', 'Database readiness', {
  public: true,
  data: { type: 'object', required: ['status'], properties: { status: { const: 'ready' } } },
  details: 'Returns 503 if database connectivity fails.',
});
add('post', '/auth/register', 'Register a student or pending lecturer', {
  public: true,
  body: registerSchema,
  status: 202,
  details:
    'Registration and duplicate registration return the same generic response. No session, verification token, or password is returned. Lecturer roles remain pending approval.',
});
add('post', '/auth/verify-email', 'Consume a single-use verification token', {
  public: true,
  body: tokenSchema,
});
add('post', '/auth/resend-verification', 'Request a verification link', {
  public: true,
  body: emailRequestSchema,
  status: 202,
  details: 'Invalidates prior unused verification links. Uses a generic response.',
});
add('post', '/auth/forgot-password', 'Request a recovery link', {
  public: true,
  body: emailRequestSchema,
  status: 202,
  details: 'Always responds generically. Recovery links expire after one hour.',
});
add('post', '/auth/reset-password', 'Reset password and revoke sessions', {
  public: true,
  body: resetSchema,
  details: 'Single-use token. Revokes all sessions and outstanding reset tokens.',
});
add('post', '/auth/login', 'Sign in with verified email credentials', {
  public: true,
  body: loginSchema,
  data: { type: 'object', required: ['user'], properties: { user }, additionalProperties: false },
  details:
    'Sets lms_session HttpOnly SameSite Lax cookie. Requires verified email, active account, and lecturer approval when applicable.',
});
add('post', '/auth/logout', 'Revoke the current session', {
  details: 'Deletes the server session and clears the cookie.',
});
add('get', '/auth/me', 'Read current safe account profile', { data: user });
add('patch', '/users/me', 'Update own display name', {
  body: z.strictObject({ name: z.string().trim().min(2).max(100) }),
  data: user,
  details: 'Does not accept role, account status, or email changes.',
});
add('get', '/admin/users', 'List users', { roles: ['ADMIN'], paginated: true, data: list(user) });
add('post', '/admin/users/{id}/approve-lecturer', 'Approve a verified active lecturer', {
  roles: ['ADMIN'],
  data: user,
  details:
    'Repeated approval is idempotent. Rejects users who are inactive, unverified, or not lecturers.',
});
add('patch', '/admin/users/{id}', 'Change role or active account state', {
  roles: ['ADMIN'],
  body: userStateSchema,
  data: user,
  details:
    'Revokes sessions on deactivation or role change. Protects the last active administrator. New lecturer role requires fresh approval. Saves audit history transactionally.',
});
add('get', '/admin/audit-logs', 'List redacted audit records', {
  roles: ['ADMIN'],
  paginated: true,
  data: list(audit),
});
add('get', '/courses', 'List accessible courses', {
  paginated: true,
  data: list(course),
  details:
    'Students see published enrolled courses; lecturers see assigned courses; administrators see all shells. Archived eligible courses remain readable.',
});
add('get', '/courses/{id}', 'Read an accessible course', {
  data: course,
  details: 'Same membership rules as course list. Returns 404 for inaccessible records.',
});
add('post', '/courses', 'Create a draft course shell', {
  roles: ['ADMIN'],
  body: createCourseSchema,
  data: course,
  status: 201,
});
add('patch', '/courses/{id}', 'Edit a course shell', {
  roles: ['ADMIN'],
  body: updateCourseSchema,
  data: course,
  details: 'Rejects archived courses and edits to ownership or status.',
});
add('post', '/courses/{id}/publish', 'Publish a course shell', {
  roles: ['ADMIN'],
  data: course,
  details: 'Rejects archived courses. Lesson publishing is a later implementation slice.',
});
add('post', '/courses/{id}/archive', 'Archive a course', {
  roles: ['ADMIN'],
  data: course,
  details:
    'Idempotent archival preserves visibility and existing membership; rejects later course edits and new members.',
});
add('post', '/courses/{id}/enrolments', 'Enrol a verified active student', {
  roles: ['ADMIN'],
  body: studentSchema,
  data: membership,
  details: 'Duplicate enrolment is idempotent. Rejects archived courses and ineligible users.',
});
add('delete', '/courses/{id}/enrolments/{memberId}', 'Remove student enrolment', {
  roles: ['ADMIN'],
  data: membership,
  details:
    'Idempotent removal immediately blocks future course access. Removal is permitted on archived courses.',
});
add('post', '/courses/{id}/lecturers', 'Assign an approved lecturer', {
  roles: ['ADMIN'],
  body: lecturerSchema,
  data: membership,
  details:
    'Duplicate assignment is idempotent. Requires verified active approved lecturer and non-archived course.',
});
add('delete', '/courses/{id}/lecturers/{memberId}', 'Remove lecturer assignment', {
  roles: ['ADMIN'],
  data: membership,
  details: 'Idempotent removal revokes course access and remains permitted on archived courses.',
});

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Thriving in Tech LMS Foundation API',
    version: '0.1.0',
    description:
      'FR01 and FR02 foundation plus FR03 course shells. Local mailbox and Resend email transports. Remaining MVP modules are not implemented.',
  },
  servers: [{ url: '/api/v1' }],
  paths,
  components: {
    securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'lms_session' } },
    schemas: {
      Meta: {
        type: 'object',
        required: ['requestId'],
        properties: { requestId: uuid },
        additionalProperties: false,
      },
      Error: {
        type: 'object',
        required: ['error', 'meta'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: str,
              message: str,
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { path: str, message: str },
                  required: ['path', 'message'],
                },
              },
            },
          },
          meta: { $ref: '#/components/schemas/Meta' },
        },
      },
    },
  },
};
await mkdir('docs', { recursive: true });
await writeFile(
  'docs/openapi.json',
  await format(JSON.stringify(document), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
    trailingComma: 'all',
  }),
);
console.log(
  `Generated OpenAPI for ${Object.values(paths).reduce((sum, p) => sum + Object.keys(p).length, 0)} operations.`,
);
