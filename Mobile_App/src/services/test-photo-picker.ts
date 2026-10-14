import * as ImagePicker from 'expo-image-picker';

// Temporary test feature. Set false to hide; remove this helper and scanner hooks after testing.
export const ENABLE_TEST_PHOTO_LIBRARY = true;

export async function pickTestPhotoUri(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: false,
    quality: 0.9,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;
  const image = result.assets[0];
  if (!image?.uri) throw new Error('อ่านรูปที่เลือกไม่ได้ กรุณาเลือกรูปใหม่');
  if (image.fileSize && image.fileSize > 12 * 1024 * 1024) throw new Error('รูปภาพใหญ่เกิน 12 MB กรุณาเลือกรูปที่เล็กลง');
  return image.uri;
}
