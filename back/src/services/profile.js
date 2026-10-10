import { db } from "../db.js";

export function mapProfileRow(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    phone: row.phone,
    city: row.city,
    state: row.state,
    country: row.country,
    isPublic: row.is_public,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    emailVerifiedAt: row.email_verified_at ?? null,
  };
}

export async function getProfile({ profileId, client = db }) {
  const result = await client.query(
    `
      SELECT
        p.*,
        u.email,
        u.email_verified_at
      FROM public.profiles p
      JOIN public.app_users u ON u.id = p.id
      WHERE p.id = $1
        AND u.status = 'active'
      LIMIT 1
    `,
    [profileId],
  );

  return result.rows[0] ? mapProfileRow(result.rows[0]) : null;
}

export async function updateProfile({
  profileId,
  displayName,
  bio,
  phone,
  city,
  state,
  client = db,
}) {
  const result = await client.query(
    `
      UPDATE public.profiles
      SET
        display_name = $2,
        bio = $3,
        phone = $4,
        city = $5,
        state = $6
      WHERE id = $1
      RETURNING *
    `,
    [profileId, displayName, bio, phone, city, state],
  );

  await client.query(
    `
      UPDATE public.app_users
      SET display_name = $2
      WHERE id = $1
    `,
    [profileId, displayName],
  );

  return result.rows[0];
}

export async function updateProfileAvatar({ profileId, avatarUrl, client = db }) {
  const result = await client.query(
    `
      UPDATE public.profiles
      SET avatar_url = $2
      WHERE id = $1
      RETURNING *
    `,
    [profileId, avatarUrl],
  );

  return result.rows[0];
}
