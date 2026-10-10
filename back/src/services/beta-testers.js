import { db } from "../db.js";

let schemaReadyPromise = null;

function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase();
}

function getAllowedEmails() {
  return (process.env.BETA_SHIELD_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

async function ensureBetaTestersSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = db.query(`
      CREATE TABLE IF NOT EXISTS public.beta_testers (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        invited_by_email text,
        source text not null default 'qr',
        status text not null default 'active',
        constraint beta_testers_status_check
          check (status in ('active', 'revoked')),
        constraint beta_testers_source_check
          check (source in ('qr', 'manual', 'env_import'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS beta_testers_email_lower_idx
      ON public.beta_testers(lower(email));
    `);
  }

  return schemaReadyPromise;
}

export async function upsertBetaTester({ email, invitedByEmail = null, source = "qr" }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  await ensureBetaTestersSchema();

  const result = await db.query(
    `
      INSERT INTO public.beta_testers (
        email,
        invited_by_email,
        source,
        status
      )
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (lower(email))
      DO UPDATE SET
        status = 'active',
        invited_by_email = EXCLUDED.invited_by_email,
        source = EXCLUDED.source,
        updated_at = now()
      RETURNING id, email, status, source, invited_by_email, created_at, updated_at
    `,
    [normalizedEmail, invitedByEmail, source],
  );

  return result.rows[0] ?? null;
}

export async function isBetaTesterEmailAllowed(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  if (getAllowedEmails().includes(normalizedEmail)) {
    return true;
  }

  await ensureBetaTestersSchema();

  const result = await db.query(
    `
      SELECT 1
      FROM public.beta_testers
      WHERE lower(email) = lower($1)
        AND status = 'active'
      LIMIT 1
    `,
    [normalizedEmail],
  );

  return result.rowCount > 0;
}
