import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface PickDocumentOptions {
  type?: string[];
  maxBytes?: number;
}

export interface PickImageOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  maxBytes?: number;
  useCamera?: boolean;
}

const DEFAULT_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Native and cross-platform document picker.
 * Uses expo-document-picker to let users pick PDF, DOCX, or text files on iOS, Android, and Web.
 */
export async function pickDocument(options: PickDocumentOptions = {}): Promise<PickedFile | null> {
  const types = options.type || DEFAULT_DOC_TYPES;
  const maxBytes = options.maxBytes || DEFAULT_MAX_SIZE_BYTES;

  const result = await DocumentPicker.getDocumentAsync({
    type: types,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (asset.size && asset.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`File is too large. Maximum size is ${maxMb}MB.`);
  }

  return {
    uri: asset.uri,
    name: asset.name || 'document.pdf',
    mimeType: asset.mimeType || 'application/pdf',
    size: asset.size,
  };
}

/**
 * Native and cross-platform image picker.
 * Uses expo-image-picker to let users pick photos/logos or take camera photos on iOS, Android, and Web.
 */
export async function pickImage(options: PickImageOptions = {}): Promise<PickedFile | null> {
  const maxBytes = options.maxBytes || DEFAULT_MAX_SIZE_BYTES;

  let result: ImagePicker.ImagePickerResult;

  if (options.useCamera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permission to access camera is required.');
    }
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options.allowsEditing ?? true,
      aspect: options.aspect ?? [1, 1],
      quality: options.quality ?? 0.85,
    });
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permission to access photos is required.');
    }
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options.allowsEditing ?? true,
      aspect: options.aspect ?? [1, 1],
      quality: options.quality ?? 0.85,
    });
  }

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`Image is too large. Maximum size is ${maxMb}MB.`);
  }

  const fileName = asset.fileName || asset.uri.split('/').pop() || 'image.jpg';

  return {
    uri: asset.uri,
    name: fileName,
    mimeType: asset.mimeType || 'image/jpeg',
    size: asset.fileSize,
  };
}

/**
 * Native camera capture helper.
 * Convenience wrapper for pickImage with useCamera: true.
 */
export async function pickCameraImage(options: Omit<PickImageOptions, 'useCamera'> = {}): Promise<PickedFile | null> {
  return pickImage({ ...options, useCamera: true });
}
