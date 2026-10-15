export const NUTRIENTS = [
  { key: 'calories', label: 'พลังงาน', unit: 'กิโลแคลอรี่' },
  { key: 'carbs', label: 'คาร์โบไฮเดรต', unit: 'กรัม' },
  { key: 'sugar', label: 'น้ำตาล', unit: 'กรัม' },
  { key: 'protein', label: 'โปรตีน', unit: 'กรัม' },
  { key: 'fat', label: 'ไขมัน', unit: 'กรัม' },
  { key: 'saturatedFat', label: 'ไขมันอิ่มตัว', unit: 'กรัม' },
  { key: 'sodium', label: 'โซเดียม', unit: 'มิลลิกรัม' },
  { key: 'fiber', label: 'ใยอาหาร', unit: 'กรัม' },
] as const;
export const DISPLAY_NUTRIENTS = NUTRIENTS.filter(
  ({ key }) => key !== 'saturatedFat' && key !== 'sodium',
);
export const PLATE_NUTRIENTS = DISPLAY_NUTRIENTS.filter(({ key }) => key !== 'calories');
export const DAILY_NUTRIENT_TARGETS = { protein: 60, fiber: 25 };
// ปิดส่วนหมู่อาหารชั่วคราว ทั้งการแนะนำ หน้าจอ และการติดตามหลายวัน
export const ENABLE_FOOD_GROUP_TRACKING = false;
export const FOOD_GROUPS = [
  { key: 'starch', label: 'ข้าว / แป้ง' },
  { key: 'protein', label: 'เนื้อสัตว์ / ไข่ / นม / ถั่ว' },
  { key: 'vegetables', label: 'ผัก' },
  { key: 'fruit', label: 'ผลไม้' },
  { key: 'fat', label: 'น้ำมัน / ไขมัน' },
] as const;
export type FoodGroup = (typeof FOOD_GROUPS)[number]['key'];
export type NutrientKey = (typeof NUTRIENTS)[number]['key'];
export type Nutrition = Record<NutrientKey, number | null>;
export type NutritionVariant = {
  id: string;
  label: string;
  nutrition: Nutrition;
  servingLabel?: string;
  source: string;
  sourceUrl?: string | null;
};
export type Portion = {
  className: string;
  grams?: number;
  area?: number;
  relativeArea?: number | null;
};
export type DetectedFood = {
  className: string;
  label: string;
  confidence: number;
};
export type Analysis = {
  menu: string;
  nutrition: Nutrition;
  portions?: Portion[];
  calibrated?: boolean;
  comparisonReady?: boolean;
  scaleReference?: string;
  nutritionBasis?: 'fixed-serving' | 'area-only';
  servingLabel?: string;
  source?: string | null;
  sourceUrl?: string | null;
  referenceClass?: string;
  candidates?: MenuCandidate[];
  detectedFoods?: DetectedFood[];
  needsMenuConfirmation?: boolean;
  detectedMenu?: string;
  foodGroups?: FoodGroup[];
  foodGroupsConfirmed?: boolean;
  emptyCandidate?: boolean;
  nutritionVariants?: NutritionVariant[];
  nutritionVariantId?: string;
};
export type MenuCandidate = Omit<Analysis, 'candidates'> & { confidence: number };

// ค่าที่ไม่มีข้อมูลต้องเป็น null เพื่อไม่แสดงเป็นสารอาหาร 0 กรัม
function readNutrition(source: Record<string, unknown>): Nutrition {
  const nutrition = {} as Nutrition;
  for (const { key } of NUTRIENTS) {
    const value = source[key];
    const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
    nutrition[key] = valid ? value : null;
  }
  return nutrition;
}

function readPortions(value: unknown): Portion[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  for (const part of value) {
    if (!part || typeof part.className !== 'string' || part.className.length === 0) {
      return undefined;
    }
    const hasArea = typeof part.area === 'number' && Number.isFinite(part.area) && part.area > 0;
    const hasGrams =
      typeof part.grams === 'number' && Number.isFinite(part.grams) && part.grams > 0;
    if (!hasArea && !hasGrams) return undefined;
  }
  return value as Portion[];
}

// เช่น ไข่เจียวไข่ไก่และไข่เป็ด แต่ละสูตรต้องมีแหล่งอ้างอิงของตัวเอง
function readNutritionVariants(value: unknown): NutritionVariant[] {
  if (!Array.isArray(value)) return [];
  const variants: NutritionVariant[] = [];
  for (const variant of value) {
    if (!variant || typeof variant.id !== 'string' || typeof variant.label !== 'string') continue;
    if (typeof variant.source !== 'string' || !variant.source.trim()) continue;
    if (!variant.nutrition || typeof variant.nutrition !== 'object') continue;
    variants.push({
      id: variant.id,
      label: variant.label,
      source: variant.source,
      nutrition: readNutrition(variant.nutrition),
      servingLabel: typeof variant.servingLabel === 'string' ? variant.servingLabel : undefined,
      sourceUrl: typeof variant.sourceUrl === 'string' ? variant.sourceUrl : null,
    });
  }
  return variants;
}

function readMenuCandidates(value: unknown): MenuCandidate[] {
  if (!Array.isArray(value)) return [];
  const candidates: MenuCandidate[] = [];
  for (const candidate of value.slice(0, 3)) {
    if (!candidate || typeof candidate.confidence !== 'number') continue;
    if (
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    )
      continue;
    try {
      const analysis = parseAnalysis({ ...candidate, candidates: undefined });
      candidates.push({ ...analysis, confidence: candidate.confidence });
    } catch {
      // ข้ามเมนูที่ข้อมูลไม่ครบ แต่ยังให้ผู้ใช้เลือกเมนูอื่นที่ถูกต้องได้
    }
  }
  return candidates;
}

function readDetectedFoods(value: unknown): DetectedFood[] {
  if (!Array.isArray(value)) return [];
  const foods: DetectedFood[] = [];
  for (const food of value) {
    if (!food || typeof food.className !== 'string' || !food.className.trim()) continue;
    if (typeof food.label !== 'string' || !food.label.trim()) continue;
    if (typeof food.confidence !== 'number' || !Number.isFinite(food.confidence)) continue;
    if (food.confidence < 0 || food.confidence > 1) continue;
    if (foods.some((item) => item.className === food.className)) continue;
    foods.push({ className: food.className, label: food.label, confidence: food.confidence });
  }
  return foods;
}

// ตรวจผลจากเซิร์ฟเวอร์และมื้อที่อ่านจากเครื่อง ก่อนนำไปแสดงหรือคำนวณ
export function parseAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') {
    throw new Error('รูปแบบผลวิเคราะห์ไม่ถูกต้อง');
  }
  const data = value as Record<string, unknown>;
  if (
    typeof data.menu !== 'string' ||
    !data.menu.trim() ||
    !data.nutrition ||
    typeof data.nutrition !== 'object'
  ) {
    throw new Error('เซิร์ฟเวอร์ส่งข้อมูลเมนูหรือสารอาหารไม่ครบ กรุณาลองใหม่');
  }

  const nutrition = readNutrition(data.nutrition as Record<string, unknown>);
  const nutritionBasis =
    data.nutritionBasis === 'fixed-serving' || data.nutritionBasis === 'area-only'
      ? data.nutritionBasis
      : undefined;
  if (!nutritionBasis && NUTRIENTS.every(({ key }) => nutrition[key] === null)) {
    throw new Error('ยังไม่มีข้อมูลโภชนาการของเมนูนี้');
  }

  const result: Analysis = { menu: data.menu, nutrition };
  // ใช้เฉพาะหมู่อาหารที่ผู้ใช้ระบุ ไม่เดาจากชื่อเมนูของโมเดล
  if (
    Array.isArray(data.foodGroups) &&
    data.foodGroups.every((group) => FOOD_GROUPS.some((item) => item.key === group))
  ) {
    result.foodGroups = [...new Set(data.foodGroups)] as FoodGroup[];
    if (data.foodGroupsConfirmed === true && result.foodGroups.length > 0) {
      result.foodGroupsConfirmed = true;
    }
  }
  const detectedFoods = readDetectedFoods(data.detectedFoods);
  if (detectedFoods.length > 0) result.detectedFoods = detectedFoods;
  const variants = readNutritionVariants(data.nutritionVariants);
  if (variants.length > 0) {
    result.nutritionVariants = variants;
    const selectedVariant = variants.find((variant) => variant.id === data.nutritionVariantId);
    if (selectedVariant) result.nutritionVariantId = selectedVariant.id;
  }

  const candidates = readMenuCandidates(data.candidates);
  if (candidates.length > 0) result.candidates = candidates;
  if (nutritionBasis === 'area-only' && data.needsMenuConfirmation === true) {
    result.needsMenuConfirmation = true;
  }
  if (typeof data.detectedMenu === 'string') result.detectedMenu = data.detectedMenu;
  if (typeof data.sourceUrl === 'string') result.sourceUrl = data.sourceUrl;
  if (typeof data.scaleReference === 'string') result.scaleReference = data.scaleReference;
  if (data.emptyCandidate === true && nutritionBasis === 'area-only') result.emptyCandidate = true;
  if (nutritionBasis) {
    result.nutritionBasis = nutritionBasis;
    result.servingLabel = typeof data.servingLabel === 'string' ? data.servingLabel : undefined;
    result.source = typeof data.source === 'string' ? data.source : null;
    result.referenceClass =
      typeof data.referenceClass === 'string' ? data.referenceClass : undefined;
  }

  const portions = readPortions(data.portions);
  if (portions) {
    result.portions = portions;
    result.calibrated = data.calibrated === true;
    result.comparisonReady =
      data.comparisonReady === true &&
      portions.every(
        (part) =>
          typeof part.relativeArea === 'number' &&
          Number.isFinite(part.relativeArea) &&
          part.relativeArea > 0,
      );
  }
  return result;
}

export function estimateLeftover(before: Analysis, after: Analysis) {
  if (before.scaleReference !== after.scaleReference) {
    throw new Error(
      'วิธีเทียบขนาดของภาพก่อนและหลังกินไม่ตรงกัน กรุณาเลือกปรับเปอร์เซ็นต์เอง หรือเริ่มถ่ายมื้อใหม่',
    );
  }
  if (
    !before.comparisonReady ||
    !after.comparisonReady ||
    !before.portions?.length ||
    !after.portions?.length
  ) {
    throw new Error(
      'เปรียบเทียบปริมาณไม่ได้ ต้องเห็นช้อนอันเดิมชัดเจนทั้งก่อนและหลังกิน กรุณาถ่ายใหม่หรือเลือกปรับเอง',
    );
  }
  const initial = new Map(before.portions.map((part) => [part.className, part.relativeArea!]));
  if (after.portions.some((part) => !initial.has(part.className))) {
    throw new Error('เมนูหลังกินไม่ตรงกับก่อนกิน กรุณาตรวจสอบภาพแล้วถ่ายใหม่ หรือเลือกปรับเอง');
  }
  if (after.portions.some((part) => part.relativeArea! > initial.get(part.className)! * 1.1)) {
    throw new Error('ปริมาณหลังกินมากกว่าก่อนกิน กรุณาถ่ายด้วยมุมและช้อนอันเดิม หรือเลือกปรับเอง');
  }
  const total = before.portions.reduce((sum, part) => sum + part.relativeArea!, 0);
  const remaining = after.portions.reduce(
    (sum, part) => sum + Math.min(part.relativeArea!, initial.get(part.className)!),
    0,
  );
  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
}

export function splitNutrition(nutrition: Nutrition, leftoverPercent: number) {
  const percent = Number.isFinite(leftoverPercent)
    ? Math.max(0, Math.min(100, leftoverPercent))
    : 100;
  const eaten = {} as Nutrition;
  const remaining = {} as Nutrition;
  for (const { key } of NUTRIENTS) {
    const value = nutrition[key];
    remaining[key] = value === null ? null : (value * percent) / 100;
    eaten[key] = value === null ? null : (value * (100 - percent)) / 100;
  }
  return { eaten, remaining };
}

export function formatNutrient(value: number | null) {
  return value === null
    ? 'ไม่มีข้อมูล'
    : value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
