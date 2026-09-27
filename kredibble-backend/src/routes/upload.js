import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { uploadBufferToCloudinary } from '../lib/cloudinary.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { ApiError, asyncHandler } from '../utils/http.js';

export const uploadRouter = Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// SEC-013: MIME type allowlist
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

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

// SEC-013 + SEC-024: Per-user upload rate limit (20/hour)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  message: { error: { message: 'Too many uploads, please try again later' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.sub || ipKeyGenerator(req, { ipv6Subnet: 56 }),
  skip: () => process.env.NODE_ENV === 'test',
});

uploadRouter.use(requireAuth);
uploadRouter.use(uploadLimiter);

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
 * Upload endpoint
 * Expects: file in 'file' field, optional 'purpose' in query (must be one of UPLOAD_PURPOSE values)
 * Server derives folder from user ID and purpose
 */
uploadRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    // SEC-013: Validate declared MIME type is in allowlist
    const declaredMimeType = req.file.mimetype;
    if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
      throw new ApiError(400, `File type ${declaredMimeType} not allowed. Allowed: PDF, PNG, JPEG, WebP`);
    }

    // SEC-013: Validate magic bytes match declared type
    if (!validateMagicBytes(req.file.buffer, declaredMimeType)) {
      throw new ApiError(400, 'File content does not match declared type');
    }

    // SEC-013: Use file-type as secondary validation
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new ApiError(400, 'File type detection failed or type not allowed');
    }
    if (detected.mime !== declaredMimeType) {
      throw new ApiError(400, 'File content does not match declared MIME type');
    }

    // SEC-013: Purpose must be one of the enum values
    const purposeParam = req.query.purpose;
    const purpose = UPLOAD_PURPOSE_VALUES.includes(purposeParam)
      ? purposeParam
      : UPLOAD_PURPOSE.CV; // default fallback

    // SEC-013: Server derives folder from user ID and purpose
    const folder = `kredibble/${req.auth.sub}/${purpose}`;

    // SEC-013: Upload to Cloudinary with random filename
    const result = await uploadBufferToCloudinary(req.file.buffer, folder);

    res.json({
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        folder: result.folder,
      },
    });
  })
);