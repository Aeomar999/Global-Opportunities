import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { pickDocument, pickImage } from '../src/lib/file-picker';
import { uploadFile } from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('file-picker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pickDocument', () => {
    test('returns picked file metadata when user selects a valid document', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///path/to/my-resume.pdf',
            name: 'my-resume.pdf',
            mimeType: 'application/pdf',
            size: 1024 * 500, // 500 KB
          },
        ],
      });

      const file = await pickDocument();
      expect(file).toEqual({
        uri: 'file:///path/to/my-resume.pdf',
        name: 'my-resume.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 500,
      });
      expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
    });

    test('returns null when document picker is canceled', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: null,
      });

      const file = await pickDocument();
      expect(file).toBeNull();
    });

    test('throws error when picked document exceeds maxBytes', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///path/to/huge.pdf',
            name: 'huge.pdf',
            size: 6 * 1024 * 1024, // 6 MB (limit is 5 MB)
          },
        ],
      });

      await expect(pickDocument()).rejects.toThrow('File is too large. Maximum size is 5MB.');
    });

    test('uses fallback filename and mimeType if omitted by asset', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///path/to/unnamed',
            size: 1024,
          },
        ],
      });

      const file = await pickDocument();
      expect(file).toEqual({
        uri: 'file:///path/to/unnamed',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      });
    });
  });

  describe('pickImage', () => {
    test('throws error when media library permission is denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: false,
      });

      await expect(pickImage()).rejects.toThrow('Permission to access photos is required.');
    });

    test('returns null when user cancels image picker', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: null,
      });

      const file = await pickImage();
      expect(file).toBeNull();
    });

    test('throws error when image exceeds maxBytes', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///path/to/huge-logo.png',
            fileSize: 10 * 1024 * 1024,
          },
        ],
      });

      await expect(pickImage()).rejects.toThrow('Image is too large. Maximum size is 5MB.');
    });

    test('returns image metadata when user selects valid photo', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///path/to/logo.png',
            fileName: 'company-logo.png',
            mimeType: 'image/png',
            fileSize: 204800,
          },
        ],
      });

      const file = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      expect(file).toEqual({
        uri: 'file:///path/to/logo.png',
        name: 'company-logo.png',
        mimeType: 'image/png',
        size: 204800,
      });
    });
  });

  describe('uploadFile', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-jwt-token');
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    test('uploads file to /upload with purpose and authorization header', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            url: 'https://cloudinary.com/kredibble/user123/cvs/resume.pdf',
            publicId: 'kredibble/user123/cvs/resume',
            format: 'pdf',
            bytes: 51200,
          },
        }),
      });

      const result = await uploadFile(
        { uri: 'file:///path/resume.pdf', name: 'resume.pdf', mimeType: 'application/pdf' },
        'cvs'
      );

      expect(result.url).toBe('https://cloudinary.com/kredibble/user123/cvs/resume.pdf');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload?purpose=cvs'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
          }),
        })
      );
    });

    test('throws error if upload fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'File type not allowed' },
        }),
      });

      await expect(
        uploadFile(
          { uri: 'file:///path/bad.exe', name: 'bad.exe', mimeType: 'application/x-msdownload' },
          'cvs'
        )
      ).rejects.toThrow('File type not allowed');
    });
  });
});
