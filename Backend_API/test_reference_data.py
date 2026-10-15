import unittest
from menu_reference import load_menu_reference


class ProvidedReferenceTests(unittest.TestCase):
    def test_transcribed_values_match_the_six_columns_in_the_provided_document(self):
        # Human-checked table rows in Proposal.pdf. Fat values wrap across lines.
        expected = {
            'Pad Kaprao': (846.81, 78.23, 4.46, 36.28, 43.19, 7.12),
            'PadSeeEw': (431.35, 45.91, 4.35, 20.38, 18.47, 2.47),
            'Fried rice': (473.94, 64.63, 6.25, 37.46, 7.29, 2.34),
            'Khao Tom Moo': (332.84, 50.65, 0.32, 11.72, 9.26, 0.91),
            'Boiled rice fish': (426.79, 45.03, 2.15, 20.10, 18.47, 0.51),
            'NoodleSoup': (329, 38.09, 9.12, 13.10, 14.06, 1.25),
            'Tom Kha Gai': (176.91, 5.64, 0.61, 30.96, 3.39, 1.89),
        }
        keys = ('calories', 'carbs', 'sugar', 'protein', 'fat', 'fiber')
        for menu, values in expected.items():
            with self.subTest(menu=menu):
                row = load_menu_reference(menu)
                self.assertEqual(tuple(row['nutrition'][key] for key in keys), values)
                self.assertIsNone(row['nutrition']['sodium'])
                self.assertIsNone(row['nutrition']['saturatedFat'])
                self.assertIn('Proposal.pdf', row['source'])
                self.assertTrue(row['sourceUrl'].startswith('https://'))

    def test_both_omelet_recipes_require_explicit_selection(self):
        row = load_menu_reference('Omelet')
        self.assertTrue(all(value is None for value in row['nutrition'].values()))
        variants = {variant['id']: variant for variant in row['nutritionVariants']}
        self.assertEqual(variants['duck-egg']['nutrition']['calories'], 305.38)
        self.assertEqual(variants['duck-egg']['nutrition']['fat'], 28.76)
        self.assertEqual(variants['chicken-egg']['nutrition']['calories'], 264.77)
        self.assertEqual(variants['chicken-egg']['nutrition']['fat'], 22.33)
        self.assertIn('89', variants['duck-egg']['source'])
        self.assertIn('51', variants['chicken-egg']['source'])

    def test_unprovided_menus_remain_unknown_and_noodle_source_is_not_misattributed(self):
        self.assertTrue(all(value is None for value in load_menu_reference('Fried Egg')['nutrition'].values()))
        self.assertIsNone(load_menu_reference('Rice')['source'])
        self.assertIn('เมนู 7 วันสำหรับผู้สูงอายุ', load_menu_reference('NoodleSoup')['source'])
        self.assertIn('nutrition2.anamai.moph.go.th', load_menu_reference('NoodleSoup')['sourceUrl'])
        self.assertEqual(load_menu_reference('Pad Kaprao')['menu'], 'ข้าวกะเพราหมูสับไข่ดาว')


if __name__ == '__main__':
    unittest.main()
