import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { signToken } from '../src/middleware/auth.js';

describe('POST /users/me/push-token', () => {
  let seekerUser;
  let seekerToken;
  let hirerUser;
  let hirerToken;

  beforeEach(async () => {
    await User.deleteMany({});

    seekerUser = await User.create({
      name: 'Seeker Push Tester',
      email: 'seeker.push@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    seekerToken = signToken(seekerUser);

    hirerUser = await User.create({
      name: 'Hirer Push Tester',
      email: 'hirer.push@example.com',
      role: 'hirer',
      passwordHash: 'dummy-password-hash',
    });
    hirerToken = signToken(hirerUser);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .send({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('rejects requests with missing token with 400', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ platform: 'ios' });

    expect(res.status).toBe(400);
  });

  it('rejects requests with empty token string with 400', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ token: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects requests with invalid platform with 400', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        token: 'ExponentPushToken[valid-sample-push-token]',
        platform: 'playstation',
      });

    expect(res.status).toBe(400);
  });

  it('successfully registers push token and platform for seeker', async () => {
    const pushToken = 'ExponentPushToken[seeker-sample-push-token]';
    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        token: pushToken,
        platform: 'ios',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true });

    const updated = await User.findById(seekerUser._id);
    expect(updated.pushToken).toBe(pushToken);
    expect(updated.pushPlatform).toBe('ios');
    expect(updated.pushTokenUpdatedAt).toBeInstanceOf(Date);
  });

  it('successfully registers push token and platform for hirer on Android', async () => {
    const pushToken = 'ExponentPushToken[hirer-sample-push-token]';
    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${hirerToken}`)
      .send({
        token: pushToken,
        platform: 'android',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true });

    const updated = await User.findById(hirerUser._id);
    expect(updated.pushToken).toBe(pushToken);
    expect(updated.pushPlatform).toBe('android');
    expect(updated.pushTokenUpdatedAt).toBeInstanceOf(Date);
  });

  it('successfully updates push token when called again (token rotation)', async () => {
    const initialToken = 'ExponentPushToken[initial-token]';
    const rotatedToken = 'ExponentPushToken[rotated-token]';

    await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ token: initialToken, platform: 'ios' });

    let user = await User.findById(seekerUser._id);
    expect(user.pushToken).toBe(initialToken);
    const initialDate = user.pushTokenUpdatedAt;

    const res = await request(app)
      .post('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ token: rotatedToken, platform: 'ios' });

    expect(res.status).toBe(200);

    user = await User.findById(seekerUser._id);
    expect(user.pushToken).toBe(rotatedToken);
    expect(user.pushTokenUpdatedAt.getTime()).toBeGreaterThanOrEqual(initialDate.getTime());
  });

  it('works via legacy /api/users/me/push-token route as well', async () => {
    const pushToken = 'ExponentPushToken[legacy-path-test]';
    const res = await request(app)
      .post('/api/users/me/push-token')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        token: pushToken,
        platform: 'ios',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true });
  });
});
