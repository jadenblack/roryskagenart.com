import { Pool, QueryResult, QueryResultRow } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let poolInstance: Pool | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

export function getCleanConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    '';

  // Strip query parameters so pg SSL configuration is authoritative
  return raw.replace(/\?.*$/, '');
}

export function getDbPool(): Pool {
  if (!poolInstance) {
    const connectionString = getCleanConnectionString();
    if (!connectionString) {
      throw new Error('PostgreSQL connection string is missing from environment.');
    }

    poolInstance = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    poolInstance.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client pool:', err);
    });
  }
  return poolInstance;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminInstance) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL ||
      process.env.VRCL_SUPA_SUPABASE_URL ||
      'https://orphcusijzkxpxkzapjp.supabase.co';

    const serviceKey = process.env.VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error('VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY is required for admin database operations.');
    }

    supabaseAdminInstance = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminInstance;
}

export async function checkDbHealth(): Promise<{
  connected: boolean;
  version?: string;
  artworksCount?: number;
  error?: string;
}> {
  try {
    const res = await query('SELECT version(), (SELECT count(*) FROM public.artworks) as artworks_count;');
    return {
      connected: true,
      version: res.rows[0].version,
      artworksCount: Number(res.rows[0].artworks_count || 0),
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Database connection error',
    };
  }
}
