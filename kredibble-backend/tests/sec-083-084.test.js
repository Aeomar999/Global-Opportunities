import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { User, PasswordResetCode } from '../src/models/User.js';
import { hashVerificationCode } from '../src/lib/email.js';

const PASSWORD = 'OldPassw0rd-x';
const NEW_PASSWORD = 'NewPassw0rd-y';
const KNOWN_CODE = '123456';

const createUser = async ({ email = 'reset@example.com', role = 'seeker' } = {}) =>
  User.create({ name: 'Reset User', email, role, passwordHash: await bcrypt.hash(PASSWORD, 12) });

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });
const forgot = (email) => request(app).post('/api/v1/auth/password/forgot').send({ email });
const reset = (email, code, newPassword = NEW_PASSWORD) =>
  request(app).post('/api/v1/auth/password/reset').send({ email, code, newPassword });
const me = (token) => request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
const refresh = (refreshToken) => request(app).post('/api/v1/auth/refresh').send({ refreshToken });

/** The emailed code is random; pin it to a known value so the test can submit it. */
const pinResetCode = (userId) =>
  PasswordResetCode.updateOne({ userId }, { codeHash: hashVerificationCode(KNOWN_CODE) });

describe('SEC-083: forgot / reset password', () => {
  it('answers 202 with the same body whether or not the email is registered', async () => {
    await createUser();
    const known = await forgot('Reset@Example.com');
    const unknown = await forgot('nobody@example.com');

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(await PasswordResetCode.countDocuments()).toBe(1);
  });

  it('does not issue reset codes for admin accounts', async () => {
    await createUser({ email: 'admin@example.com', role: 'admin' });
    const res = await forgot('admin@example.com');

    expect(res.status).toBe(202);
    expect(await PasswordResetCode.countDocuments()).toBe(0);
  });

  it('sets the new password and ends every existing session', async () => {
    const user = await createUser();
    const session = await login('reset@example.com', PASSWORD);
    expect(session.status).toBe(200);

    await forgot('reset@example.com');
    await pinResetCode(user._id);
    const res = await reset('reset@example.com', KNOWN_CODE);

    expect(res.status).toBe(200);
    expect(await PasswordResetCode.countDocuments()).toBe(0);
    expect((await me(session.body.data.token)).status).toBe(401);
    expect((await refresh(session.body.data.refreshToken)).status).toBe(401);
    expect((await login('reset@example.com', PASSWORD)).status).toBe(401);
    expect((await login('reset@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('gives the same error for a wrong code and for an unknown email', async () => {
    const user = await createUser();
    await forgot('reset@example.com');
    await pinResetCode(user._id);

    const wrongCode = await reset('reset@example.com', '000000');
    const unknownEmail = await reset('nobody@example.com', '000000');

    expect(wrongCode.status).toBe(400);
    expect(unknownEmail.status).toBe(400);
    expect(wrongCode.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('burns the code after five wrong guesses', async () => {
    const user = await createUser();
    await forgot('reset@example.com');
    await pinResetCode(user._id);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await reset('reset@example.com', '000000')).status).toBe(400);
    }
    const sixth = await reset('reset@example.com', KNOWN_CODE);

    expect(sixth.status).toBe(400);
    expect((await login('reset@example.com', PASSWORD)).status).toBe(200);
  });

  it('rejects a new password that fails the password policy', async () => {
    const user = await createUser();
    await forgot('reset@example.com');
    await pinResetCode(user._id);

    const res = await reset('reset@example.com', KNOWN_CODE, 'short');

    expect(res.status).toBe(400);
    expect((await login('reset@example.com', PASSWORD)).status).toBe(200);
  });
});

const changePassword = (token, body) =>
  request(app).post('/api/v1/auth/password').set('Authorization', `Bearer ${token}`).send(body);

describe('SEC-084: change password', () => {
  it('changes the password, signs out other devices and keeps this one signed in', async () => {
    await createUser({ email: 'change@example.com' });
    const thisDevice = await login('change@example.com', PASSWORD);
    const otherDevice = await login('change@example.com', PASSWORD);

    const res = await changePassword(thisDevice.body.data.token, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect((await me(otherDevice.body.data.token)).status).toBe(401);
    expect((await refresh(otherDevice.body.data.refreshToken)).status).toBe(401);
    expect((await me(res.body.data.token)).status).toBe(200);
    expect((await refresh(res.body.data.refreshToken)).status).toBe(200);
    expect((await login('change@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('rejects a wrong current password with 400 and keeps the old password', async () => {
    await createUser({ email: 'change@example.com' });
    const session = await login('change@example.com', PASSWORD);

    const res = await changePassword(session.body.data.token, { currentPassword: 'WrongPassw0rd-z', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect((await me(session.body.data.token)).status).toBe(200);
    expect((await login('change@example.com', PASSWORD)).status).toBe(200);
  });

  it('rejects reusing the current password', async () => {
    await createUser({ email: 'change@example.com' });
    const session = await login('change@example.com', PASSWORD);

    const res = await changePassword(session.body.data.token, { currentPassword: PASSWORD, newPassword: PASSWORD });

    expect(res.status).toBe(400);
  });
});
