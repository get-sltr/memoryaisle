// Photo Upload Service
// Handles image capture, compression, and S3 upload via presigned URLs
// Used by: Meal Memories, Profile Photos

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { readAsStringAsync } from 'expo-file-system';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

export type UploadType = 'profile_photo' | 'meal_memory' | 'blog_asset';

interface UploadResult {
  success: boolean;
  cdnUrl?: string;
  error?: string;
}

interface PresignedResponse {
  success: boolean;
  uploadUrl: string;
  cdnUrl: string;
  key: string;
  expiresIn: number;
}

class PhotoUploadService {
  // Pick photo from camera
  async capturePhoto(): Promise<string | null> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      logger.log('Camera permission denied');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1], // Square for profile, flexible for memories
    });

    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  }

  // Pick photo from gallery
  async pickFromGallery(allowsEditing = true, aspect?: [number, number]): Promise<string | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      logger.log('Media library permission denied');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing,
      aspect: aspect || [4, 3],
    });

    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  }

  // Compress image to max width, return URI
  async compressImage(uri: string, maxWidth = 1200): Promise<string> {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipulated.uri;
  }

  // Get presigned URL from edge function
  private async getPresignedUrl(type: UploadType, filename?: string): Promise<PresignedResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('s3-upload', {
      body: {
        type,
        filename: filename || 'photo.jpg',
        contentType: 'image/jpeg',
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || 'Failed to get upload URL');

    return data as PresignedResponse;
  }

  // Upload file to S3 using presigned URL
  private async uploadToS3(presignedUrl: string, fileUri: string): Promise<void> {
    // Read file as base64, convert to binary for fetch upload
    const base64 = await readAsStringAsync(fileUri, { encoding: 'base64' });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: bytes,
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed with status ${response.status}`);
    }
  }

  // Full upload pipeline: compress → get presigned URL → upload to S3
  async uploadPhoto(uri: string, type: UploadType, filename?: string): Promise<UploadResult> {
    try {
      // 1. Compress image
      const maxWidth = type === 'profile_photo' ? 600 : 1200;
      const compressedUri = await this.compressImage(uri, maxWidth);

      // 2. Get presigned URL
      const { uploadUrl, cdnUrl } = await this.getPresignedUrl(type, filename);

      // 3. Upload to S3
      await this.uploadToS3(uploadUrl, compressedUri);

      logger.log(`Photo uploaded: ${type} → ${cdnUrl}`);
      return { success: true, cdnUrl };
    } catch (error: any) {
      logger.error('Photo upload failed:', error);
      return { success: false, error: error.message || 'Upload failed' };
    }
  }
}

export const photoUploadService = new PhotoUploadService();
