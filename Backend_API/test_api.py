import io
import json
import unittest
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import mysql.connector
import api_server
from nutrition import aggregate_nutrition, NUTRIENT_COLUMNS
from menu_reference import load_menu_reference


class NutritionTests(unittest.TestCase):
    def test_all_eight_nutrients_and_sodium_units(self):
        row = {column: 0.5 for column in NUTRIENT_COLUMNS.values()}
        row['sodium_mg_per_gram'] = 4
        totals = aggregate_nutrition([(row, 100), (row, 50)])
        self.assertEqual(len(totals), 8)
        self.assertEqual(totals['protein'], 75)
        self.assertEqual(totals['sodium'], 600)

    def test_missing_component_is_unknown_not_zero_or_partial_total(self):
        self.assertIsNone(aggregate_nutrition([({'fat_per_gram': 1}, 100), ({}, 10)])['fat'])
        self.assertEqual(aggregate_nutrition([({'sugar_per_gram': 0}, 100)])['sugar'], 0)
        self.assertIsNone(aggregate_nutrition([({'fiber_per_gram': float('nan')}, 100)])['fiber'])

    def test_fixed_reference_requires_source_and_preserves_missing_values(self):
        row = {'menu': 'เมนูทดสอบ', 'source': None, 'nutrition': {'calories': 500, 'sugar': 0}}
        with patch('menu_reference.REFERENCE_PATH') as path:
            path.read_text.return_value = json.dumps({'test': row})
            self.assertIsNone(load_menu_reference('test')['nutrition']['calories'])
            row['source'] = 'test fixture, not actual nutrition data'
            path.read_text.return_value = json.dumps({'test': row})
            result = load_menu_reference('test')
        self.assertEqual(result['nutrition']['calories'], 500)
        self.assertEqual(result['nutrition']['sugar'], 0)
        self.assertIsNone(result['nutrition']['protein'])

    def test_unknown_menu_does_not_inherit_another_menu_reference(self):
        with patch('menu_reference.REFERENCE_PATH') as path:
            path.read_text.return_value = json.dumps({'known': {'source': 'test fixture', 'nutrition': {'calories': 500}}})
            result = load_menu_reference('unknown')
        self.assertTrue(all(value is None for value in result['nutrition'].values()))


class CandidatePredictorTests(unittest.TestCase):
    def test_nested_checkpoint_output_keeps_alternative_labels(self):
        import torch
        from types import SimpleNamespace
        from menu_predictor import MenuPredictor
        predictor = object.__new__(MenuPredictor)
        predictor.args = SimpleNamespace(conf=0.001, iou=0.7, classes=None, agnostic_nms=False, max_det=30)
        predictor.model = SimpleNamespace(names={0: 'rice', 1: 'fish', 2: 'soup'}, end2end=False)
        predictor.construct_results = MagicMock(return_value=[])
        prediction = torch.tensor([[[10.], [10.], [5.], [5.], [0.8], [0.6], [0.3]]])
        predictor.postprocess(((prediction,),), torch.zeros((1, 3, 32, 32)), [np.zeros((32, 32, 3), dtype=np.uint8)])
        boxes = predictor.construct_results.call_args.args[0][0]
        self.assertEqual(set(boxes[:, 5].tolist()), {0.0, 1.0, 2.0})


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = api_server.app.test_client()
        self.reference = {'menu': 'ข้าว', 'nutrition': {key: 500 if key == 'calories' else None for key in NUTRIENT_COLUMNS}, 'nutritionBasis': 'fixed-serving', 'servingLabel': '1 จาน', 'source': 'test fixture, not public nutrition data', 'referenceClass': 'rice'}
        patcher = patch('api_server.load_menu_reference', side_effect=lambda name: {**self.reference, 'referenceClass': name})
        self.lookup = patcher.start()
        self.addCleanup(patcher.stop)

    def upload(self, **fields):
        _, image = cv2.imencode('.jpg', np.zeros((40, 80, 3), dtype=np.uint8))
        return self.client.post('/api/analyze', data={'image': (io.BytesIO(image.tobytes()), 'food.jpg'), **fields})

    def model(self, food=True):
        result = MagicMock()
        result.names = {0: 'rice'}
        box = MagicMock()
        box.cls = [0]
        box.conf = [0.9]
        box.xyxy.__getitem__.return_value.cpu.return_value.numpy.return_value = np.array([0, 0, 10, 20])
        result.boxes = [box] if food else []
        return MagicMock(return_value=[result])

    def test_missing_or_invalid_upload(self):
        self.assertEqual(self.client.post('/api/analyze').status_code, 400)
        response = self.client.post('/api/analyze', data={'image': (io.BytesIO(b'bad'), 'food.jpg')})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.upload(mode='invalid').status_code, 400)

    @patch('api_server.mysql.connector.connect', side_effect=mysql.connector.Error('offline'))
    def test_health_identifies_database_failure(self, _connect):
        self.assertEqual(self.client.get('/api/health').status_code, 503)

    @patch('api_server.load_models')
    def test_empty_is_not_reported_as_finished_meal(self, _load):
        with patch.object(api_server, 'model_food', self.model(False)), patch.object(api_server, 'model_spoon', self.model(False)):
            response = self.upload()
        self.assertEqual(response.json['status'], 'empty')
        self.assertNotIn('nutrition', response.json)

    @patch('api_server.load_models')
    def test_fixed_nutrition_is_independent_of_detected_area(self, _load):
        food = self.model()
        with patch.object(api_server, 'model_food', food), patch.object(api_server, 'model_spoon', self.model(False)):
            first = self.upload().json
            food.return_value[0].boxes[0].xyxy.__getitem__.return_value.cpu.return_value.numpy.return_value = np.array([0, 0, 20, 40])
            second = self.upload().json
        self.assertEqual(first['nutrition'], second['nutrition'])
        self.assertEqual(first['nutrition']['calories'], 500)
        self.assertEqual(first['nutritionBasis'], 'fixed-serving')
        self.assertEqual(first['portions'][0]['area'], 200)
        self.assertEqual(second['portions'][0]['area'], 800)
        self.assertFalse(first['comparisonReady'])
        self.assertNotIn('grams', first['portions'][0])

    @patch('api_server.load_models')
    def test_spoon_is_only_a_scale_for_area_and_does_not_change_nutrition(self, _load):
        food, spoon = self.model(), self.model()
        with patch.object(api_server, 'model_food', food), patch.object(api_server, 'model_spoon', spoon):
            response = self.upload().json
        self.assertTrue(response['comparisonReady'])
        self.assertEqual(response['portions'][0]['relativeArea'], 1)
        self.assertEqual(response['nutrition']['calories'], 500)
        self.assertEqual(food.call_args.kwargs['imgsz'], 960)

    @patch('api_server.load_models')
    @patch('api_server.mysql.connector.connect', side_effect=mysql.connector.Error('offline'))
    def test_after_photo_does_not_lookup_new_nutrition_or_require_gram_database(self, connect, _load):
        with patch.object(api_server, 'model_food', self.model()), patch.object(api_server, 'model_spoon', self.model()):
            response = self.upload(mode='after', menu_class='rice').json
        self.assertEqual(response['status'], 'success')
        self.assertEqual(response['nutritionBasis'], 'area-only')
        self.assertEqual(response['nutrition'], {})
        self.assertEqual(response['portions'][0]['relativeArea'], 1)
        self.lookup.assert_not_called()
        connect.assert_not_called()

    @patch('api_server.load_models')
    def test_after_wrong_menu_requires_review_instead_of_overwriting_before(self, _load):
        with patch.object(api_server, 'model_food', self.model()), patch.object(api_server, 'model_spoon', self.model()):
            self.assertEqual(self.upload(mode='after', menu_class='different_menu').json['status'], 'empty')

    @patch('api_server.load_models')
    def test_unfilled_reference_does_not_invent_nutrients_or_discard_detected_area(self, _load):
        self.reference['nutrition'] = {key: None for key in NUTRIENT_COLUMNS}
        self.reference['source'] = None
        with patch.object(api_server, 'model_food', self.model()), patch.object(api_server, 'model_spoon', self.model()):
            response = self.upload().json
        self.assertEqual(response['status'], 'success')
        self.assertTrue(response['comparisonReady'])
        self.assertTrue(all(value is None for value in response['nutrition'].values()))

    @patch('api_server.load_models', side_effect=RuntimeError('bad model'))
    def test_model_failure_is_structured(self, _load):
        self.assertEqual(self.upload().status_code, 500)


    @patch('api_server.load_models')
    def test_top_three_are_distinct_real_scores_in_descending_order(self, _load):
        food = self.model()
        result = food.return_value[0]
        result.names = {0: 'rice', 1: 'fish', 2: 'soup', 3: 'egg'}
        result.boxes = []
        for index, score in [(0, 0.6), (1, 0.9), (2, 0.4), (3, 0.1), (1, 0.5)]:
            box = MagicMock()
            box.cls, box.conf = [index], [score]
            box.xyxy.__getitem__.return_value.cpu.return_value.numpy.return_value = np.array([0, 0, 10, 20])
            result.boxes.append(box)
        with patch.object(api_server, 'model_food', food), patch.object(api_server, 'model_spoon', self.model(False)):
            response = self.upload().json
        self.assertEqual([item['referenceClass'] for item in response['candidates']], ['fish', 'rice', 'soup'])
        self.assertEqual([item['confidence'] for item in response['candidates']], [0.9, 0.6, 0.4])
        self.assertEqual(response['referenceClass'], 'fish')

    @patch('api_server.load_models')
    def test_after_no_food_needs_confirmation_not_automatic_empty_plate(self, _load):
        with patch.object(api_server, 'model_food', self.model(False)), patch.object(api_server, 'model_spoon', self.model(False)):
            response = self.upload(mode='after', menu_class='rice').json
        self.assertEqual(response['status'], 'success')
        self.assertTrue(response['emptyCandidate'])
        self.assertNotIn('leftoverPercent', response)


if __name__ == '__main__':
    unittest.main()
