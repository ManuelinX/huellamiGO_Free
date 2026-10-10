import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { createAuthToken, requireAuth } from "../utils/auth.js";
import { hashPassword, verifyPassword } from "../utils/passwords.js";
import { asyncHandler, createBadRequest } from "../utils/http.js";
import { rateLimit } from "../utils/rate-limit.js";
import { sendTransactionalEmail } from "../services/email.js";
import { isBetaShieldAdminEmail } from "../services/beta-admins.js";
import {
  requireBetaAccessForEmail,
  requireBetaAccessForUser,
  requireSignedBetaAccess,
} from "../middleware/beta-shield.js";

export const authRouter = Router();

const passwordResetTtlMinutes = 60;
const emailVerificationTtlMinutes = 60 * 24;
const authDebugLinksEnabled = process.env.AUTH_DEBUG_LINKS_ENABLED === "true";
const authRateLimits = {
  register: rateLimit({
    name: "auth:register",
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Demasiados registros desde esta conexión. Intenta de nuevo más tarde.",
  }),
  login: rateLimit({
    name: "auth:login",
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Demasiados intentos de acceso. Intenta de nuevo más tarde.",
  }),
  passwordResetRequest: rateLimit({
    name: "auth:password-reset:request",
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: "Demasiadas solicitudes de recuperación. Intenta de nuevo más tarde.",
  }),
  passwordResetConfirm: rateLimit({
    name: "auth:password-reset:confirm",
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Demasiados intentos de recuperación. Intenta de nuevo más tarde.",
  }),
  passwordChange: rateLimit({
    name: "auth:password:change",
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Demasiados intentos de cambio de contraseña. Intenta de nuevo más tarde.",
  }),
  emailVerificationRequest: rateLimit({
    name: "auth:email-verification:request",
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: "Demasiadas solicitudes de verificación. Intenta de nuevo más tarde.",
  }),
  emailVerificationConfirm: rateLimit({
    name: "auth:email-verification:confirm",
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: "Demasiados intentos de verificación. Intenta de nuevo más tarde.",
  }),
};

function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase();
}

function debugLink(value) {
  return authDebugLinksEnabled ? value : undefined;
}

function normalizeDisplayName(displayName, email) {
  const fallbackName = email.split("@")[0];
  return displayName?.toString().trim() || fallbackName;
}

function createUsername(email, userId) {
  const localPart = email.split("@")[0] || "usuario";
  const cleanName = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "usuario";

  return `${cleanName}_${userId.slice(0, 8)}`;
}

function mapAuthUser(user, profile = null) {
  return {
    id: user.id,
    email: user.email,
    displayName: profile?.display_name ?? user.display_name,
    username: profile?.username ?? null,
    emailVerified: Boolean(user.email_verified_at),
    emailVerifiedAt: user.email_verified_at ?? null,
    role: "authenticated",
    isBetaInviteAdmin: isBetaShieldAdminEmail(user.email),
  };
}

function assertCredentials(email, password) {
  if (!email || !password) {
    throw createBadRequest("Email y contraseña son obligatorios");
  }

  assertPassword(password);
}

function assertPassword(password) {
  if (password.length < 6) {
    throw createBadRequest("La contraseña debe tener al menos 6 caracteres");
  }
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createActionUrl(paramName, token) {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3000";
  const url = new URL(frontendUrl);

  url.searchParams.set(paramName, token);

  return url.toString();
}

function createResetUrl(token) {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3000";
  const url = new URL("/reset-password", frontendUrl);

  url.searchParams.set("token", token);

  return url.toString();
}

function createEmailVerificationUrl(token) {
  return createActionUrl("verifyEmailToken", token);
}

async function ensurePasswordResetTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.app_users(id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz,
      requested_ip text,
      user_agent text
    );

    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_idx
    ON public.password_reset_tokens(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS password_reset_tokens_active_hash_idx
    ON public.password_reset_tokens(token_hash)
    WHERE used_at IS NULL;
  `);
}

async function ensureEmailVerificationColumns() {
  await db.query(`
    ALTER TABLE public.app_users
      ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
      ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz;

    CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.app_users(id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz,
      requested_ip text,
      user_agent text
    );

    CREATE INDEX IF NOT EXISTS email_verification_tokens_user_created_idx
    ON public.email_verification_tokens(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS email_verification_tokens_active_hash_idx
    ON public.email_verification_tokens(token_hash)
    WHERE used_at IS NULL;
  `);
}

async function createAndSendEmailVerification({ userId, email, req, client = db }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const verificationUrl = createEmailVerificationUrl(token);

  await client.query(
    `
      UPDATE public.email_verification_tokens
      SET used_at = now()
      WHERE user_id = $1
        AND used_at IS NULL
    `,
    [userId],
  );

  await client.query(
    `
      INSERT INTO public.email_verification_tokens (
        user_id,
        token_hash,
        expires_at,
        requested_ip,
        user_agent
      )
      VALUES ($1, $2, now() + ($3::text || ' minutes')::interval, $4, $5)
    `,
    [
      userId,
      hashResetToken(token),
      emailVerificationTtlMinutes,
      req.ip || null,
      String(req.headers["user-agent"] ?? "").slice(0, 255) || null,
    ],
  );

  await client.query(
    `
      UPDATE public.app_users
      SET email_verification_sent_at = now()
      WHERE id = $1
    `,
    [userId],
  );

  await sendTransactionalEmail({
    to: email,
    subject: "Verifica tu correo de HuellamiGO",
    text: [
      "Gracias por crear tu cuenta en HuellamiGO.",
      "",
      `Verifica tu correo durante las próximas 24 horas: ${verificationUrl}`,
      "",
      "Si no creaste esta cuenta, puedes ignorar este mensaje.",
    ].join("\n"),
  });

  return verificationUrl;
}

function createUnauthorizedError() {
  const error = createBadRequest("Email o contraseña incorrectos");
  error.statusCode = 401;
  return error;
}

authRouter.post("/register", authRateLimits.register, asyncHandler(async (req, res) => {
  await ensureEmailVerificationColumns();

  const email = normalizeEmail(req.body.email);
  const password = req.body.password?.toString();

  requireBetaAccessForEmail(req, email);
  assertCredentials(email, password);

  const displayName = normalizeDisplayName(req.body.displayName, email);
  const passwordHash = await hashPassword(password);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
        INSERT INTO public.app_users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, display_name, email_verified_at
      `,
      [email, passwordHash, displayName],
    );
    const user = userResult.rows[0];

    const profileResult = await client.query(
      `
        INSERT INTO public.profiles (id, display_name, username)
        VALUES ($1, $2, $3)
        RETURNING id, display_name, username
      `,
      [user.id, displayName, createUsername(email, user.id)],
    );

    const verificationUrl = await createAndSendEmailVerification({
      userId: user.id,
      email: user.email,
      req,
      client,
    });

    await client.query("COMMIT");

    const authUser = mapAuthUser(user, profileResult.rows[0]);

    res.status(201).json({
      ok: true,
      user: authUser,
      token: createAuthToken(authUser),
      verificationUrl: debugLink(verificationUrl),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const conflict = createBadRequest("Ya existe una cuenta con ese email");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  } finally {
    client.release();
  }
}));

authRouter.post("/login", authRateLimits.login, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password?.toString();

  requireBetaAccessForEmail(req, email);
  assertCredentials(email, password);

  const result = await db.query(
    `
      SELECT
        u.id,
        u.email,
        u.password_hash,
        u.display_name,
        u.email_verified_at,
        p.display_name AS profile_display_name,
        p.username
      FROM public.app_users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.email = $1
        AND u.status = 'active'
      LIMIT 1
    `,
    [email],
  );
  const user = result.rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw createUnauthorizedError();
  }

  const authUser = mapAuthUser(user, {
    display_name: user.profile_display_name,
    username: user.username,
  });

  res.json({
    ok: true,
    user: authUser,
    token: createAuthToken(authUser),
  });
}));

authRouter.post("/password-reset/request", authRateLimits.passwordResetRequest, asyncHandler(async (req, res) => {
  await ensurePasswordResetTable();

  const email = normalizeEmail(req.body.email);

  requireBetaAccessForEmail(req, email);

  if (!email) {
    throw createBadRequest("Email es obligatorio");
  }

  const result = await db.query(
    `
      SELECT id, email
      FROM public.app_users
      WHERE email = $1
        AND status = 'active'
      LIMIT 1
    `,
    [email],
  );
  const user = result.rows[0];
  let resetUrl = null;

  if (user) {
    const token = crypto.randomBytes(32).toString("base64url");
    resetUrl = createResetUrl(token);

    await db.query(
      `
        UPDATE public.password_reset_tokens
        SET used_at = now()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [user.id],
    );

    await db.query(
      `
        INSERT INTO public.password_reset_tokens (
          user_id,
          token_hash,
          expires_at,
          requested_ip,
          user_agent
        )
        VALUES ($1, $2, now() + ($3::text || ' minutes')::interval, $4, $5)
      `,
      [
        user.id,
        hashResetToken(token),
        passwordResetTtlMinutes,
        req.ip || null,
        String(req.headers["user-agent"] ?? "").slice(0, 255) || null,
      ],
    );

    await sendTransactionalEmail({
      to: user.email,
      subject: "Restablece tu contraseña de HuellamiGO",
      text: [
        "Recibimos una solicitud para restablecer tu contraseña de HuellamiGO.",
        "",
        `Abre este enlace durante la próxima hora: ${resetUrl}`,
        "",
        "Si no solicitaste este cambio, puedes ignorar este mensaje.",
      ].join("\n"),
    });
  }

  res.json({
    ok: true,
    message: "Si existe una cuenta con ese email, enviaremos instrucciones para restablecer la contraseña.",
    resetUrl: debugLink(resetUrl),
  });
}));

authRouter.post("/email-verification/request", authRateLimits.emailVerificationRequest, asyncHandler(async (req, res) => {
  await ensureEmailVerificationColumns();

  const auth = requireAuth(req);
  requireBetaAccessForUser(req, auth);
  const result = await db.query(
    `
      SELECT id, email, email_verified_at
      FROM public.app_users
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [auth.id],
  );
  const user = result.rows[0];

  if (!user) {
    const error = createBadRequest("Sesión no encontrada");
    error.statusCode = 401;
    throw error;
  }

  if (user.email_verified_at) {
    res.json({
      ok: true,
      message: "Tu correo ya está verificado.",
    });
    return;
  }

  const verificationUrl = await createAndSendEmailVerification({
    userId: user.id,
    email: user.email,
    req,
  });

  res.json({
    ok: true,
    message: "Enviamos un enlace de verificación a tu correo.",
    verificationUrl: debugLink(verificationUrl),
  });
}));

authRouter.post("/email-verification/confirm", authRateLimits.emailVerificationConfirm, asyncHandler(async (req, res) => {
  await ensureEmailVerificationColumns();

  requireSignedBetaAccess(req);

  const token = req.body.token?.toString();

  if (!token) {
    throw createBadRequest("Token de verificación obligatorio");
  }

  const tokenHash = hashResetToken(token);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
        SELECT t.id AS verification_token_id, u.id, u.email, u.display_name, u.email_verified_at, p.display_name AS profile_display_name, p.username
        FROM public.email_verification_tokens t
        JOIN public.app_users u ON u.id = t.user_id
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE t.token_hash = $1
          AND t.used_at IS NULL
          AND t.expires_at > now()
          AND u.status = 'active'
        LIMIT 1
        FOR UPDATE OF t
      `,
      [tokenHash],
    );
    const verificationToken = tokenResult.rows[0];

    if (!verificationToken) {
      throw createBadRequest("El enlace de verificación expiró o ya fue usado");
    }

    const updatedUserResult = await client.query(
      `
        UPDATE public.app_users
        SET email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = $1
        RETURNING id, email, display_name, email_verified_at
      `,
      [verificationToken.id],
    );
    const updatedUser = updatedUserResult.rows[0];

    await client.query(
      `
        UPDATE public.email_verification_tokens
        SET used_at = now()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [verificationToken.id],
    );

    await client.query("COMMIT");

    const authUser = mapAuthUser({
      ...updatedUser,
      profile_display_name: verificationToken.profile_display_name,
      username: verificationToken.username,
    }, {
      display_name: verificationToken.profile_display_name,
      username: verificationToken.username,
    });

    res.json({
      ok: true,
      user: authUser,
      token: createAuthToken(authUser),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

authRouter.post("/password-reset/confirm", authRateLimits.passwordResetConfirm, asyncHandler(async (req, res) => {
  await ensurePasswordResetTable();

  requireSignedBetaAccess(req);

  const token = req.body.token?.toString();
  const password = req.body.password?.toString();

  if (!token || !password) {
    throw createBadRequest("Token y contraseña son obligatorios");
  }

  assertPassword(password);

  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(password);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
        SELECT t.id AS reset_token_id, u.id, u.email, u.display_name, u.email_verified_at, p.display_name AS profile_display_name, p.username
        FROM public.password_reset_tokens t
        JOIN public.app_users u ON u.id = t.user_id
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE t.token_hash = $1
          AND t.used_at IS NULL
          AND t.expires_at > now()
          AND u.status = 'active'
        LIMIT 1
        FOR UPDATE OF t
      `,
      [tokenHash],
    );
    const resetToken = tokenResult.rows[0];

    if (!resetToken) {
      throw createBadRequest("El enlace de recuperación expiró o ya fue usado");
    }

    await client.query(
      `
        UPDATE public.app_users
        SET password_hash = $1
        WHERE id = $2
      `,
      [passwordHash, resetToken.id],
    );

    await client.query(
      `
        UPDATE public.password_reset_tokens
        SET used_at = now()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [resetToken.id],
    );

    await client.query("COMMIT");

    const authUser = mapAuthUser(resetToken, {
      display_name: resetToken.profile_display_name,
      username: resetToken.username,
    });

    res.json({
      ok: true,
      user: authUser,
      token: createAuthToken(authUser),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

authRouter.post("/password/change", authRateLimits.passwordChange, asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  requireBetaAccessForUser(req, auth);
  const currentPassword = req.body.currentPassword?.toString();
  const nextPassword = req.body.nextPassword?.toString();

  if (!currentPassword || !nextPassword) {
    throw createBadRequest("Contraseña actual y nueva contraseña son obligatorias");
  }

  assertPassword(nextPassword);

  if (currentPassword === nextPassword) {
    throw createBadRequest("La nueva contraseña debe ser diferente");
  }

  const result = await db.query(
    `
      SELECT id, password_hash
      FROM public.app_users
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [auth.id],
  );
  const user = result.rows[0];

  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    const error = createBadRequest("La contraseña actual no es correcta");
    error.statusCode = 401;
    throw error;
  }

  const passwordHash = await hashPassword(nextPassword);

  await db.query(
    `
      UPDATE public.app_users
      SET password_hash = $1
      WHERE id = $2
    `,
    [passwordHash, auth.id],
  );

  res.json({
    ok: true,
    message: "Contraseña actualizada.",
  });
}));

authRouter.get("/me", asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  requireBetaAccessForUser(req, auth);
  const result = await db.query(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.email_verified_at,
        p.display_name AS profile_display_name,
        p.username
      FROM public.app_users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = $1
        AND u.status = 'active'
      LIMIT 1
    `,
    [auth.id],
  );
  const user = result.rows[0];

  if (!user) {
    const error = createBadRequest("Sesión no encontrada");
    error.statusCode = 401;
    throw error;
  }

  res.json({
    ok: true,
    user: mapAuthUser(user, {
      display_name: user.profile_display_name,
      username: user.username,
    }),
  });
}));
