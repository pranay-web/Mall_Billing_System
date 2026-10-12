import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { config as defaultConfig } from './config/env.js';
import { openDatabase, seedDatabase } from './db/database.js';
import { apiNotFound, authenticate, errorHandler, requestLogger } from './middleware/http.js';
import { createApiRouter } from './routes/index.js';
import { createAuthService } from './services/auth.js';
import { createCashDeskService } from './services/cashDesk.js';
import { createCheckoutService } from './services/checkout.js';
import { createGateway } from './services/gateway.js';
import { createSessionService } from './services/sessions.js';
import { createSqliteStore } from './store/sqliteStore.js';

const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

/**
 * Composes the Express app. Dependencies are injectable so tests can run
 * against an in-memory database and a deterministic gateway.
 */
export const createApp = async ({ config = defaultConfig, gateway = createGateway(config), logRequests = true } = {}) => {
  const db = openDatabase(config.databasePath);
  await seedDatabase(db, { seedCashier: config.seedCashier });
  const store = createSqliteStore({ db });

  const auth = createAuthService({ store, config });
  const sessions = createSessionService({ store, config });
  const checkout = createCheckoutService({ store, config, sessions, gateway });
  const cashDesk = createCashDeskService({ store, checkout });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.set('json spaces', config.env === 'production' ? 0 : 2);

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '32kb' }));
  if (logRequests) app.use(requestLogger);
  app.use('/api', authenticate({ secret: config.authSecret, resolve: auth.resolve }));

  app.use('/api', createApiRouter({ config, store, auth, sessions, checkout, cashDesk }));
  app.use('/api', apiNotFound);

  // Serve the production frontend build (single-port deploys) when it exists.
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  }

  app.use(errorHandler);

  return { app, store };
};
