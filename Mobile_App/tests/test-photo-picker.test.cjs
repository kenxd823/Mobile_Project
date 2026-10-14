const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');

const picker = (result) => load('src/services/test-photo-picker.ts', {
  'expo-image-picker': {
    UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
    launchImageLibraryAsync: async (options) => {
      assert.equal(options.allowsEditing, false); // Avoid changing the before/after comparison area.
      assert.equal(options.allowsMultipleSelection, false);
      assert.equal(options.preferredAssetRepresentationMode, 'compatible');
      return result;
    },
  },
});

test('test picker handles selected images and cancellation', async () => {
  assert.equal(await picker({ canceled: false, assets: [{ uri: 'file:///test.png', fileSize: 500 }] }).pickTestPhotoUri(), 'file:///test.png');
  assert.equal(await picker({ canceled: true, assets: null }).pickTestPhotoUri(), null);
});

test('missing image and oversized files are rejected before analysis', async () => {
  await assert.rejects(picker({ canceled: false, assets: [{}] }).pickTestPhotoUri(), /อ่านรูปที่เลือกไม่ได้/);
  await assert.rejects(picker({ canceled: false, assets: [{ uri: 'file:///large.jpg', fileSize: 13 * 1024 * 1024 }] }).pickTestPhotoUri(), /ใหญ่เกิน 12 MB/);
});
