import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Config } from './config';
import { repoRoot } from './config';
import { rows, type Db } from './db/pool';
import { createGoogleVerifier, type GoogleVerifier } from './lib/google';
import { createMailer, type Mailer } from './lib/mailer';
import { createXendit, type PaymentGateway } from './lib/xendit';
import { createAuth, type Auth } from './middleware/auth';
import { createErrorHandler, errorBody, notFoundHandler } from './middleware/errors';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { emailAuthRoutes } from './routes/emailAuth';
import { paymentRoutes } from './routes/payments';
import { placementRoutes } from './routes/placement';
import { programRoutes } from './routes/program';
import { socialRoutes } from './routes/social';
import { sprintRoutes } from './routes/sprint';
import { trackRoutes } from './routes/track';
import { contentRoutes } from './routes/content';
import { templateRoutes } from './routes/templates';
import { datasetRoutes } from './routes/datasets';
import { cheatsheetRoutes } from './routes/cheatsheets';
import { applySeo, seoFor } from './lib/seo';
import { pathRoutes } from './routes/paths';
import { countNotFound } from './routes/track';
import { progressRoutes } from './routes/progress';

export interface Ctx {
  db: Db;
  config: Config;
  auth: Auth;
  mailer: Mailer;
  google: GoogleVerifier;
  payments: PaymentGateway;
}

export function createApp(
  db: Db,
  config: Config,
  mailer: Mailer = createMailer(config),
  google: GoogleVerifier = createGoogleVerifier(config.googleClientId),
  payments: PaymentGateway = createXendit(config),
): Express {
  const app = express();
  const auth = createAuth(db, config);
  const ctx: Ctx = { db, config, auth, mailer, google, payments };

  app.disable('x-powered-by');
  if (config.env === 'production') app.set('trust proxy', 1);
  // Tombol Google Sign-In memuat skrip, gaya, dan bingkai dari accounts.google.com; izinkan hanya bila fitur itu aktif.
  const gsi = 'https://accounts.google.com/gsi/';
  app.use(
    helmet(
      google.clientId
        ? {
            crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
            contentSecurityPolicy: {
              directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                'script-src': ["'self'", `${gsi}client`],
                'style-src': ["'self'", 'https:', "'unsafe-inline'"],
                'frame-src': ["'self'", gsi],
                'connect-src': ["'self'", gsi],
              },
            },
          }
        : undefined,
    ),
  );
  app.use(cors({ origin: config.webOrigins, credentials: true }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // Sprint punya pembatas sendiri (satu ronde bisa puluhan permintaan); jangan dihitung dua kali di pembatas umum.
      skip: (req) => !config.rateLimitEnabled || req.originalUrl.startsWith('/api/sprint/'),
      handler: (_req, res) => {
        res.status(429).json(errorBody('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.'));
      },
    }),
  );
  app.use('/api', auth.optionalAuth);

  app.get('/api/health', async (_req, res) => {
    try {
      await rows(db, 'SELECT 1 AS ok');
      res.json({ data: { status: 'ok', database: 'up', time: new Date().toISOString() } });
    } catch {
      res.status(503).json(errorBody('SERVICE_UNAVAILABLE', 'Database tidak dapat dihubungi.'));
    }
  });

  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/auth', emailAuthRoutes(ctx));
  app.use('/api', trackRoutes(ctx));
  app.use('/api', placementRoutes(ctx));
  app.use('/api', sprintRoutes(ctx));
  app.use('/api/progress', progressRoutes(ctx));
  app.use('/api', socialRoutes(ctx));
  app.use('/api', paymentRoutes(ctx));
  app.use('/api', programRoutes(ctx));
  app.use('/api/admin', adminRoutes(ctx));
  app.use('/api', templateRoutes(ctx));
  app.use('/api', datasetRoutes(ctx));
  app.use('/api', pathRoutes(ctx));
  app.use('/api', cheatsheetRoutes(ctx));
  app.use('/api', contentRoutes(ctx));
  app.use('/api', notFoundHandler);

  // Opsional: melayani hasil build web dari server yang sama (SERVE_WEB=true).
  const webDist = path.join(repoRoot, 'apps/web/dist');
  if (process.env.SERVE_WEB === 'true' && fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false }));
    // index.html diberi judul, canonical, noindex, dan status 404 sesuai alamatnya (lihat lib/seo.ts).
    const indexHtml = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
    const origin = config.webOrigins[0] ?? 'https://mahirexcel.online';
    app.get(/^(?!\/api\/).*/, (req, res) => {
      const seo = seoFor(req.path);
      if (seo.status === 404) countNotFound(db, req.path).catch(() => undefined);
      res.status(seo.status).type('html').send(applySeo(indexHtml, seo, origin));
    });
  }

  app.use(createErrorHandler(config.env !== 'test'));
  return app;
}
