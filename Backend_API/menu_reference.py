"""Fixed nutrients per serving, supplied from a cited reference, never image area."""
import json
import math
from pathlib import Path
from nutrition import NUTRIENT_COLUMNS

REFERENCE_PATH = Path(__file__).resolve().parent / 'menu_nutrition.json'


def load_menu_label(class_name):
    """อ่านเฉพาะชื่อแสดงผล ไม่ใช้ค่าโภชนาการใหม่กับภาพหลังกิน"""
    catalog = json.loads(REFERENCE_PATH.read_text(encoding='utf-8'))
    return catalog.get(class_name, {}).get('menu', class_name)


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
    variants = []
    for variant in row.get('nutritionVariants', []):
        variant_source = variant.get('source')
        if not isinstance(variant_source, str) or not variant_source.strip():
            continue
        values = {}
        for key in NUTRIENT_COLUMNS:
            value = variant.get('nutrition', {}).get(key)
            values[key] = float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None
        variants.append({'id': variant['id'], 'label': variant['label'], 'nutrition': values,
                         'source': variant_source.strip(), 'sourceUrl': variant.get('sourceUrl'),
                         'servingLabel': variant.get('servingLabel', '1 ที่ตามสูตรอ้างอิง')})
    return {
        'menu': row.get('menu', class_name),
        'nutrition': nutrition,
        'nutritionBasis': 'fixed-serving',
        'servingLabel': row.get('servingLabel', '1 จาน'),
        'source': source,
        'sourceUrl': row.get('sourceUrl') if source else None,
        'referenceClass': class_name,
        **({'nutritionVariants': variants} if variants else {}),
    }
