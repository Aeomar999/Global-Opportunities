import { ApiError } from '../utils/http.js';

/**
 * Middleware to validate request body, params, or query against a Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const message = result.error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ApiError(400, `Validation failed: ${message}`);
    }

    // Replace req data with parsed/transformed data from Zod
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;

    next();
  } catch (error) {
    next(error);
  }
};