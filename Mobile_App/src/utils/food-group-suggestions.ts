import { Analysis, FOOD_GROUPS, FoodGroup } from '@/utils/nutrition';

// ส่วนประกอบทั่วไปตามชื่อเมนู ไม่ใช่ผลตรวจส่วนผสมจากภาพ
// ผู้ใช้ต้องแก้/ยืนยันก่อนนำไปติดตามหมู่อาหารหลายวัน
const MENU_GROUPS: Record<string, FoodGroup[]> = {
  'Boiled rice fish': ['starch', 'protein'],
  'Fak Thong Pad Khai': ['protein', 'vegetables', 'fat'],
  'Fried Egg': ['protein', 'fat'],
  'Fried rice': ['starch', 'protein', 'vegetables', 'fat'],
  'Kaeng Chuet Phak Kat Khao': ['vegetables'],
  'Kaeng Chuet Tamlueng Mu Sap': ['protein', 'vegetables'],
  'Kaeng Chuet Tao Hu Mu Sap': ['protein'],
  'Kaeng Lieng': ['vegetables'],
  'Kai Tun Fak': ['protein', 'vegetables'],
  'Khao Tom Moo': ['starch', 'protein'],
  NoodleSoup: ['starch'],
  Omelet: ['protein', 'fat'],
  'Pad Buab Sai Khai': ['protein', 'vegetables', 'fat'],
  'Pad Ka-lam-plee Sai Moo': ['protein', 'vegetables', 'fat'],
  'Pad Kaprao': ['starch', 'protein', 'vegetables', 'fat'],
  PadPhakKatKhao: ['vegetables', 'fat'],
  PadPreawWan: ['vegetables', 'fat'],
  PadSeeEw: ['starch', 'protein', 'vegetables', 'fat'],
  'Pla Nueng Ma-nao': ['protein'],
  'Pla nueng si-io': ['protein'],
  PlaPadKhuenChai: ['protein', 'vegetables', 'fat'],
  Rice: ['starch'],
  'Sukiyaki Soup': ['vegetables'],
  TangGwaPadKai: ['protein', 'vegetables', 'fat'],
  'Tao Hu Song Khrueang': ['protein'],
  'Tom Kha Gai': ['protein', 'fat'],
  TomJabChai: ['vegetables'],
  'Yam Khai Tom': ['protein'],
  'bitter melon pork soup': ['protein', 'vegetables'],
  'khai tom': ['protein'],
  'khai tun': ['protein'],
  tom_luad_moo: ['protein'],
};

export function suggestFoodGroups(analysis: Analysis): FoodGroup[] {
  const classes = new Set<string>();
  const mainClass = analysis.referenceClass ?? analysis.portions?.[0]?.className;
  if (mainClass) classes.add(mainClass);
  // ใช้รายการอาหารที่ตรวจพบ ไม่รวมทุกตัวเลือกเมนูที่อาจเป็นชื่อผิด
  for (const food of analysis.detectedFoods ?? []) {
    if (Number.isFinite(food.confidence) && food.confidence >= 0.25) classes.add(food.className);
  }

  const groups = new Set<FoodGroup>();
  for (const className of classes) {
    const known = Object.keys(MENU_GROUPS).find(
      (name) => name.toLowerCase() === className.toLowerCase(),
    );
    if (known) {
      for (const group of MENU_GROUPS[known]) groups.add(group);
    }
  }
  return FOOD_GROUPS.filter((group) => groups.has(group.key)).map((group) => group.key);
}
