"""Fixed nutrients per serving, supplied from a cited reference, never image area."""
import json
import math
from pathlib import Path
from nutrition import NUTRIENT_COLUMNS

REFERENCE_PATH = Path(__file__).resolve().parent / 'menu_nutrition.json'


def load_menu_reference(class_name):
    catalog = json.loads(REFERENCE_PATH.read_text(encoding='utf-8'))
    row = catalog.get(class_name, {})
    source = row.get('source')
    # Values are usable only with an explicit reference description.
    source = source.strip() if isinstance(source, str) and source.strip() else None
    nutrition = {}
    for key in NUTRIENT_COLUMNS:
        value = row.get('nutrition', {}).get(key)
        nutrition[key] = float(value) if source and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None
    return {
        'menu': row.get('menu', class_name),
        'nutrition': nutrition,
        'nutritionBasis': 'fixed-serving',
        'servingLabel': row.get('servingLabel', '1 จาน'),
        'source': source,
        'sourceUrl': row.get('sourceUrl') if source else None,
        'referenceClass': class_name,
    }
