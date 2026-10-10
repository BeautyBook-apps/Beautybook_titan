import './env.js';
import pg from 'pg';
import { HttpError } from '../lib/errors.js';
let pool;
export function databaseOptions(env=process.env) {
  if (!env.DATABASE_URL) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'La base de données du backend n’est pas configurée.');
  let url;try{url=new URL(env.DATABASE_URL);}catch{}
  if(!url||!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||url.pathname.length<2||url.hash)throw new HttpError(503,'DATABASE_URL_INVALID','DATABASE_URL doit contenir la connexion PostgreSQL du menu Connect de Supabase, et non son URL REST.');
  let credentials;try{credentials={user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:decodeURIComponent(url.pathname.slice(1))};}catch{throw new HttpError(503,'DATABASE_URL_INVALID','Le mot de passe PostgreSQL doit être encodé dans l’URL.');}
  const allowInsecureLocalTls = env.NODE_ENV !== 'production' && env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false';
  return {
    ...credentials,host:url.hostname.replace(/^\[|\]$/g,''),port:Number(url.port||5432),
    // Explicit parameters prevent sslmode URL options from disabling certificate verification.
    ssl: env.DATABASE_SSL === 'disable' && env.NODE_ENV !== 'production' ? false : {
      rejectUnauthorized: !allowInsecureLocalTls, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replaceAll('\\n', '\n') } : {}),
    },
    max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000, statement_timeout: 15000,
  };
}
export function getPool() {
  pool ||= new pg.Pool(databaseOptions());
  return pool;
}
export async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}
export default { query: (sql, params) => getPool().query(sql, params), transaction };
