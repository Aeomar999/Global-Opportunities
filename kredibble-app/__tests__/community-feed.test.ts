import { uploadFile, createChannelPost } from '../src/lib/api';
import { pickImage, pickCameraImage } from '../src/lib/file-picker';

jest.mock('../src/lib/api', () => ({
  uploadFile: jest.fn(),
  createChannelPost: jest.fn(),
}));

jest.mock('../src/lib/file-picker', () => ({
  pickImage: jest.fn(),
  pickCameraImage: jest.fn(),
}));

describe('community-feed native attachments & interactive posts (MOB-013 / SEC-122)', () => {
  const channelId = 'channel-test-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Photo and Camera Attachments', () => {
    test('picks photo from library, uploads to Cloudinary, and creates channel post with bannerImage', async () => {
      (pickImage as jest.Mock).mockResolvedValueOnce({
        uri: 'file:///data/photo.jpg',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 500000,
      });

      (uploadFile as jest.Mock).mockResolvedValueOnce({
        url: 'https://cloudinary.com/kredibble/user1/company-logos/photo.jpg',
        publicId: 'kredibble/user1/company-logos/photo',
        format: 'jpg',
        bytes: 500000,
      });

      (createChannelPost as jest.Mock).mockResolvedValueOnce({
        id: 'post-101',
        channelId,
        body: 'Excited to announce our new team update!',
        bannerImage: 'https://cloudinary.com/kredibble/user1/company-logos/photo.jpg',
        authorName: 'TechCorp',
      });

      const picked = await pickImage({ aspect: [16, 9], quality: 0.85 });
      expect(picked).not.toBeNull();

      const uploadResult = await uploadFile(picked!, 'company-logos');
      expect(uploadResult.url).toBe('https://cloudinary.com/kredibble/user1/company-logos/photo.jpg');

      const createdPost = await createChannelPost(channelId, {
        body: 'Excited to announce our new team update!',
        authorName: 'TechCorp',
        bannerImage: uploadResult.url,
      });

      expect(createdPost.id).toBe('post-101');
      expect(createdPost.bannerImage).toContain('https://cloudinary.com');
      expect(createChannelPost).toHaveBeenCalledWith(channelId, {
        body: 'Excited to announce our new team update!',
        authorName: 'TechCorp',
        bannerImage: 'https://cloudinary.com/kredibble/user1/company-logos/photo.jpg',
      });
    });

    test('picks photo from camera, uploads, and handles empty caption with default fallback', async () => {
      (pickCameraImage as jest.Mock).mockResolvedValueOnce({
        uri: 'file:///data/camera-pic.jpg',
        name: 'camera-pic.jpg',
        mimeType: 'image/jpeg',
        size: 700000,
      });

      (uploadFile as jest.Mock).mockResolvedValueOnce({
        url: 'https://cloudinary.com/kredibble/user1/company-logos/camera-pic.jpg',
        publicId: 'kredibble/user1/company-logos/camera-pic',
        format: 'jpg',
        bytes: 700000,
      });

      (createChannelPost as jest.Mock).mockResolvedValueOnce({
        id: 'post-102',
        channelId,
        body: 'Shared a photo',
        bannerImage: 'https://cloudinary.com/kredibble/user1/company-logos/camera-pic.jpg',
      });

      const picked = await pickCameraImage({ aspect: [16, 9] });
      expect(picked).not.toBeNull();

      const uploadResult = await uploadFile(picked!, 'company-logos');
      const caption = ''.trim() || 'Shared a photo';

      const createdPost = await createChannelPost(channelId, {
        body: caption,
        bannerImage: uploadResult.url,
      });

      expect(createdPost.body).toBe('Shared a photo');
      expect(createChannelPost).toHaveBeenCalledWith(channelId, {
        body: 'Shared a photo',
        bannerImage: uploadResult.url,
      });
    });

    test('does not upload or create post if user cancels picker', async () => {
      (pickImage as jest.Mock).mockResolvedValueOnce(null);

      const picked = await pickImage();
      expect(picked).toBeNull();
      expect(uploadFile).not.toHaveBeenCalled();
      expect(createChannelPost).not.toHaveBeenCalled();
    });

    test('propagates upload error and does not create post when upload fails', async () => {
      (pickImage as jest.Mock).mockResolvedValueOnce({
        uri: 'file:///data/large.jpg',
        name: 'large.jpg',
        mimeType: 'image/jpeg',
      });

      (uploadFile as jest.Mock).mockRejectedValueOnce(new Error('File exceeds 5MB limit'));

      const picked = await pickImage();
      await expect(uploadFile(picked!, 'company-logos')).rejects.toThrow('File exceeds 5MB limit');
      expect(createChannelPost).not.toHaveBeenCalled();
    });
  });

  describe('Interactive Modal Posts (Poll, Quiz, Question)', () => {
    test('creates Poll post with emoji title and hasRespondButton enabled', async () => {
      (createChannelPost as jest.Mock).mockResolvedValueOnce({
        id: 'poll-1',
        channelId,
        title: '📊 Poll',
        body: 'Which framework do you prefer for cross-platform apps? A) React Native, B) Flutter',
        hasRespondButton: true,
      });

      const post = await createChannelPost(channelId, {
        title: '📊 Poll',
        body: 'Which framework do you prefer for cross-platform apps? A) React Native, B) Flutter',
        authorName: 'Hirer',
        hasRespondButton: true,
      });

      expect(post.title).toBe('📊 Poll');
      expect(post.hasRespondButton).toBe(true);
      expect(createChannelPost).toHaveBeenCalledWith(channelId, {
        title: '📊 Poll',
        body: 'Which framework do you prefer for cross-platform apps? A) React Native, B) Flutter',
        authorName: 'Hirer',
        hasRespondButton: true,
      });
    });

    test('creates Quiz post with custom headline and options', async () => {
      (createChannelPost as jest.Mock).mockResolvedValueOnce({
        id: 'quiz-1',
        channelId,
        title: 'Weekly TypeScript Quiz #4',
        body: 'What does infer keyword do in TypeScript conditional types?',
        hasRespondButton: true,
      });

      const post = await createChannelPost(channelId, {
        title: 'Weekly TypeScript Quiz #4',
        body: 'What does infer keyword do in TypeScript conditional types?',
        authorName: 'Hirer',
        hasRespondButton: true,
      });

      expect(post.title).toBe('Weekly TypeScript Quiz #4');
      expect(post.hasRespondButton).toBe(true);
    });

    test('creates Question post with emoji fallback when headline is empty', async () => {
      const customHeadline = '';
      const kind = 'Question';
      const emoji = '❓';
      const title = customHeadline.trim() || `${emoji} ${kind}`;

      (createChannelPost as jest.Mock).mockResolvedValueOnce({
        id: 'question-1',
        channelId,
        title,
        body: 'What are the best tips for onboarding junior engineers effectively?',
        hasRespondButton: true,
      });

      const post = await createChannelPost(channelId, {
        title,
        body: 'What are the best tips for onboarding junior engineers effectively?',
        authorName: 'Hirer',
        hasRespondButton: true,
      });

      expect(post.title).toBe('❓ Question');
      expect(post.hasRespondButton).toBe(true);
    });
  });
});
