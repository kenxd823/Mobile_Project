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
export const DISPLAY_NUTRIENTS = NUTRIENTS.filter(({ key }) => key !== 'saturatedFat' && key !== 'sodium');
export const PLATE_NUTRIENTS = DISPLAY_NUTRIENTS.filter(({ key }) => key !== 'calories');
export type NutrientKey = typeof NUTRIENTS[number]['key'];
export type Nutrition = Record<NutrientKey, number | null>;
export type Portion = { className: string; grams?: number; area?: number; relativeArea?: number | null };
export type Analysis = { menu: string; nutrition: Nutrition; portions?: Portion[]; calibrated?: boolean; comparisonReady?: boolean; nutritionBasis?: 'fixed-serving' | 'area-only'; servingLabel?: string; source?: string | null; referenceClass?: string; candidates?: MenuCandidate[]; emptyCandidate?: boolean };
export type MenuCandidate = Omit<Analysis, 'candidates'> & { confidence: number };

export function parseAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') throw new Error('รูปแบบผลวิเคราะห์ไม่ถูกต้อง');
  const data = value as Record<string, unknown>;
  if (typeof data.menu !== 'string' || !data.menu.trim() || !data.nutrition || typeof data.nutrition !== 'object') {
    throw new Error('เซิร์ฟเวอร์ส่งข้อมูลเมนูหรือสารอาหารไม่ครบ กรุณาลองใหม่');
  }
  const source = data.nutrition as Record<string, unknown>;
  const nutrition = {} as Nutrition;
  for (const { key } of NUTRIENTS) {
    const n = source[key];
    nutrition[key] = typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
  }
  const nutritionBasis = data.nutritionBasis === 'fixed-serving' || data.nutritionBasis === 'area-only' ? data.nutritionBasis : undefined;
  if (!nutritionBasis && NUTRIENTS.every(({ key }) => nutrition[key] === null)) throw new Error('ยังไม่มีข้อมูลโภชนาการของเมนูนี้');
  const portions = Array.isArray(data.portions) && data.portions.length > 0 && data.portions.every((part) =>
    part && typeof part.className === 'string' && part.className.length > 0 &&
    ((typeof part.area === 'number' && Number.isFinite(part.area) && part.area > 0) || (typeof part.grams === 'number' && Number.isFinite(part.grams) && part.grams > 0)))
    ? data.portions as Portion[] : undefined;
  const comparisonReady = data.comparisonReady === true && !!portions && portions.every((part) => typeof part.relativeArea === 'number' && Number.isFinite(part.relativeArea) && part.relativeArea > 0);
  const candidates: MenuCandidate[] = Array.isArray(data.candidates) ? data.candidates.slice(0, 3).flatMap((candidate) => {
    if (!candidate || typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) return [];
    try { return [{ ...parseAnalysis({ ...candidate, candidates: undefined }), confidence: candidate.confidence }]; } catch { return []; }
  }) : [];
  return { menu: data.menu, nutrition,
    ...(candidates.length ? { candidates } : {}), ...(data.emptyCandidate === true && nutritionBasis === 'area-only' ? { emptyCandidate: true } : {}),
    ...(nutritionBasis ? { nutritionBasis, servingLabel: typeof data.servingLabel === 'string' ? data.servingLabel : undefined, source: typeof data.source === 'string' ? data.source : null, referenceClass: typeof data.referenceClass === 'string' ? data.referenceClass : undefined } : {}),
    ...(portions ? { portions, calibrated: data.calibrated === true, comparisonReady } : {}) };
}

export function estimateLeftover(before: Analysis, after: Analysis) {
  if (!before.comparisonReady || !after.comparisonReady || !before.portions?.length || !after.portions?.length) {
    throw new Error('เปรียบเทียบปริมาณไม่ได้ ต้องเห็นช้อนอันเดิมชัดเจนทั้งก่อนและหลังกิน กรุณาถ่ายใหม่หรือเลือกปรับเอง');
  }
  const initial = new Map(before.portions.map((part) => [part.className, part.relativeArea!]));
  if (after.portions.some((part) => !initial.has(part.className))) {
    throw new Error('เมนูหลังกินไม่ตรงกับก่อนกิน กรุณาตรวจสอบภาพแล้วถ่ายใหม่ หรือเลือกปรับเอง');
  }
  if (after.portions.some((part) => part.relativeArea! > initial.get(part.className)! * 1.1)) {
    throw new Error('ปริมาณหลังกินมากกว่าก่อนกิน กรุณาถ่ายด้วยมุมและช้อนอันเดิม หรือเลือกปรับเอง');
  }
  const total = before.portions.reduce((sum, part) => sum + part.relativeArea!, 0);
  const remaining = after.portions.reduce((sum, part) => sum + Math.min(part.relativeArea!, initial.get(part.className)!), 0);
  return Math.max(0, Math.min(100, Math.round(remaining / total * 100)));
}

export function splitNutrition(nutrition: Nutrition, leftoverPercent: number) {
  const percent = Number.isFinite(leftoverPercent) ? Math.max(0, Math.min(100, leftoverPercent)) : 100;
  const eaten = {} as Nutrition;
  const remaining = {} as Nutrition;
  for (const { key } of NUTRIENTS) {
    const value = nutrition[key];
    remaining[key] = value === null ? null : value * percent / 100;
    eaten[key] = value === null ? null : value * (100 - percent) / 100;
  }
  return { eaten, remaining };
}

export function formatNutrient(value: number | null) {
  return value === null ? 'ไม่มีข้อมูล' : value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
