import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
import cv2
import numpy as np
from spoon_bowl import extract_spoon_bowl, measure_spoon_bowl


class SpoonBowlTests(unittest.TestCase):
    def mask(self):
        mask = np.zeros((180, 180), dtype=np.uint8)
        cv2.ellipse(mask, (55, 90), (25, 35), 0, 0, 360, 255, -1)
        cv2.rectangle(mask, (75, 85), (160, 95), 255, -1)
        return mask

    def test_cuts_handle_and_retains_head_for_different_orientations(self):
        for turns in range(4):
            mask = np.rot90(self.mask(), turns).copy()
            bowl, width, center = extract_spoon_bowl(mask)
            self.assertGreater(np.count_nonzero(bowl), 1500)
            self.assertLess(np.count_nonzero(bowl), np.count_nonzero(mask))
            self.assertTrue(np.all(bowl[mask == 0] == 0))
            self.assertGreater(width, 40)
            self.assertEqual(bowl[center[1], center[0]], 255)
            unrotated = np.rot90(bowl, -turns)
            self.assertEqual(unrotated[90, 55], 255)
            self.assertEqual(unrotated[90, 140], 0)

    def test_empty_and_tiny_masks_never_become_a_reference(self):
        for mask in [np.zeros((30, 30), np.uint8), np.eye(20, dtype=np.uint8)]:
            bowl, width, _ = extract_spoon_bowl(mask)
            self.assertEqual(np.count_nonzero(bowl), 0)
            self.assertEqual(width, 0)

    def test_disconnected_noise_is_not_part_of_head(self):
        mask = self.mask()
        mask[5:9, 5:9] = 255
        bowl, _, _ = extract_spoon_bowl(mask)
        self.assertEqual(np.count_nonzero(bowl[5:9, 5:9]), 0)

    def test_boxes_without_masks_and_wrong_mask_dimensions_do_not_fall_back_to_whole_spoon(self):
        self.assertEqual(measure_spoon_bowl(SimpleNamespace(masks=None), (180, 180, 3)), (0, 0))
        result = SimpleNamespace(boxes=[SimpleNamespace(cls=[44])], masks=MagicMock())
        result.masks.data.cpu.return_value.numpy.return_value = np.ones((1, 10, 10))
        self.assertEqual(measure_spoon_bowl(result, (180, 180, 3)), (0, 0))


if __name__ == '__main__':
    unittest.main()
