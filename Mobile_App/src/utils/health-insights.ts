import type { CompletedMeal } from '@/services/meal-storage';
import { DAILY_NUTRIENT_TARGETS, ENABLE_FOOD_GROUP_TRACKING, FOOD_GROUPS, NutrientKey } from '@/utils/nutrition';

export type HealthInsight = {
  id: string;
  level: 'notice' | 'attention';
  title: string;
  detail: string;
  suggestion: string;
};

// เกณฑ์ติดตามสำหรับโปรเจกต์ ไม่ใช่เกณฑ์วินิจฉัยภาวะขาดสารอาหาร
const MIN_MEALS_PER_DAY = 3;
const TREND_DAYS = 3;
const GROUP_DAYS = 7;

function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sumNutrient(meals: CompletedMeal[], key: NutrientKey): number | null {
  if (!meals.length) return null;
  let total = 0;
  for (const meal of meals) {
    const value = meal.eaten?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    total += value;
  }
  return total;
}

function hasFoodGroups(meal: CompletedMeal) {
  return (
    meal.foodGroupsConfirmed === true &&
    !!meal.foodGroups?.length &&
    meal.foodGroups.every((group) => FOOD_GROUPS.some((item) => item.key === group))
  );
}

function averageEatenPercent(meals: CompletedMeal[]): number | null {
  if (!meals.length) return null;
  const valid = meals.every(
    (meal) =>
      Number.isFinite(meal.leftoverPercent) &&
      meal.leftoverPercent >= 0 &&
      meal.leftoverPercent <= 100,
  );
  if (!valid) return null;
  return meals.reduce((sum, meal) => sum + 100 - meal.leftoverPercent, 0) / meals.length;
}

function isDecreasing(values: (number | null)[], minimumDrop: number) {
  const [first, middle, last] = values;
  if (first === null || middle === null || last === null) return false;
  return first > middle && middle > last && first - last >= minimumDrop;
}

export function getHealthInsights(history: CompletedMeal[], energyGoal: number, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - GROUP_DAYS);
  const ids = new Set<string>();
  const recent = history.filter((meal) => {
    const date = new Date(meal.completedAt);
    if (date < start || date >= today || !Number.isFinite(date.getTime()) || ids.has(meal.id))
      return false;
    ids.add(meal.id);
    return true;
  });
  const days = Array.from({ length: GROUP_DAYS }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const meals = recent.filter((meal) => localDay(new Date(meal.completedAt)) === localDay(date));
    return {
      meals,
      enoughMeals: meals.length >= MIN_MEALS_PER_DAY,
      groupsConfirmed: meals.length >= MIN_MEALS_PER_DAY && meals.every(hasFoodGroups),
      calories: sumNutrient(meals, 'calories'),
      protein: sumNutrient(meals, 'protein'),
      fiber: sumNutrient(meals, 'fiber'),
      eatenPercent: averageEatenPercent(meals),
    };
  });
  const lastThree = days.slice(-TREND_DAYS);
  const canCheckTrend = lastThree.every((day) => day.enoughMeals);
  const alerts: HealthInsight[] = [];

  // 1. เมนูหลักซ้ำ: นับเฉพาะมื้อที่กินจริง ไม่นับมื้อที่เหลือ 100%
  const eatenMeals = recent.filter(
    (meal) =>
      Number.isFinite(meal.leftoverPercent) &&
      meal.leftoverPercent >= 0 &&
      meal.leftoverPercent < 100,
  );
  const menus = new Map<string, { name: string; count: number; dates: Set<string> }>();
  for (const meal of eatenMeals) {
    const key = meal.referenceClass || meal.menu.trim();
    const item = menus.get(key) ?? { name: meal.menu, count: 0, dates: new Set<string>() };
    item.count++;
    item.dates.add(localDay(new Date(meal.completedAt)));
    menus.set(key, item);
  }
  const mostRepeated = [...menus.values()].sort((a, b) => b.count - a.count)[0];
  if (
    mostRepeated &&
    mostRepeated.count >= 6 &&
    mostRepeated.dates.size >= 3 &&
    mostRepeated.count / eatenMeals.length >= 0.6
  ) {
    alerts.push({
      id: 'repeated-menu',
      level: 'notice',
      title: 'บันทึกเมนูหลักกลุ่มเดิมซ้ำบ่อย',
      detail: `${mostRepeated.name} รวมสูตรในกลุ่มเดียวกัน ${mostRepeated.count} จาก ${eatenMeals.length} มื้อ ใน 7 วันก่อนวันนี้`,
      suggestion:
        'ลองทบทวนความหลากหลายของอาหารร่วมกับผู้ดูแล การกินเมนูเดิมเพียงอย่างเดียวยังบอกไม่ได้ว่าได้รับสารอาหารไม่ครบ',
    });
  }

  // 2. ใช้เฉพาะวันที่มีจำนวนมื้อเพียงพอและสารอาหารของทุกมื้อเป็นค่าที่ทราบ
  if (canCheckTrend) {
    const targets = [
      {
        key: 'calories' as const,
        label: 'พลังงาน',
        target: energyGoal,
        unit: 'kcal',
        basis: 'เป้าพลังงานปัจจุบัน',
      },
      {
        key: 'protein' as const,
        label: 'โปรตีน',
        target: DAILY_NUTRIENT_TARGETS.protein,
        unit: 'กรัม',
        basis: 'เป้าหมายตั้งต้นของแอป',
      },
      {
        key: 'fiber' as const,
        label: 'ใยอาหาร',
        target: DAILY_NUTRIENT_TARGETS.fiber,
        unit: 'กรัม',
        basis: 'เป้าหมายตั้งต้นของแอป',
      },
    ];
    for (const { key, label, target, unit, basis } of targets) {
      const values = lastThree.map((day) => day[key]);
      if (
        !Number.isFinite(target) ||
        target <= 0 ||
        !values.every((value) => value !== null && value < target)
      )
        continue;
      alerts.push({
        id: `low-${key}`,
        level: 'attention',
        title: `${label}ที่บันทึกต่ำกว่าเป้า 3 วันต่อเนื่อง`,
        detail: `ยอดแต่ละวัน ${values.map((value) => Math.round(value!)).join(' → ')} ${unit} เทียบ${basis} ${target} ${unit}/วัน`,
        suggestion:
          'ตรวจว่าบันทึกอาหารครบทุกมื้อแล้วหรือยัง และปรึกษานักกำหนดอาหารเรื่องเป้าหมายที่เหมาะกับโรคประจำตัว ข้อความนี้ไม่ยืนยันภาวะขาดสารอาหาร',
      });
    }

    // 3. แนวโน้มลดลง: เปรียบเทียบสามวันเรียงเวลา ไม่เทียบวันนี้ที่ยังกินไม่ครบ
    const portions = lastThree.map((day) => day.eatenPercent);
    const energy = lastThree.map((day) => day.calories);
    const portionDecline = isDecreasing(portions, 20);
    const energyDecline =
      energy[0] !== null && energy[0] > 0 && isDecreasing(energy, energy[0] * 0.2);
    if (portionDecline || energyDecline) {
      const evidence = [];
      if (portionDecline)
        evidence.push(
          `สัดส่วนที่กินเฉลี่ยต่อจาน ${portions.map((value) => Math.round(value!)).join(' → ')}%`,
        );
      if (energyDecline)
        evidence.push(
          `พลังงานที่บันทึก ${energy.map((value) => Math.round(value!)).join(' → ')} kcal/วัน`,
        );
      alerts.push({
        id: 'declining-intake',
        level: 'attention',
        title: 'แนวโน้มการกินลดลง 3 วันต่อเนื่อง',
        detail: evidence.join(' · '),
        suggestion:
          'ตรวจความครบถ้วนของบันทึกและปริมาณต่อจาน หากเบื่ออาหาร อ่อนเพลีย หรือน้ำหนักลดโดยไม่ได้ตั้งใจ ควรปรึกษาแพทย์ สัดส่วนต่อจานไม่ใช่น้ำหนักอาหารจริง',
      });
    }
  }

  // 4. หมู่อาหาร: ต้องมีข้อมูลที่ผู้ใช้ยืนยันครบทั้งช่วง จึงบอกได้ว่าไม่พบในบันทึก
  const canCheckGroups = ENABLE_FOOD_GROUP_TRACKING && days.every((day) => day.groupsConfirmed);
  if (canCheckGroups) {
    const missing = FOOD_GROUPS.filter(
      (group) => !eatenMeals.some((meal) => meal.foodGroups?.includes(group.key)),
    );
    if (missing.length) {
      alerts.push({
        id: 'missing-food-groups',
        level: 'notice',
        title: 'บางหมู่อาหารยังไม่ปรากฏในบันทึก 7 วัน',
        detail: `ยังไม่พบการบันทึกกินกลุ่ม: ${missing.map((group) => group.label).join(', ')}`,
        suggestion:
          'ทบทวนหมู่อาหารที่เลือกและอาหารที่อาจยังไม่ได้บันทึกกับผู้ดูแล ข้อมูลนี้เป็นรายการอาหารที่รายงาน ไม่ยืนยันว่าขาดสารอาหารกลุ่มนั้น',
      });
    }
  }

  return {
    alerts,
    canCheckTrend,
    canCheckGroups,
    daysWithEnoughMeals: days.filter((day) => day.enoughMeals).length,
    daysWithConfirmedGroups: days.filter((day) => day.groupsConfirmed).length,
    unknownNutrientMeals: recent.filter((meal) =>
      ['calories', 'protein', 'fiber'].some((key) => {
        const value = meal.eaten?.[key as NutrientKey];
        return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
      }),
    ).length,
  };
}
