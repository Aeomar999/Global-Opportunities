import { Router } from 'express';
import { env } from '../config/env.js';
import { ApiError, asyncHandler, listResponse } from '../utils/http.js';

export const newsRouter = Router();

const sources = {
  insightGhana: { name: 'Insight Ghana', url: () => env.insightGhanaWordpressUrl },
  africanJournal: { name: 'The African Journal', url: () => env.africanJournalWordpressUrl },
};

const withoutHtml = (value = '') => value.replace(/<[^>]*>/g, '').trim();
const configuredUrl = (url) => url && !url.includes('placeholder');

const fetchPosts = async ([sourceKey, source], page, perPage) => {
  const baseUrl = source.url();
  if (!configuredUrl(baseUrl)) return [];
  const endpoint = new URL('/wp-json/wp/v2/posts', baseUrl);
  endpoint.searchParams.set('page', String(page));
  endpoint.searchParams.set('per_page', String(perPage));
  endpoint.searchParams.set('_embed', '1');
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
  const posts = await response.json();
  return posts.map((post) => ({
    id: `${sourceKey}:${post.id}`,
    source: sourceKey,
    sourceName: source.name,
    title: withoutHtml(post.title?.rendered),
    summary: withoutHtml(post.excerpt?.rendered),
    content: post.content?.rendered || '',
    publishedAt: post.date_gmt || post.date,
    url: post.link,
    imageUrl: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null,
  }));
};

newsRouter.get('/', asyncHandler(async (req, res) => {
  const selectedSources = req.query.source ? [[req.query.source, sources[req.query.source]]] : Object.entries(sources);
  if (selectedSources.some(([, source]) => !source)) throw new ApiError(400, 'Unknown news source');
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(20, Math.max(1, Number(req.query.perPage) || 10));
  const results = await Promise.allSettled(selectedSources.map((source) => fetchPosts(source, page, perPage)));
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length === results.length) throw new ApiError(502, 'News sources are unavailable or not configured');
  listResponse(res, results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)));
}));
