import { config } from './config/env.js';
import { createApp } from './app.js';

const { app, store } = await createApp({ config });

const sweeper = setInterval(() => {
  const removed = store.sweep();
  if (removed) console.log(`[sweep] removed ${removed} expired session(s)`);
}, 10 * 60_000);
sweeper.unref();

const server = app.listen(config.port, () => {
  const mode = {
    mock: 'MOCK (no Razorpay keys — simulated gateway)',
    test: 'Razorpay TEST mode',
    live: 'Razorpay LIVE mode',
  }[config.razorpay.mode];

  console.log(`\n  ⚡ FlashCart API  →  http://localhost:${config.port}/api`);
  console.log(`  💳 Payments      →  ${mode}`);
  console.log(`  🗄  Database      →  ${config.databasePath}`);
  if (!process.env.AUTH_SECRET) {
    console.log('  ⚠️  AUTH_SECRET not set — everyone is signed out when the server restarts.');
  }
  console.log('');
});

const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down…`);
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
