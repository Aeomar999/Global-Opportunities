import request from 'supertest';
import { app } from '../src/app.js';

describe('API Endpoints', () => {
  it('GET / should return running message', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Kredibble API is running');
  });
  
  it('GET /api/nonexistent should return 404', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.statusCode).toBe(404);
  });
});
