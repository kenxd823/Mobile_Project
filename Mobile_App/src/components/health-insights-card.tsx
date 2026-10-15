import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card, palette, ui } from '@/components/design-system';
import type { CompletedMeal } from '@/services/meal-storage';
import { getHealthInsights } from '@/utils/health-insights';
import { ENABLE_FOOD_GROUP_TRACKING } from '@/utils/nutrition';

export default function HealthInsightsCard({
  history,
  goal,
}: {
  history: CompletedMeal[];
  goal: number;
}) {
  const [showRules, setShowRules] = useState(false);
  const result = getHealthInsights(history, goal);
  return (
    <Card>
      <Text style={ui.section}>สิ่งที่ควรติดตามจากประวัติอาหาร</Text>
      <Text style={ui.subtitle}>ดูแนวโน้มจากข้อมูลที่บันทึก ไม่ใช่การวินิจฉัยภาวะขาดสารอาหาร</Text>
      {result.alerts.map((alert) => (
        <View
          key={alert.id}
          style={{
            gap: 8,
            padding: 14,
            borderRadius: 12,
            backgroundColor: alert.level === 'attention' ? '#FFF3E4' : '#EFF6F1',
          }}
        >
          <Text style={[ui.body, { fontWeight: '700' }]}>{alert.title}</Text>
          <Text style={ui.body}>{alert.detail}</Text>
          <Text style={ui.subtitle}>{alert.suggestion}</Text>
        </View>
      ))}
      {!result.alerts.length && (
        <Text style={ui.body}>
          {result.canCheckTrend
            ? 'ยังไม่พบรูปแบบที่เข้าเกณฑ์ติดตามของแอป'
            : 'ข้อมูลยังไม่พอประเมินแนวโน้มหลายวัน บันทึกก่อนและหลังกินอย่างต่อเนื่อง'}
        </Text>
      )}
      <Text style={ui.subtitle}>
        7 วันก่อนวันนี้: มีบันทึกอย่างน้อย 3 มื้อ {result.daysWithEnoughMeals}/7 วัน
        {ENABLE_FOOD_GROUP_TRACKING && ` · ยืนยันหมู่อาหารทุกมื้อ ${result.daysWithConfirmedGroups}/7 วัน`}
      </Text>
      {result.unknownNutrientMeals > 0 && (
        <Text style={ui.subtitle}>
          {result.unknownNutrientMeals} มื้อมีข้อมูลสารอาหารไม่ครบ จะไม่แทนค่าที่ไม่ทราบด้วยศูนย์
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setShowRules(!showRules)}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: palette.green, fontWeight: '600' }}>
          {showRules ? 'ซ่อนเกณฑ์ติดตาม' : 'ดูเกณฑ์ที่ใช้ติดตาม'}
        </Text>
      </TouchableOpacity>
      {showRules && (
        <Text style={ui.subtitle}>
          เมนูซ้ำ: กลุ่มเดิมอย่างน้อย 6 มื้อในอย่างน้อย 3 วัน และคิดเป็นอย่างน้อย 60%
          ของมื้อที่กินในช่วง 7 วัน
          {'\n'}แนวโน้ม: ต้องมีอย่างน้อย 3 มื้อต่อวันใน 3 วันล่าสุดที่ผ่านไปแล้ว
          สารอาหารต่ำกว่าเป้าทั้ง 3 วัน หรือการกินลดลงทุกวัน รวมอย่างน้อย 20 จุดเปอร์เซ็นต์ต่อจาน
          หรือพลังงานลดอย่างน้อย 20%
          {ENABLE_FOOD_GROUP_TRACKING && '\nหมู่อาหาร: ต้องยืนยันทุกมื้อและมีอย่างน้อย 3 มื้อต่อวันครบ 7 วัน คำแนะนำจากเมนูยังต้องให้ผู้ใช้ตรวจและยืนยัน'}
          {'\n'}ไม่รวมวันนี้ เพราะอาจยังบันทึกไม่ครบ และจำนวน 3
          มื้อก็ไม่ได้ยืนยันว่าไม่มีอาหารอื่นนอกบันทึก
          {'\n'}เกณฑ์ 3/7 วันเป็นกติกาติดตามของโปรเจกต์ ไม่ใช่เกณฑ์วินิจฉัยทางการแพทย์
          เป้าโปรตีน/ใยอาหารเป็นค่าตั้งต้นของแอป
        </Text>
      )}
    </Card>
  );
}
