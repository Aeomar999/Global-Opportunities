import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

export const fetchWithTimeout = async (url, options = {}, service = 'Upstream service') => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.outboundRequestTimeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError(504, `${service} timed out`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};