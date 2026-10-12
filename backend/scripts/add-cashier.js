/**
 * Creates a cashier account (or resets the password of an existing one).
 *
 *   npm run cashier:add -- --email asha@mall.in --name "Asha Rao" --password "s3cure-pass"
 *
 * Omit --password to be prompted for it.
 */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { openDatabase } from '../src/db/database.js';
import { hashPassword, normalizeEmail } from '../src/lib/auth.js';
import { createSqliteStore } from '../src/store/sqliteStore.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
  },
});

const email = normalizeEmail(values.email);
if (!email) {
  console.error('Usage: npm run cashier:add -- --email <email> [--name "Full Name"] [--password <password>]');
  process.exit(1);
}

let password = values.password;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Password (min 8 characters): ');
  rl.close();
}
if (!password || password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const store = createSqliteStore({ db: openDatabase(config.databasePath) });
const { created } = store.saveCashier({
  email,
  name: values.name?.trim() || email.split('@')[0],
  passwordHash: await hashPassword(password),
});
store.close();

console.log(`${created ? 'Created' : 'Updated'} cashier ${email} in ${config.databasePath}`);
