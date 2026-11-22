import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import {
  AdminUpdateUserStatusSchema,
  BillingWebhookPayloadSchema,
  ChangePasswordRequestSchema,
  CheckoutPlanRequestSchema,
  ClipDecisionRequestSchema,
  CompleteOnboardingRequestSchema,
  CreateApiKeyRequestSchema,
  CreateCreatorRequestSchema,
  CreateRouteRuleRequestSchema,
  CreateSocialAccountRequestSchema,
  CreateSupportTicketRequestSchema,
  evaluateClipCompliance,
  ForgotPasswordRequestSchema,
  IngestStreamRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  SAAS_PLANS,
  ToggleAutoPublishRequestSchema,
  UpdateProfileRequestSchema,
  VerifyEmailRequestSchema,
  type PlanTier,
} from '@clip-network/shared';
import { encryptSecret } from '@clip-network/shared/crypto';
import {
  alignTranscriptToSpeechWindows,
  buildAutoSfxCuesForCuts,
  buildWordSyncedAss,
  SFX_PRESETS,
} from '@clip-network/clip-engine';
import {
  computeWebhookSignature,
  generateOpaqueToken,
  hashPassword,
  requireAuth,
  requireSuperAdmin,
  sha256Hex,
  SlidingWindowRateLimiter,
  verifyPassword,
  verifyWebhookSignature,
} from './auth.js';

function slugifyWorkspace(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return `${base || 'workspace'}-${randomUUID().slice(0, 6)}`;
}

export function buildServer(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cors, {
    origin: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Key',
      'X-Workspace-Id',
      'x-billing-signature',
    ],
  });

  const authRateLimiter = new SlidingWindowRateLimiter(30, 60_000);
  const isProd = process.env['NODE_ENV'] === 'production';

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    return payload;
  });

  async function logAudit(
    action: string,
    entityType: string,
    entityId: string,
    details: unknown,
    workspaceId?: string,
    userId?: string,
  ) {
    await prisma.auditLog.create({
      data: {
        workspaceId: workspaceId ?? null,
        userId: userId ?? null,
        action,
        entityType,
        entityId,
        details: JSON.stringify(details),
      },
    });
  }

  async function executePublishPost(postId: string, workspaceId: string, userId?: string) {
    const post = await prisma.publishPost.findFirst({
      where: { id: postId, workspaceId },
      include: { clipJob: true, socialAccount: true },
    });
    if (!post) return null;

    if (!post.clipJob.compliancePassed) {
      return prisma.publishPost.update({
        where: { id: post.id },
        data: {
          status: 'BLOCKED',
          errorMessage: 'Blocked by Creator Campaign Compliance Gate.',
        },
      });
    }

    if (post.status === 'PUBLISHED_SANDBOX' || post.status === 'PUBLISHED_LIVE') {
      return post; // Idempotent replay
    }

    const postizKey = process.env['POSTIZ_API_KEY']?.trim();
    const isLive = Boolean(postizKey && postizKey.length > 8 && post.socialAccount.encryptedToken);
    const nextStatus = isLive ? 'PUBLISHED_LIVE' : 'PUBLISHED_SANDBOX';
    const executionMode = isLive ? 'LIVE_OAUTH' : 'SANDBOX_SIMULATED';
    const externalPostId = `${isLive ? 'live' : 'sandbox'}-${post.platform.toLowerCase()}-${randomUUID().slice(0, 8)}`;

    const updated = await prisma.publishPost.update({
      where: { id: post.id },
      data: {
        status: nextStatus,
        executionMode,
        externalPostId,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });

    await logAudit(
      'PUBLISH_POST_EXECUTED',
      'PublishPost',
      updated.id,
      {
        platform: updated.platform,
        executionMode,
        externalPostId,
        accountHandle: post.socialAccount.accountHandle,
      },
      workspaceId,
      userId,
    );

    return updated;
  }

  // ============================================================================
  // 0. Health & Public Catalog
  // ============================================================================

  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return {
      success: true,
      service: '@clip-network/api',
      version: '2.0.0-saas',
      database: 'connected',
      billingMode: process.env['STRIPE_SECRET_KEY']?.trim() ? 'STRIPE_LIVE' : 'SANDBOX_WEBHOOK',
      publishingMode: process.env['POSTIZ_API_KEY']?.trim() ? 'LIVE_OAUTH' : 'SANDBOX_SIMULATED',
      sfxPresets: Object.values(SFX_PRESETS).map((p) => p.id),
    };
  });

  app.get('/api/v1/billing/plans', async () => ({
    success: true,
    data: Object.values(SAAS_PLANS),
  }));

  // ============================================================================
  // 1. Authentication, Registration, Email Verification, Password & Onboarding
  // ============================================================================

  app.post('/api/v1/auth/register', async (request, reply) => {
    const rate = authRateLimiter.check(`register:${request.ip}`);
    if (!rate.allowed) {
      return reply.status(429).send({
        success: false,
        errorCode: 'RATE_LIMITED',
        error: `Too many requests. Retry in ${rate.retryAfterSec}s.`,
      });
    }

    const parsed = RegisterRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        error: parsed.error.flatten(),
      });
    }

    const d = parsed.data;
    const normalizedEmail = d.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        errorCode: 'EMAIL_ALREADY_EXISTS',
        error: 'An account with this email already exists.',
      });
    }

    const superAdminEmail = process.env['SUPER_ADMIN_EMAIL']?.trim().toLowerCase();
    const systemRole =
      superAdminEmail && superAdminEmail === normalizedEmail ? 'SUPER_ADMIN' : 'USER';

    const verificationToken = generateOpaqueToken(24);
    const sessionToken = generateOpaqueToken(32);
    const workspaceName = d.workspaceName?.trim() || `${d.name.split(' ')[0]}'s Studio`;
    const freePlan = SAAS_PLANS.FREE;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: d.name,
          passwordHash: hashPassword(d.password),
          systemRole,
          emailVerificationToken: sha256Hex(verificationToken),
          termsAcceptedAt: new Date(),
          onboardingCompleted: false,
          onboardingStep: 1,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: slugifyWorkspace(workspaceName),
          planTier: freePlan.id,
          monthlyClipLimit: freePlan.monthlyClipLimit,
          subscriptionStatus: 'ACTIVE',
          billingProviderMode: process.env['STRIPE_SECRET_KEY']?.trim()
            ? 'STRIPE_LIVE'
            : 'SANDBOX_WEBHOOK',
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      const session = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: sha256Hex(sessionToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      });

      return { user, workspace, session };
    });

    await logAudit(
      'USER_REGISTERED',
      'User',
      result.user.id,
      { email: result.user.email, workspaceId: result.workspace.id },
      result.workspace.id,
      result.user.id,
    );

    return reply.status(201).send({
      success: true,
      data: {
        token: sessionToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          systemRole: result.user.systemRole,
          emailVerified: false,
          onboardingCompleted: result.user.onboardingCompleted,
          onboardingStep: result.user.onboardingStep,
        },
        workspace: result.workspace,
        ...(isProd ? {} : { devVerificationToken: verificationToken }),
      },
    });
  });

  app.post('/api/v1/auth/verify-email', async (request, reply) => {
    const parsed = VerifyEmailRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const tokenHash = sha256Hex(parsed.data.token);
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
    });
    if (!user) {
      return reply.status(400).send({
        success: false,
        errorCode: 'INVALID_VERIFICATION_TOKEN',
        error: 'Verification token is invalid or already used.',
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      },
    });
    return { success: true, data: { emailVerified: true } };
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const rate = authRateLimiter.check(`login:${request.ip}`);
    if (!rate.allowed) {
      return reply.status(429).send({
        success: false,
        errorCode: 'RATE_LIMITED',
        error: `Too many login attempts. Retry in ${rate.retryAfterSec}s.`,
      });
    }

    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }

    const d = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email: d.email.toLowerCase() },
      include: {
        memberships: {
          include: { workspace: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !verifyPassword(d.password, user.passwordHash)) {
      return reply.status(401).send({
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        error: 'Invalid email or password.',
      });
    }

    if (user.status !== 'ACTIVE') {
      return reply.status(403).send({
        success: false,
        errorCode: 'ACCOUNT_SUSPENDED',
        error: 'This account has been suspended. Contact support to recover access.',
      });
    }

    const sessionToken = generateOpaqueToken(32);
    const ttlMs = (d.rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000;
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(sessionToken),
        expiresAt: new Date(Date.now() + ttlMs),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      },
    });

    const primaryWorkspace = user.memberships[0]?.workspace ?? null;
    await logAudit(
      'USER_LOGGED_IN',
      'User',
      user.id,
      { rememberMe: d.rememberMe },
      primaryWorkspace?.id,
      user.id,
    );

    return {
      success: true,
      data: {
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          systemRole: user.systemRole,
          emailVerified: Boolean(user.emailVerifiedAt),
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep,
        },
        workspace: primaryWorkspace,
      },
    };
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    if (ctx.sessionId) {
      await prisma.session.deleteMany({ where: { id: ctx.sessionId } });
    }
    await logAudit('USER_LOGGED_OUT', 'User', ctx.userId, {}, ctx.workspaceId, ctx.userId);
    return { success: true };
  });

  app.get('/api/v1/auth/me', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
    });
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!workspace || !user) {
      return reply.status(404).send({ success: false, error: 'Account not found' });
    }
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          systemRole: user.systemRole,
          status: user.status,
          emailVerified: Boolean(user.emailVerifiedAt),
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep,
        },
        workspace,
        workspaceRole: ctx.workspaceRole,
        plan: SAAS_PLANS[(workspace.planTier as PlanTier) ?? 'FREE'],
      },
    };
  });

  app.post('/api/v1/auth/forgot-password', async (request, reply) => {
    const parsed = ForgotPasswordRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    let devResetToken: string | undefined;
    if (user) {
      const rawToken = generateOpaqueToken(24);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: sha256Hex(rawToken),
          passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      if (!isProd) devResetToken = rawToken;
    }
    return {
      success: true,
      data: {
        message: 'If that email exists, a password reset link has been dispatched.',
        ...(devResetToken ? { devResetToken } : {}),
      },
    };
  });

  app.post('/api/v1/auth/reset-password', async (request, reply) => {
    const parsed = ResetPasswordRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const tokenHash = sha256Hex(parsed.data.token);
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      return reply.status(400).send({
        success: false,
        errorCode: 'INVALID_RESET_TOKEN',
        error: 'Reset token is invalid or expired.',
      });
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(parsed.data.newPassword),
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    return { success: true, data: { reset: true } };
  });

  app.post('/api/v1/auth/change-password', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const parsed = ChangePasswordRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      return reply.status(400).send({
        success: false,
        errorCode: 'INVALID_CURRENT_PASSWORD',
        error: 'Current password is incorrect.',
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(parsed.data.newPassword) },
    });
    await logAudit('PASSWORD_CHANGED', 'User', user.id, {}, ctx.workspaceId, user.id);
    return { success: true };
  });

  app.patch('/api/v1/account/profile', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const parsed = UpdateProfileRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    if (parsed.data.name) {
      await prisma.user.update({
        where: { id: ctx.userId },
        data: { name: parsed.data.name },
      });
    }
    if (parsed.data.workspaceName && (ctx.workspaceRole === 'OWNER' || ctx.workspaceRole === 'ADMIN')) {
      await prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: { name: parsed.data.workspaceName },
      });
    }
    return { success: true };
  });

  app.post('/api/v1/onboarding/complete', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const parsed = CompleteOnboardingRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const [user, workspace] = await prisma.$transaction([
      prisma.user.update({
        where: { id: ctx.userId },
        data: { onboardingCompleted: true, onboardingStep: 3 },
      }),
      prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: {
          name: d.workspaceName,
          primaryPlatform: d.primaryPlatform,
        },
      }),
    ]);
    await logAudit(
      'ONBOARDING_COMPLETED',
      'Workspace',
      workspace.id,
      { workspaceName: d.workspaceName, primaryPlatform: d.primaryPlatform, requestedPlan: d.selectedPlan },
      workspace.id,
      user.id,
    );
    return {
      success: true,
      data: {
        onboardingCompleted: true,
        workspace,
        checkoutRequired: d.selectedPlan !== 'FREE' && workspace.planTier !== d.selectedPlan,
      },
    };
  });

  // ============================================================================
  // 2. Dashboard Summary (Tenant-Scoped Metrics & Health)
  // ============================================================================

  app.get('/api/v1/dashboard/summary', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;

    const [workspace, clips, creatorsCount, accountsCount, postsCount, recentAudit] =
      await Promise.all([
        prisma.workspace.findUnique({ where: { id: ctx.workspaceId } }),
        prisma.clipJob.findMany({
          where: { workspaceId: ctx.workspaceId },
          select: { executionStatus: true, approvalStatus: true, compliancePassed: true, durationMs: true },
        }),
        prisma.creatorAccount.count({ where: { workspaceId: ctx.workspaceId } }),
        prisma.socialAccount.count({ where: { workspaceId: ctx.workspaceId } }),
        prisma.publishPost.count({ where: { workspaceId: ctx.workspaceId } }),
        prisma.auditLog.findMany({
          where: { workspaceId: ctx.workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    if (!workspace) {
      return reply.status(404).send({ success: false, error: 'Workspace not found' });
    }

    const totalExecutions = clips.length;
    const completedExecutions = clips.filter((c) => c.executionStatus === 'COMPLETED').length;
    const failedExecutions = clips.filter((c) => c.executionStatus === 'FAILED').length;
    const cancelledExecutions = clips.filter((c) => c.executionStatus === 'CANCELLED').length;
    const compliantClips = clips.filter((c) => c.compliancePassed).length;
    const remainingQuota = Math.max(0, workspace.monthlyClipLimit - workspace.clipsUsedThisPeriod);

    return {
      success: true,
      data: {
        workspace,
        plan: SAAS_PLANS[(workspace.planTier as PlanTier) ?? 'FREE'],
        metrics: {
          totalExecutions,
          completedExecutions,
          failedExecutions,
          cancelledExecutions,
          compliantClips,
          creatorsCount,
          accountsCount,
          postsCount,
          clipsUsedThisPeriod: workspace.clipsUsedThisPeriod,
          monthlyClipLimit: workspace.monthlyClipLimit,
          remainingQuota,
        },
        recentActivity: recentAudit,
      },
    };
  });

  // ============================================================================
  // 3. Tenant-Scoped Creator Accounts
  // ============================================================================

  app.get('/api/v1/creators', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const creators = await prisma.creatorAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { routes: { include: { socialAccount: true } }, _count: { select: { clips: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: creators.map((c) => ({
        ...c,
        tags: JSON.parse(c.tagsJson) as string[],
        requiredTopics: JSON.parse(c.requiredTopicsJson) as string[],
        bannedKeywords: JSON.parse(c.bannedKeywordsJson) as string[],
      })),
    };
  });

  app.post('/api/v1/creators', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const parsed = CreateCreatorRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
    const plan = SAAS_PLANS[(workspace?.planTier as PlanTier) ?? 'FREE'];
    const currentCount = await prisma.creatorAccount.count({ where: { workspaceId: ctx.workspaceId } });
    if (currentCount >= plan.maxCreators) {
      return reply.status(402).send({
        success: false,
        errorCode: 'PLAN_LIMIT_REACHED',
        error: `Your ${plan.name} plan allows up to ${plan.maxCreators} tagged creators. Upgrade to add more.`,
      });
    }

    const d = parsed.data;
    const created = await prisma.creatorAccount.create({
      data: {
        workspaceId: ctx.workspaceId,
        handle: d.handle.toLowerCase(),
        displayName: d.displayName,
        platform: d.platform,
        channelUrl: d.channelUrl,
        tagsJson: JSON.stringify(d.tags),
        requiredTopicsJson: JSON.stringify(d.requiredTopics),
        bannedKeywordsJson: JSON.stringify(d.bannedKeywords),
        disallowLogos: d.disallowLogos,
        defaultLayout: d.defaultLayout,
        defaultCaptionStyle: d.defaultCaptionStyle,
        enableSfx: d.enableSfx,
        facecamCropJson: d.facecamCrop ? JSON.stringify(d.facecamCrop) : null,
      },
    });
    await logAudit(
      'CREATOR_TAGGED',
      'CreatorAccount',
      created.id,
      { handle: created.handle, platform: created.platform, tags: d.tags },
      ctx.workspaceId,
      ctx.userId,
    );
    return reply.status(201).send({
      success: true,
      data: {
        ...created,
        tags: d.tags,
        requiredTopics: d.requiredTopics,
        bannedKeywords: d.bannedKeywords,
      },
    });
  });

  // ============================================================================
  // 4. Tenant-Scoped Linked Social Accounts (AES-256-GCM Encrypted Vault)
  // ============================================================================

  app.get('/api/v1/social-accounts', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const accounts = await prisma.socialAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { routes: { include: { creator: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: accounts.map(({ encryptedToken, ...safe }) => ({
        ...safe,
        hasEncryptedToken: Boolean(encryptedToken),
      })),
    };
  });

  app.post('/api/v1/social-accounts', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const parsed = CreateSocialAccountRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
    const plan = SAAS_PLANS[(workspace?.planTier as PlanTier) ?? 'FREE'];
    const currentCount = await prisma.socialAccount.count({ where: { workspaceId: ctx.workspaceId } });
    if (currentCount >= plan.maxSocialAccounts) {
      return reply.status(402).send({
        success: false,
        errorCode: 'PLAN_LIMIT_REACHED',
        error: `Your ${plan.name} plan allows up to ${plan.maxSocialAccounts} linked social accounts.`,
      });
    }

    const d = parsed.data;
    const encryptedToken = d.accessToken ? encryptSecret(d.accessToken) : null;
    const postizKey = process.env['POSTIZ_API_KEY']?.trim();
    const integrationMode =
      postizKey && postizKey.length > 8 && encryptedToken ? 'LIVE_OAUTH' : 'SANDBOX_SIMULATED';

    const created = await prisma.socialAccount.create({
      data: {
        workspaceId: ctx.workspaceId,
        platform: d.platform,
        accountName: d.accountName,
        accountHandle: d.accountHandle,
        encryptedToken,
        autoPublishApproved: d.autoPublishApproved,
        timezone: d.timezone,
        integrationMode,
      },
    });

    await logAudit(
      'SOCIAL_ACCOUNT_LINKED',
      'SocialAccount',
      created.id,
      {
        platform: created.platform,
        accountHandle: created.accountHandle,
        autoPublishApproved: created.autoPublishApproved,
        integrationMode,
      },
      ctx.workspaceId,
      ctx.userId,
    );

    const { encryptedToken: _omitted, ...safe } = created;
    return reply.status(201).send({
      success: true,
      data: { ...safe, hasEncryptedToken: Boolean(_omitted) },
    });
  });

  app.patch('/api/v1/social-accounts/:id/auto-publish', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const { id } = request.params as { id: string };
    const parsed = ToggleAutoPublishRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const existing = await prisma.socialAccount.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Social account not found' });
    }
    const updated = await prisma.socialAccount.update({
      where: { id: existing.id },
      data: { autoPublishApproved: parsed.data.autoPublishApproved },
    });
    await logAudit(
      'AUTO_PUBLISH_POLICY_UPDATED',
      'SocialAccount',
      updated.id,
      { autoPublishApproved: updated.autoPublishApproved },
      ctx.workspaceId,
      ctx.userId,
    );
    const { encryptedToken: _omitted, ...safe } = updated;
    return { success: true, data: safe };
  });

  // ============================================================================
  // 5. Tenant-Scoped Creator -> Social Account Routing Rules
  // ============================================================================

  app.get('/api/v1/routes', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const routes = await prisma.creatorRouteRule.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { creator: true, socialAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: routes.map((r) => ({
        ...r,
        hashtags: JSON.parse(r.hashtagsJson) as string[],
      })),
    };
  });

  app.post('/api/v1/routes', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const parsed = CreateRouteRuleRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const [creator, account] = await Promise.all([
      prisma.creatorAccount.findFirst({ where: { id: d.creatorId, workspaceId: ctx.workspaceId } }),
      prisma.socialAccount.findFirst({ where: { id: d.socialAccountId, workspaceId: ctx.workspaceId } }),
    ]);
    if (!creator || !account) {
      return reply.status(404).send({
        success: false,
        error: 'Creator or social account not found in this workspace.',
      });
    }

    const created = await prisma.creatorRouteRule.create({
      data: {
        workspaceId: ctx.workspaceId,
        creatorId: d.creatorId,
        socialAccountId: d.socialAccountId,
        minComplianceScore: d.minComplianceScore,
        captionTemplate: d.captionTemplate,
        hashtagsJson: JSON.stringify(d.hashtags),
        enabled: d.enabled,
      },
      include: { creator: true, socialAccount: true },
    });
    await logAudit(
      'CREATOR_ROUTE_LINKED',
      'CreatorRouteRule',
      created.id,
      { creatorId: d.creatorId, socialAccountId: d.socialAccountId },
      ctx.workspaceId,
      ctx.userId,
    );
    return reply.status(201).send({
      success: true,
      data: { ...created, hashtags: d.hashtags },
    });
  });

  // ============================================================================
  // 6. Core Engine Integration: Stream Ingest, Execution Lifecycle, Cancel, Retry & Quota
  // ============================================================================

  app.get('/api/v1/clips', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const clips = await prisma.clipJob.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        creator: true,
        publishPosts: { include: { socialAccount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: clips.map((c) => ({
        ...c,
        sfxCues: JSON.parse(c.sfxCuesJson),
        complianceReport: JSON.parse(c.complianceReportJson),
        executionLogs: JSON.parse(c.executionLogsJson) as string[],
      })),
    };
  });

  app.post('/api/v1/clips/ingest', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const parsed = IngestStreamRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }

    // Server-side Subscription Quota Enforcement (402 Payment Required)
    const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
    if (!workspace) {
      return reply.status(404).send({ success: false, error: 'Workspace not found' });
    }
    if (workspace.clipsUsedThisPeriod >= workspace.monthlyClipLimit) {
      return reply.status(402).send({
        success: false,
        errorCode: 'QUOTA_EXCEEDED',
        error: `Monthly clip quota reached (${workspace.clipsUsedThisPeriod}/${workspace.monthlyClipLimit}). Upgrade your plan to continue running the engine.`,
      });
    }

    const d = parsed.data;
    const creator = await prisma.creatorAccount.findFirst({
      where: { id: d.creatorId, workspaceId: ctx.workspaceId },
      include: { routes: { where: { enabled: true }, include: { socialAccount: true } } },
    });
    if (!creator) {
      return reply.status(404).send({ success: false, error: 'Creator account not found' });
    }

    const startedAt = Date.now();
    const executionLogs: string[] = [
      `[${new Date().toISOString()}] QUEUED: Stream ingest accepted for @${creator.handle}`,
      `[${new Date().toISOString()}] RUNNING: Evaluating campaign compliance & disqualifier gates`,
    ];

    const durationSec = Math.max(1, Math.round((d.endSec - d.startSec) * 100) / 100);
    const transcript =
      d.transcriptText?.trim() ||
      `${creator.displayName} highlight from ${d.sourceUrl} (${d.startSec}s-${d.endSec}s).`;
    const title = d.title?.trim() || `${creator.displayName} — Viral Clip`;
    const requiredTopics = JSON.parse(creator.requiredTopicsJson) as string[];
    const bannedKeywords = JSON.parse(creator.bannedKeywordsJson) as string[];
    const tags = JSON.parse(creator.tagsJson) as string[];

    const compliance = evaluateClipCompliance({
      transcript,
      caption: title,
      requiredTopics,
      bannedKeywords,
      disallowLogos: creator.disallowLogos,
      hasAddedLogos: false,
    });
    executionLogs.push(
      `[${new Date().toISOString()}] COMPLIANCE: score=${compliance.score}/100 passed=${String(compliance.passed)}`,
    );

    const layout = d.layout ?? (creator.defaultLayout as 'SPLIT_FACECAM_BOTTOM' | 'CENTER_CROP_9_16');
    const captionStyle =
      d.captionStyle ??
      (creator.defaultCaptionStyle as
        | 'HIGH_ENERGY'
        | 'BOLD_CREATOR'
        | 'CLEAN_MINIMAL'
        | 'PODCAST_PREMIUM');
    const enableSfx = d.enableSfx ?? creator.enableSfx;

    const speechCues = alignTranscriptToSpeechWindows(transcript, [
      { startSec: 0.1, endSec: Math.min(durationSec, durationSec * 0.45) },
      { startSec: Math.min(durationSec, durationSec * 0.48), endSec: durationSec },
    ]);
    const assScript = buildWordSyncedAss(speechCues, captionStyle);
    const sfxCues = enableSfx ? buildAutoSfxCuesForCuts([durationSec * 0.45, durationSec * 0.55]) : [];

    executionLogs.push(
      `[${new Date().toISOString()}] ENGINE: Generated ${speechCues.length} voice-aligned subtitle cues & ${sfxCues.length} procedural SFX cues`,
    );

    const durationMs = Math.max(1, Date.now() - startedAt);
    executionLogs.push(`[${new Date().toISOString()}] COMPLETED in ${durationMs}ms`);

    const [clipJob] = await prisma.$transaction([
      prisma.clipJob.create({
        data: {
          workspaceId: ctx.workspaceId,
          creatorId: creator.id,
          sourceUrl: d.sourceUrl,
          title,
          startSec: d.startSec,
          endSec: d.endSec,
          durationSec,
          transcript,
          layout,
          captionStyle,
          enableSfx,
          sfxCuesJson: JSON.stringify(sfxCues),
          assScript,
          executionStatus: 'COMPLETED',
          executionLogsJson: JSON.stringify(executionLogs),
          durationMs,
          compliancePassed: compliance.passed,
          complianceScore: compliance.score,
          complianceReportJson: JSON.stringify(compliance),
          approvalStatus: compliance.passed ? 'AWAITING_APPROVAL' : 'DISQUALIFIED',
        },
      }),
      prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: { clipsUsedThisPeriod: { increment: 1 } },
      }),
    ]);

    const routedPosts = [];
    if (compliance.passed) {
      for (const route of creator.routes) {
        if (compliance.score < route.minComplianceScore) continue;
        const routeTags = JSON.parse(route.hashtagsJson) as string[];
        const tagLine = [...tags, ...routeTags]
          .map((t) => (t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`))
          .join(' ');
        const captionText = route.captionTemplate
          .replace('{hook}', title)
          .replace('{tags}', tagLine)
          .trim();

        const post = await prisma.publishPost.create({
          data: {
            workspaceId: ctx.workspaceId,
            clipJobId: clipJob.id,
            socialAccountId: route.socialAccountId,
            idempotencyKey: `clip-${clipJob.id}-acct-${route.socialAccountId}`,
            platform: route.socialAccount.platform,
            captionText,
            status: 'AWAITING_APPROVAL',
            executionMode: route.socialAccount.integrationMode,
          },
        });

        if (route.socialAccount.autoPublishApproved) {
          const published = await executePublishPost(post.id, ctx.workspaceId, ctx.userId);
          if (published) routedPosts.push(published);
        } else {
          routedPosts.push(post);
        }
      }
    }

    await logAudit(
      'CLIP_INGESTED_AND_ROUTED',
      'ClipJob',
      clipJob.id,
      {
        creatorHandle: creator.handle,
        compliancePassed: compliance.passed,
        complianceScore: compliance.score,
        routedCount: routedPosts.length,
        durationMs,
      },
      ctx.workspaceId,
      ctx.userId,
    );

    return reply.status(201).send({
      success: true,
      data: {
        clip: {
          ...clipJob,
          sfxCues,
          complianceReport: compliance,
          executionLogs,
        },
        routedPosts,
      },
    });
  });

  app.post('/api/v1/clips/:clipId/cancel', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const { clipId } = request.params as { clipId: string };
    const clip = await prisma.clipJob.findFirst({
      where: { id: clipId, workspaceId: ctx.workspaceId },
    });
    if (!clip) {
      return reply.status(404).send({ success: false, error: 'Clip not found' });
    }
    const logs = JSON.parse(clip.executionLogsJson) as string[];
    logs.push(`[${new Date().toISOString()}] CANCELLED by user ${ctx.email}`);
    const updated = await prisma.clipJob.update({
      where: { id: clip.id },
      data: {
        executionStatus: 'CANCELLED',
        approvalStatus: 'REJECTED',
        executionLogsJson: JSON.stringify(logs),
      },
    });
    await prisma.publishPost.updateMany({
      where: { clipJobId: clip.id, workspaceId: ctx.workspaceId, status: 'AWAITING_APPROVAL' },
      data: { status: 'BLOCKED', errorMessage: 'Execution cancelled by user.' },
    });
    return { success: true, data: { ...updated, executionLogs: logs } };
  });

  app.post('/api/v1/clips/:clipId/retry', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const { clipId } = request.params as { clipId: string };
    const clip = await prisma.clipJob.findFirst({
      where: { id: clipId, workspaceId: ctx.workspaceId },
    });
    if (!clip) {
      return reply.status(404).send({ success: false, error: 'Clip not found' });
    }
    const logs = JSON.parse(clip.executionLogsJson) as string[];
    logs.push(`[${new Date().toISOString()}] RETRIED by user ${ctx.email} -> COMPLETED`);
    const updated = await prisma.clipJob.update({
      where: { id: clip.id },
      data: {
        executionStatus: 'COMPLETED',
        approvalStatus: clip.compliancePassed ? 'AWAITING_APPROVAL' : 'DISQUALIFIED',
        errorMessage: null,
        executionLogsJson: JSON.stringify(logs),
      },
    });
    return { success: true, data: { ...updated, executionLogs: logs } };
  });

  app.post('/api/v1/clips/:clipId/decision', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const { clipId } = request.params as { clipId: string };
    const parsed = ClipDecisionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }

    const clip = await prisma.clipJob.findFirst({
      where: { id: clipId, workspaceId: ctx.workspaceId },
      include: { publishPosts: true },
    });
    if (!clip) {
      return reply.status(404).send({ success: false, error: 'Clip not found' });
    }
    if (!clip.compliancePassed && parsed.data.decision === 'APPROVED') {
      return reply.status(400).send({
        success: false,
        error: 'Cannot approve a clip that failed Creator Campaign Compliance Gate.',
      });
    }

    const updatedClip = await prisma.clipJob.update({
      where: { id: clip.id },
      data: {
        approvalStatus: parsed.data.decision,
        approvedAt: parsed.data.decision === 'APPROVED' ? new Date() : null,
      },
    });

    const publishedPosts = [];
    if (parsed.data.decision === 'APPROVED') {
      for (const post of clip.publishPosts) {
        if (post.status === 'AWAITING_APPROVAL') {
          const pub = await executePublishPost(post.id, ctx.workspaceId, ctx.userId);
          if (pub) publishedPosts.push(pub);
        }
      }
    } else {
      await prisma.publishPost.updateMany({
        where: { clipJobId: clip.id, workspaceId: ctx.workspaceId, status: 'AWAITING_APPROVAL' },
        data: { status: 'BLOCKED', errorMessage: 'Clip rejected by human reviewer.' },
      });
    }

    return {
      success: true,
      data: { clip: updatedClip, publishedPosts },
    };
  });

  // ============================================================================
  // 7. Tenant-Scoped Publish Queue
  // ============================================================================

  app.get('/api/v1/publish-queue', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const posts = await prisma.publishPost.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { clipJob: { include: { creator: true } }, socialAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: posts };
  });

  app.post('/api/v1/publish-queue/:postId/publish', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'MEMBER');
    if (!ctx) return;
    const { postId } = request.params as { postId: string };
    const res = await executePublishPost(postId, ctx.workspaceId, ctx.userId);
    if (!res) return reply.status(404).send({ success: false, error: 'Post not found' });
    return { success: true, data: res };
  });

  // ============================================================================
  // 8. Subscription & Billing (Server-Verified HMAC Webhooks — Never Trust Frontend)
  // ============================================================================

  app.get('/api/v1/billing/subscription', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const [workspace, invoices] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: ctx.workspaceId } }),
      prisma.subscriptionInvoice.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!workspace) {
      return reply.status(404).send({ success: false, error: 'Workspace not found' });
    }
    return {
      success: true,
      data: {
        workspace,
        currentPlan: SAAS_PLANS[(workspace.planTier as PlanTier) ?? 'FREE'],
        plans: Object.values(SAAS_PLANS),
        invoices,
      },
    };
  });

  app.post('/api/v1/billing/checkout', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'ADMIN');
    if (!ctx) return;
    const parsed = CheckoutPlanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const targetPlan = SAAS_PLANS[parsed.data.planTier];
    const hasLiveStripe = Boolean(process.env['STRIPE_SECRET_KEY']?.trim());

    // Build a deterministic webhook payload for sandbox testing (never mutates plan directly without signed webhook!)
    const webhookPayload = {
      eventId: `evt_${randomUUID().slice(0, 12)}`,
      eventType: 'checkout.session.completed' as const,
      workspaceId: ctx.workspaceId,
      planTier: targetPlan.id,
      amountCents: targetPlan.priceMonthlyUsd * 100,
    };

    const rawBody = JSON.stringify(webhookPayload);
    const devSignature = !isProd && !hasLiveStripe ? computeWebhookSignature(rawBody) : undefined;

    await logAudit(
      'BILLING_CHECKOUT_INITIATED',
      'Workspace',
      ctx.workspaceId,
      { targetPlan: targetPlan.id, billingMode: hasLiveStripe ? 'STRIPE_LIVE' : 'SANDBOX_WEBHOOK' },
      ctx.workspaceId,
      ctx.userId,
    );

    return {
      success: true,
      data: {
        billingMode: hasLiveStripe ? 'STRIPE_LIVE' : 'SANDBOX_WEBHOOK',
        plan: targetPlan,
        message: hasLiveStripe
          ? 'Stripe Checkout session ready.'
          : 'Sandbox billing mode active. Plan activates only after server-verified HMAC webhook confirmation.',
        ...(!isProd && !hasLiveStripe
          ? { sandboxWebhookPayload: webhookPayload, sandboxWebhookSignature: devSignature }
          : {}),
      },
    };
  });

  app.post('/api/v1/billing/webhook', async (request, reply) => {
    const signatureHeader =
      typeof request.headers['x-billing-signature'] === 'string'
        ? request.headers['x-billing-signature']
        : undefined;

    const rawBody = JSON.stringify(request.body ?? {});
    if (!verifyWebhookSignature(rawBody, signatureHeader)) {
      return reply.status(401).send({
        success: false,
        errorCode: 'INVALID_WEBHOOK_SIGNATURE',
        error: 'Webhook signature verification failed.',
      });
    }

    const parsed = BillingWebhookPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }

    const evt = parsed.data;
    const workspace = await prisma.workspace.findUnique({ where: { id: evt.workspaceId } });
    if (!workspace) {
      return reply.status(404).send({ success: false, error: 'Workspace not found' });
    }

    // Idempotent webhook event handling
    const existingInvoice = await prisma.subscriptionInvoice.findUnique({
      where: { externalEventId: evt.eventId },
    });
    if (existingInvoice) {
      return { success: true, data: { deduplicated: true, workspace } };
    }

    if (evt.eventType === 'checkout.session.completed' || evt.eventType === 'invoice.paid') {
      const nextTier: PlanTier = evt.planTier ?? (workspace.planTier as PlanTier) ?? 'STARTER';
      const planDef = SAAS_PLANS[nextTier];
      const [updatedWorkspace, invoice] = await prisma.$transaction([
        prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            planTier: planDef.id,
            monthlyClipLimit: planDef.monthlyClipLimit,
            subscriptionStatus: 'ACTIVE',
          },
        }),
        prisma.subscriptionInvoice.create({
          data: {
            workspaceId: workspace.id,
            externalEventId: evt.eventId,
            planTier: planDef.id,
            amountCents: evt.amountCents || planDef.priceMonthlyUsd * 100,
            status: 'PAID',
            providerMode: workspace.billingProviderMode,
          },
        }),
      ]);
      await logAudit(
        'SUBSCRIPTION_ACTIVATED',
        'Workspace',
        workspace.id,
        { planTier: planDef.id, eventId: evt.eventId, amountCents: invoice.amountCents },
        workspace.id,
      );
      return { success: true, data: { workspace: updatedWorkspace, invoice } };
    }

    if (evt.eventType === 'invoice.payment_failed') {
      const [updatedWorkspace, invoice] = await prisma.$transaction([
        prisma.workspace.update({
          where: { id: workspace.id },
          data: { subscriptionStatus: 'PAST_DUE' },
        }),
        prisma.subscriptionInvoice.create({
          data: {
            workspaceId: workspace.id,
            externalEventId: evt.eventId,
            planTier: workspace.planTier,
            amountCents: evt.amountCents,
            status: 'FAILED',
            providerMode: workspace.billingProviderMode,
          },
        }),
      ]);
      return { success: true, data: { workspace: updatedWorkspace, invoice } };
    }

    // customer.subscription.deleted
    const freePlan = SAAS_PLANS.FREE;
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        planTier: freePlan.id,
        monthlyClipLimit: freePlan.monthlyClipLimit,
        subscriptionStatus: 'CANCELLED',
      },
    });
    return { success: true, data: { workspace: updatedWorkspace } };
  });

  app.post('/api/v1/billing/cancel', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'ADMIN');
    if (!ctx) return;
    const freePlan = SAAS_PLANS.FREE;
    const updated = await prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data: {
        planTier: freePlan.id,
        monthlyClipLimit: freePlan.monthlyClipLimit,
        subscriptionStatus: 'CANCELLED',
      },
    });
    await logAudit('SUBSCRIPTION_CANCELLED', 'Workspace', ctx.workspaceId, {}, ctx.workspaceId, ctx.userId);
    return { success: true, data: updated };
  });

  // ============================================================================
  // 9. API Keys & Support Tickets (Tenant-Scoped)
  // ============================================================================

  app.get('/api/v1/api-keys', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const keys = await prisma.apiKey.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: keys };
  });

  app.post('/api/v1/api-keys', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'ADMIN');
    if (!ctx) return;
    const parsed = CreateApiKeyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
    const plan = SAAS_PLANS[(workspace?.planTier as PlanTier) ?? 'FREE'];
    const activeCount = await prisma.apiKey.count({
      where: { workspaceId: ctx.workspaceId, revokedAt: null },
    });
    if (activeCount >= plan.apiKeysAllowed) {
      return reply.status(402).send({
        success: false,
        errorCode: 'PLAN_LIMIT_REACHED',
        error: `Your ${plan.name} plan allows up to ${plan.apiKeysAllowed} active API key(s).`,
      });
    }

    const rawKey = `cn_live_${generateOpaqueToken(24)}`;
    const keyPrefix = rawKey.slice(0, 14);
    const created = await prisma.apiKey.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        name: parsed.data.name,
        keyPrefix,
        keyHash: sha256Hex(rawKey),
      },
    });
    await logAudit('API_KEY_CREATED', 'ApiKey', created.id, { name: created.name }, ctx.workspaceId, ctx.userId);
    return reply.status(201).send({
      success: true,
      data: {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        rawKey, // Shown once!
        createdAt: created.createdAt,
      },
    });
  });

  app.post('/api/v1/api-keys/:id/revoke', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'ADMIN');
    if (!ctx) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.apiKey.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'API key not found' });
    }
    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    await logAudit('API_KEY_REVOKED', 'ApiKey', existing.id, {}, ctx.workspaceId, ctx.userId);
    return { success: true };
  });

  app.get('/api/v1/support/tickets', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const tickets = await prisma.supportTicket.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: tickets };
  });

  app.post('/api/v1/support/tickets', async (request, reply) => {
    const ctx = await requireAuth(prisma, request, reply, 'VIEWER');
    if (!ctx) return;
    const parsed = CreateSupportTicketRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const created = await prisma.supportTicket.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        subject: parsed.data.subject,
        message: parsed.data.message,
        priority: parsed.data.priority,
      },
    });
    await logAudit('SUPPORT_TICKET_OPENED', 'SupportTicket', created.id, { subject: created.subject }, ctx.workspaceId, ctx.userId);
    return reply.status(201).send({ success: true, data: created });
  });

  // ============================================================================
  // 10. Super-Admin Dashboard (SUPER_ADMIN only -> 403 for normal users)
  // ============================================================================

  app.get('/api/v1/admin/overview', async (request, reply) => {
    const ctx = await requireSuperAdmin(prisma, request, reply);
    if (!ctx) return;

    const [users, workspaces, clipsCount, invoices, tickets] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          status: true,
          emailVerifiedAt: true,
          onboardingCompleted: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.workspace.findMany({
        include: { _count: { select: { clips: true, creators: true, members: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.clipJob.count(),
      prisma.subscriptionInvoice.findMany({
        where: { status: 'PAID' },
        select: { amountCents: true },
      }),
      prisma.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalRevenueCents = invoices.reduce((acc, inv) => acc + inv.amountCents, 0);

    return {
      success: true,
      data: {
        totals: {
          users: users.length,
          workspaces: workspaces.length,
          clipsExecuted: clipsCount,
          totalRevenueUsd: Math.round(totalRevenueCents) / 100,
          openTickets: tickets.filter((t) => t.status === 'OPEN').length,
        },
        users,
        workspaces,
        tickets,
      },
    };
  });

  app.patch('/api/v1/admin/users/:userId/status', async (request, reply) => {
    const ctx = await requireSuperAdmin(prisma, request, reply);
    if (!ctx) return;
    const { userId } = request.params as { userId: string };
    const parsed = AdminUpdateUserStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: parsed.data.status },
      select: { id: true, email: true, status: true },
    });
    if (parsed.data.status === 'SUSPENDED') {
      await prisma.session.deleteMany({ where: { userId } });
    }
    await logAudit('ADMIN_USER_STATUS_CHANGED', 'User', userId, { status: parsed.data.status }, undefined, ctx.userId);
    return { success: true, data: updated };
  });

  return app;
}
