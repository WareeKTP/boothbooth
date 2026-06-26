import type { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { Errors } from '../lib/errors.js';
import { hashPassword, isStrongEnough } from '../lib/password.js';
import { getAccountDTO } from '../domain/accounts.js';
import { requireAuth, requireOwner, getAccount } from '../plugins/auth.js';

const createAccountSchema = {
  body: {
    type: 'object',
    required: ['fullName', 'email', 'password', 'boothId'],
    additionalProperties: false,
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email', maxLength: 320 },
      password: { type: 'string', minLength: 8, maxLength: 1024 },
      boothId: { type: 'string', format: 'uuid' },
    },
  },
} as const;

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { fullName: string; email: string; password: string; boothId: string } }>(
    '/accounts',
    { schema: createAccountSchema, preHandler: [requireAuth, requireOwner] },
    async (req, reply) => {
      const { fullName, email, password, boothId } = req.body;
      const { expoId } = getAccount(req);

      if (!isStrongEnough(password)) throw Errors.weakPassword();

      if (boothId) {
        const booth = await query('SELECT id FROM booths WHERE id = $1 AND expo_id = $2', [boothId, expoId]);
        if (!booth.rows.length) throw Errors.notFound('Booth not found in this expo');
      }

      const passwordHash = await hashPassword(password);
      let newId: string;
      try {
        const res = await query<{ id: string }>(
          `INSERT INTO accounts (expo_id, role, full_name, email, password_hash, booth_id)
           VALUES ($1, 'staff', $2, $3, $4, $5) RETURNING id`,
          [expoId, fullName, email, passwordHash, boothId],
        );
        newId = res.rows[0]!.id;
      } catch (err: unknown) {
        // UNIQUE (expo_id, email) violation — email already taken in this expo
        if ((err as { code?: string }).code === '23505') throw Errors.emailTaken();
        throw err;
      }

      const account = await getAccountDTO(newId);
      reply.status(201).send({ data: { account } });
    },
  );
}
