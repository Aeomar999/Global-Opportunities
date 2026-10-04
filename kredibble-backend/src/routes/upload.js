import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { uploadBufferToCloudinary } from '../lib/cloudinary.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter as uploadRateLimiter } from '../lib/rate-limiters.js';
import { ApiError, asyncHandler } from '../utils/http.js';

// SEC-013: MIME type allowlist
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

/** Images only: the admin dashboard uploads article banners, never documents. */
export const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MIME_LABELS = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

const notAllowedMessage = (mimeType, allowedMimeTypes) =>
  `File type ${mimeType} not allowed. Allowed: ${[...allowedMimeTypes].map((type) => MIME_LABELS[type]).join(', ')}`;

// SEC-013: Magic bytes for each allowed type
const MAGIC_BYTES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG signature
  'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG SOI + APP0/APP1
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF (WebP)
};

// SEC-013: Upload purpose enum - server derives folder from this
const UPLOAD_PURPOSE = {
  CV: 'cvs',
  AVATAR: 'avatars',
  COMPANY_LOGO: 'company-logos',
  VERIFICATION_DOC: 'verification-docs',
};

const UPLOAD_PURPOSE_VALUES = Object.values(UPLOAD_PURPOSE);

// SEC-013 + SEC-024: Per-user upload rate limit (20/hour), shared via the
// Redis-backed factory in production.
const uploadLimiter = uploadRateLimiter;

/**
 * Validates file buffer against magic bytes
 */
function validateMagicBytes(buffer, declaredMimeType) {
  const expectedBytes = MAGIC_BYTES[declaredMimeType];
  if (!expectedBytes) return false;

  if (buffer.length < expectedBytes.length) return false;

  for (let i = 0; i < expectedBytes.length; i++) {
    if (buffer[i] !== expectedBytes[i]) return false;
  }
  return true;
}

/**
 * Build an upload router.
 * Expects: file in 'file' field, optional 'purpose' in query (one of `purposes`;
 * anything else falls back to the first). The server derives the folder.
 *
 * @param {object} options
 * @param {Function} options.authenticate - auth middleware for the mount
 * @param {string[]} options.purposes - allowed purposes; the first is the default
 * @param {(req, purpose: string) => string} options.folderFor - Cloudinary folder for an upload
 * @param {Set<string>} [options.allowedMimeTypes] - defaults to the SEC-013 allowlist
 */
export const createUploadRouter = ({ authenticate, purposes, folderFor, allowedMimeTypes = ALLOWED_MIME_TYPES }) => {
  const router = Router();

  // Configure multer to store files in memory
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    // Reject disallowed types before buffering them. Shares the SEC-013 allowlist
    // and wording with the handler so the client sees one message either way.
    fileFilter(req, file, callback) {
      const allowed = allowedMimeTypes.has(file.mimetype);
      callback(allowed ? null : new ApiError(400, notAllowedMessage(file.mimetype, allowedMimeTypes)), allowed);
    },
  });

  router.use(authenticate);
  router.use(uploadLimiter);

  router.post(
    '/',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new ApiError(400, 'No file uploaded');
      }

      // SEC-013: Validate declared MIME type is in allowlist
      const declaredMimeType = req.file.mimetype;
      if (!allowedMimeTypes.has(declaredMimeType)) {
        throw new ApiError(400, notAllowedMessage(declaredMimeType, allowedMimeTypes));
      }

      // SEC-013: Validate magic bytes match declared type
      if (!validateMagicBytes(req.file.buffer, declaredMimeType)) {
        throw new ApiError(400, 'File content does not match declared type');
      }

      // SEC-013: Use file-type as secondary validation
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || !allowedMimeTypes.has(detected.mime)) {
        throw new ApiError(400, 'File type detection failed or type not allowed');
      }
      if (detected.mime !== declaredMimeType) {
        throw new ApiError(400, 'File content does not match declared MIME type');
      }

      // SEC-013: Purpose must be one of the allowed values
      const purposeParam = req.query.purpose;
      const purpose = purposes.includes(purposeParam) ? purposeParam : purposes[0];

      // SEC-013: Upload to Cloudinary with random filename
      const result = await uploadBufferToCloudinary(req.file.buffer, folderFor(req, purpose));

      res.json({
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          folder: result.folder,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
      });
    })
  );

  return router;
};

export const uploadRouter = createUploadRouter({
  authenticate: requireAuth,
  // CV first: it is the default when no purpose is given.
  purposes: [UPLOAD_PURPOSE.CV, ...UPLOAD_PURPOSE_VALUES.filter((purpose) => purpose !== UPLOAD_PURPOSE.CV)],
  // SEC-013: Server derives folder from user ID and purpose
  folderFor: (req, purpose) => `kredibble/${req.auth.sub}/${purpose}`,
});