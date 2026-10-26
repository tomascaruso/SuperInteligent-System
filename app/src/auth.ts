import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { queryOne, type Db } from './db.js';

export interface AuthUser {
  id: string;
  orgId: string;
  role: 'admin' | 'member';
  email: string;
  name: string;
}

interface UserRow {
  id: string;
  org_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(jwtSecret: string, user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, orgId: user.orgId, role: user.role },
    jwtSecret,
    { expiresIn: '12h' },
  );
}

export function generateWebhookSecret(): string {
  return randomBytes(24).toString('hex');
}

/** Pre-handler: exige Authorization Bearer válido y usuario existente. */
export function authenticate(db: Db, jwtSecret: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = request.headers.authorization ?? '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) {
      await reply.code(401).send({ error: 'unauthorized', message: 'Falta el token' });
      return;
    }
    let payload: { sub?: string; orgId?: string; role?: string };
    try {
      payload = jwt.verify(match[1], jwtSecret) as typeof payload;
    } catch {
      await reply.code(401).send({ error: 'unauthorized', message: 'Token inválido' });
      return;
    }
    if (!payload.sub || !payload.orgId) {
      await reply.code(401).send({ error: 'unauthorized', message: 'Token inválido' });
      return;
    }
    const row = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ?', payload.sub);
    if (!row || row.org_id !== payload.orgId) {
      await reply.code(401).send({ error: 'unauthorized', message: 'Usuario no encontrado' });
      return;
    }
    (request as unknown as { user: AuthUser }).user = {
      id: row.id,
      orgId: row.org_id,
      role: row.role as AuthUser['role'],
      email: row.email,
      name: row.name,
    };
  };
}

/** Pre-handler: exige rol admin (además de autenticación). */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as unknown as { user?: AuthUser }).user;
  if (!user || user.role !== 'admin') {
    await reply.code(403).send({ error: 'forbidden', message: 'Se requiere rol admin' });
  }
}

export function getUser(request: FastifyRequest): AuthUser {
  return (request as unknown as { user: AuthUser }).user;
}
