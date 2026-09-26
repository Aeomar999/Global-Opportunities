import { Router } from 'express';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../lib/cloudinary.js';
import { requireAuth } from '../middleware/auth.js';
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

const safeFolder = (value) => String(value || 'general').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'general';

/**
 * Generic upload route
 * Expects a file in the 'file' field and an optional 'folder' query param
 */
uploadRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    const folder = safeFolder(req.query.folder || req.body?.folder);

    // Upload buffer to Cloudinary
    const result = await uploadBufferToCloudinary(req.file.buffer, folder);

    res.json({
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      },
    });
  })
);
