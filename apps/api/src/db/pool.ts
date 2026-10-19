import mysql from 'mysql2/promise';
import type { Config } from '../config';

export type Db = mysql.Pool;
export type Conn = mysql.PoolConnection;
export type Queryable = Db | Conn;

export function createPool(config: Config): Db {
  const pool = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
  });
  // Semua waktu disimpan dan dibandingkan dalam UTC supaya tidak bergantung zona waktu server MySQL.
  pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

/** SELECT berparameter. Selalu memakai prepared statement. */
export async function rows<T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  const [res] = await db.execute(sql, params as never[]);
  return res as T[];
}

export async function row<T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(db, sql, params))[0];
}

export async function run(db: Queryable, sql: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
  const [res] = await db.execute<mysql.ResultSetHeader>(sql, params as never[]);
  return res;
}

export async function withTransaction<T>(db: Db, fn: (conn: Conn) => Promise<T>): Promise<T> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export function isDuplicateError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'ER_DUP_ENTRY';
}
