import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, createToken, requireAuth, getAuthUserId } from "../lib/auth";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router: Router = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash: hashPassword(password), name: name ?? null })
    .returning();

  const token = createToken(user.id, user.email);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = createToken(user.id, user.email);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() });
});
router.post("/auth/google", async (req, res): Promise<void> => {
  const { credential } = req.body as { credential?: unknown };

  if (typeof credential !== "string" || !credential) {
    res.status(400).json({ error: "Google credential is required." });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ error: "Invalid Google token." });
      return;
    }

    const email = payload.email;
    const name = payload.name ?? null;

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (!user) {
      // Create new user with a random password hash (won't be used for Google users)
      const randomPassword = Math.random().toString(36).slice(-16);
      [user] = await db
        .insert(usersTable)
        .values({ email, passwordHash: hashPassword(randomPassword), name })
        .returning();
    }

    const token = createToken(user.id, user.email);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
    });
  } catch (err) {
    req.log.error({ err }, "Google token verification failed");
    res.status(401).json({ error: "Invalid Google token." });
  }
});
export default router;
