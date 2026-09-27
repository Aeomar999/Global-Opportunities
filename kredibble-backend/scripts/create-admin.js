/**
 * Provision an admin account server-side.
 *
 * Admin accounts are deliberately NOT creatable over the public API: POST
 * /api/auth/register accepts only the 'seeker' and 'hirer' roles. This script is
 * the only supported way to mint an admin, and it requires direct database access
 * plus shell access to the host.
 *
 * Usage:
 *   npm run user:create-admin -- --email admin@kredibble.com --name "Nana Adjei"
 *
 * The password is read from the ADMIN_INITIAL_PASSWORD environment variable so it
 * never appears in shell history or process listings. If unset, a strong random
 * password is generated and printed once.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectToDatabase } from '../src/lib/mongodb.js';
import { User } from '../src/models/User.js';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
};

const generatePassword = () => {
  // Ambiguous characters removed so the value can be transcribed by hand.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*-_=+';
  return Array.from(crypto.randomBytes(24))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
};

const assertStrongPassword = (password) => {
  if (password.length < 12) throw new Error('Password must be at least 12 characters.');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must contain a lowercase letter, an uppercase letter, and a digit.');
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
  const name = typeof args.name === 'string' ? args.name.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('--email is required and must be a valid address.');
  }
  if (name.length < 2) {
    throw new Error('--name is required (at least 2 characters).');
  }

  const generated = !process.env.ADMIN_INITIAL_PASSWORD;
  const password = process.env.ADMIN_INITIAL_PASSWORD || generatePassword();
  assertStrongPassword(password);

  await connectToDatabase();

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`Admin already exists for ${email}. No changes made.`);
    } else {
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted existing user ${email} to admin.`);
    }
    if (generated) console.log('No password was changed (existing account).');
    process.exit(0);
  }

  await User.create({
    name,
    email,
    role: 'admin',
    passwordHash: await bcrypt.hash(password, 12),
  });

  console.log(`Created admin account for ${email}.`);
  if (generated) {
    console.log('Generated password (shown once - store it now):');
    console.log(password);
  }

  if (env.isDevelopment) {
    console.log('\nNote: ADMIN_JWT_SECRET must be set to sign admin sessions.');
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`Failed to create admin: ${error.message}`);
    process.exit(1);
  });
