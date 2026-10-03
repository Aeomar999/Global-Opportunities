import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { ApiError } from '../utils/http.js';
import logger from './logger.js';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

const isTest = process.env.NODE_ENV === 'test';

/**
 * Uploads a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} folder - Folder name in Cloudinary (e.g., 'cvs', 'logos')
 * @returns {Promise<Object>}
 */
export const uploadBufferToCloudinary = (buffer, folder) => {
  if (isTest) {
    // Return mock result in test environment
    return Promise.resolve({
      secure_url: `https://res.cloudinary.com/test/image/upload/${folder}/mock-file`,
      public_id: `${folder}/mock-file`,
      format: 'png',
      bytes: buffer.length,
      folder: `kredibble/${folder}`,
    });
  }

  // SEC-013: Validate Cloudinary is configured in non-test environments
  if (![process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean)) {
    throw new ApiError(503, 'Cloudinary is not configured');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `kredibble/${folder}`, resource_type: 'auto' },
      (error, result) => {
        if (error) {
          logger.error({ error: error.message, folder }, 'Cloudinary buffer upload error');
          reject(new Error('Failed to upload file to cloud storage'));
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Uploads a file buffer or base64 string to Cloudinary
 * @param {string} fileContent - Base64 string or file path
 * @param {string} folder - Folder name in Cloudinary (e.g., 'cvs', 'logos')
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const uploadToCloudinary = async (fileContent, folder) => {
  if (isTest) {
    return {
      secure_url: `https://res.cloudinary.com/test/image/upload/${folder}/mock-file`,
      public_id: `${folder}/mock-file`,
      format: 'png',
      bytes: typeof fileContent === 'string' ? fileContent.length : fileContent.length,
      folder: `kredibble/${folder}`,
    };
  }

  // SEC-013: Validate Cloudinary is configured in non-test environments
  if (![process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean)) {
    throw new ApiError(503, 'Cloudinary is not configured');
  }

  try {
    const result = await cloudinary.uploader.upload(fileContent, {
      folder: `kredibble/${folder}`,
      resource_type: 'auto',
    });
    return result;
  } catch (error) {
    logger.error({ error: error.message }, 'Cloudinary upload error');
    throw new Error('Failed to upload file to cloud storage');
  }
};

/**
 * SEC-065: delete every file a user uploaded. The upload route builds
 * `kredibble/<userId>/<purpose>` and the upload helpers prefix `kredibble/`
 * again, so files live under `kredibble/kredibble/<userId>/`. Clear both forms.
 */
export const deleteUserMedia = async (userId) => {
  if (isTest) return;
  if (![process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean)) {
    throw new Error('Cloudinary is not configured');
  }

  for (const prefix of [`kredibble/kredibble/${userId}/`, `kredibble/${userId}/`]) {
    for (const resourceType of ['image', 'raw', 'video']) {
      await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: resourceType });
    }
  }
};
