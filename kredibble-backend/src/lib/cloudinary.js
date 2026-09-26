import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { ApiError } from '../utils/http.js';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

/**
 * Uploads a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} folder - Folder name in Cloudinary (e.g., 'cvs', 'logos')
 * @returns {Promise<Object>}
 */
export const uploadBufferToCloudinary = (buffer, folder) => {
  if (![process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean)) {
    throw new ApiError(503, 'Cloudinary is not configured');
  }
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `kredibble/${folder}`, resource_type: 'auto' },
      (error, result) => {
        if (error) {
          console.error('Cloudinary buffer upload error:', error);
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
  try {
    const result = await cloudinary.uploader.upload(fileContent, {
      folder: `kredibble/${folder}`,
      resource_type: 'auto',
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to cloud storage');
  }
};
