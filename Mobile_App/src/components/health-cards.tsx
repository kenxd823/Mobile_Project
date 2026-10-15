import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card, Icon, palette, Progress, ui } from './design-system';
import { Profile } from '@/services/profile-storage';
import { DAILY_NUTRIENT_TARGETS, Nutrition, formatNutrient } from '@/utils/nutrition';

export function Ring({
  percent,
  size = 104,
  children,
}: {
  percent: number;
  size?: number;
  children: React.ReactNode;
}) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#DFE4E5"
          strokeWidth={8}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.green}
          strokeWidth={8}
          strokeDasharray={[circumference, circumference]}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, percent)) / 100)}
          transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'}
        />
      </Svg>
      {children}
    </View>
  );
}
export function ProfileCard({
  profile,
}: {
  profile: Pick<Profile, 'firstName' | 'lastName' | 'phone' | 'gender'> | null;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderLeftWidth: 3,
        borderColor: palette.green,
        borderRadius: 16,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={ui.row}>
        <View style={ui.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={ui.body}>ชื่อ {profile?.firstName || 'ยังไม่ได้กรอก'}</Text>
          <Text style={ui.body}>นามสกุล {profile?.lastName || 'ยังไม่ได้กรอก'}</Text>
        </View>
      </View>
      <View style={ui.between}>
        <View style={[ui.row, { gap: 7 }]}>
          <Icon name="phone" size={16} color="#202824" />
          <Text style={ui.body}>{profile?.phone || 'ยังไม่มีเบอร์โทรศัพท์'}</Text>
        </View>
        {profile?.gender && (
          <View style={ui.badge}>
            <Text style={ui.badgeText}>{profile.gender}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
export function EnergyCard({ calories, goal }: { calories: number | null; goal: number }) {
  const percent = ((calories ?? 0) / goal) * 100;
  return (
    <Card>
      <View style={ui.tintHeading}>
        <Text style={{ color: '#327B3D', fontSize: 16, fontWeight: '700' }}>
          พลังงานที่ควรได้รับต่อวัน
        </Text>
      </View>
      <View style={[ui.row, { gap: 22 }]}>
        <Ring percent={percent}>
          <Icon name="heart" size={28} />
          <Text style={{ fontSize: 12, color: palette.green, marginTop: 3 }}>
            {calories === null ? '—' : `${Math.round(percent)}%`}
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[ui.body, { color: '#70797B' }]}>พลังงานที่ได้รับ</Text>
          <Text style={ui.body}>
            <Text style={{ fontWeight: '700', fontSize: 19 }}>{formatNutrient(calories)}</Text> /{' '}
            {goal.toLocaleString()} kcal
          </Text>
        </View>
      </View>
    </Card>
  );
}
export function NutrientCard({ totals, goal }: { totals: Nutrition; goal: number }) {
  const rows = [
    {
      label: 'โปรตีน (Protein)',
      value: totals.protein,
      target: DAILY_NUTRIENT_TARGETS.protein,
      text: formatNutrient(totals.protein) + `g / ${DAILY_NUTRIENT_TARGETS.protein}g`,
      color: '#2D8036',
    },
    {
      label: 'ไฟเบอร์ (Fiber)',
      value: totals.fiber,
      target: DAILY_NUTRIENT_TARGETS.fiber,
      text: formatNutrient(totals.fiber) + `g / ${DAILY_NUTRIENT_TARGETS.fiber}g`,
      color: palette.orange,
    },
    {
      label: 'พลังงาน (Energy)',
      value: totals.calories,
      target: goal,
      text: Math.round(((totals.calories ?? 0) / goal) * 100) + '%',
      color: '#2D8036',
    },
  ];
  return (
    <Card>
      <Text style={ui.section}>สารอาหารวันนี้</Text>
      {rows.map((row) => (
        <View key={row.label} style={{ gap: 7 }}>
          <View style={ui.between}>
            <Text style={[ui.body, { fontWeight: '600' }]}>{row.label}</Text>
            <Text style={{ fontSize: 12, color: palette.ink }}>{row.text}</Text>
          </View>
          <Progress color={row.color} value={((row.value ?? 0) / row.target) * 100} />
        </View>
      ))}
      <Text style={[ui.subtitle, { fontSize: 11 }]}>
        เป้าหมายโปรตีนและใยอาหารใช้ค่าตั้งต้นของแอป
      </Text>
    </Card>
  );
}
