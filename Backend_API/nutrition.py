"""Database values are per gram of food; sodium is mg per gram of food."""
import math

NUTRIENT_COLUMNS = {
    'calories': 'kcal_per_gram',
    'carbs': 'carb_per_gram',
    'sugar': 'sugar_per_gram',
    'protein': 'protein_per_gram',
    'fat': 'fat_per_gram',
    'saturatedFat': 'saturated_fat_per_gram',
    'sodium': 'sodium_mg_per_gram',
    'fiber': 'fiber_per_gram',
}


def aggregate_nutrition(portions):
    totals = {key: 0.0 for key in NUTRIENT_COLUMNS}
    for row, weight in portions:
        if not math.isfinite(weight) or weight <= 0:
            raise ValueError('Invalid portion weight')
        for key, column in NUTRIENT_COLUMNS.items():
            value = row.get(column)
            try:
                value = float(value)
            except (TypeError, ValueError):
                value = None
            if value is None or not math.isfinite(value) or value < 0:
                totals[key] = None
            elif totals[key] is not None:
                totals[key] += weight * value
    return {key: round(value, 2) if value is not None else None for key, value in totals.items()}
