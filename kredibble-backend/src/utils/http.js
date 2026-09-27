export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (resource = 'Resource') => new ApiError(404, `${resource} not found`);

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/**
 * Pagination helper — clamps and normalizes query parameters.
 * @param {Object} query - Express req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Builds a paginated response payload.
 * @param {Array} data - Items for the current page
 * @param {number} total - Total items matching the filter (unpaginated)
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} Paginated response object
 */
export const paginatedResponse = (data, total, page, limit) => ({
  data,
  meta: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  },
});

export const listResponse = (res, data, total, page, limit) => {
  if (total !== undefined && page !== undefined && limit !== undefined) {
    return res.json(paginatedResponse(data, total, page, limit));
  }
  // Backward compatibility: non-paginated response
  return res.json(paginatedResponse(data, data.length, 1, data.length));
};

export const itemResponse = (res, data) => res.json({ data });

/**
 * Field names that must never reach a client, regardless of which model they
 * came from (SEC-011, SEC-012). A denylist is used deliberately: new models that
 * add a sensitive column are protected the moment they are persisted, without
 * anyone having to remember to register them here.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'passwordhash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'resetPasswordToken',
  'resetToken',
  'verificationToken',
  'mfaSecret',
  'totpSecret',
  'privateKey',
]);

/**
 * True only for `{}`-style objects. Class instances (ObjectId, Date, Buffer,
 * Decimal128, ...) return false and must be passed through untouched.
 */
const isPlainObject = (value) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export const stripSensitive = (value) => {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  // Never rebuild a class instance. Copying a Mongoose ObjectId field-by-field
  // strips its prototype and its `toJSON`, so the client receives the internal
  // buffer shape ({i0,i1,i2,i3}) instead of the hex id string. That silently
  // breaks every id a client echoes back on a follow-up request.
  if (!isPlainObject(value)) return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    out[key] = val && typeof val === 'object' ? stripSensitive(val) : val;
  }
  return out;
};
