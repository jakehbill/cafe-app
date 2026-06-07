import * as ImagePicker from 'expo-image-picker';

import type { VisitPhotoAsset } from '@/lib/visitPhotoLimits';

export async function pickVisitPhotoFromLibrary(): Promise<VisitPhotoAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow photo access to add visit photos.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.86,
  });
  if (picked.canceled) return null;

  const asset = picked.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
  };
}
