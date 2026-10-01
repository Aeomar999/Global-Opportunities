import { env } from '../config/env.js';
import { fetchWithTimeout } from './fetch.js';

const configured = (value) => value && !value.includes('placeholder');

const syncUrl = (resource, wordpressId) => {
  const baseUrl = env.wordpressSyncBaseUrl.replace(/\/$/, '');
  return wordpressId ? `${baseUrl}/${resource}/${wordpressId}` : `${baseUrl}/${resource}`;
};

const recordPayload = (document) => {
  const value = document.toJSON ? document.toJSON() : document;
  const { _id, __v, wordpressSync, ...record } = value;
  return { id: _id?.toString(), wordpressId: wordpressSync?.wordpressId, record };
};

const saveSyncState = async (document, state) => {
  document.wordpressSync = { ...document.wordpressSync?.toObject?.(), ...state, lastAttemptAt: new Date() };
  await document.save();
};

export const syncToWordpress = async (resource, document) => {
  if (!configured(env.wordpressSyncBaseUrl) || !configured(env.wordpressApiKey)) {
    await saveSyncState(document, { status: 'pending', lastError: 'WordPress sync is not configured' });
    return { status: 'pending' };
  }

  try {
    const response = await fetchWithTimeout(syncUrl(resource, document.wordpressSync?.wordpressId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.wordpressApiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(recordPayload(document)),
    }, 'WordPress sync');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `WordPress returned ${response.status}`);
    const wordpressId = payload.wordpressId || payload.id || payload.data?.wordpressId || payload.data?.id || document.wordpressSync?.wordpressId;
    if (!wordpressId) throw new Error('WordPress sync response did not include a WordPress ID');
    await saveSyncState(document, {
      wordpressId: String(wordpressId),
      status: 'synced',
      lastError: undefined,
    });
    return { status: 'synced', wordpressId: document.wordpressSync.wordpressId, payload };
  } catch (error) {
    await saveSyncState(document, { status: 'failed', lastError: error.message });
    return { status: 'failed', error: error.message };
  }
};

export const deleteFromWordpress = async (resource, document) => {
  if (!configured(env.wordpressSyncBaseUrl) || !configured(env.wordpressApiKey) || !document.wordpressSync?.wordpressId) {
    return { status: 'pending' };
  }
  const response = await fetchWithTimeout(syncUrl(resource, document.wordpressSync.wordpressId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.wordpressApiKey}` },
  }, 'WordPress sync');
  if (!response.ok) throw new Error(`WordPress delete failed with ${response.status}`);
  return { status: 'synced' };
};
