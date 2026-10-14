import { ReactNode, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Href, useRouter } from 'expo-router';

export const palette = { green: '#216440', ink: '#202824', muted: '#818982', line: '#E4E8E5', soft: '#EAF5EC', blue: '#0799D1', orange: '#E95B00', gold: '#BA9956' };
const iconNames = {
  person: ['person', 'person'], people: ['person.2.fill', 'group'], caregiver: ['person.fill', 'person'],
  camera: ['camera.fill', 'photo_camera'], grid: ['square.grid.3x3', 'grid_view'], settings: ['gearshape', 'settings'],
  phone: ['phone.fill', 'call'], heart: ['heart', 'favorite'], bell: ['bell', 'notifications'],
  water: ['drop', 'water_drop'], sun: ['sun.max', 'light_mode'], moon: ['moon', 'dark_mode'], breakfast: ['sunrise', 'wb_twilight'],
  chevron: ['chevron.right', 'chevron_right'], plus: ['plus', 'add'], check: ['checkmark', 'check'],
  edit: ['pencil', 'edit'], target: ['target', 'adjust'], food: ['fork.knife', 'restaurant'],
  shield: ['checkmark.shield', 'verified_user'], logout: ['rectangle.portrait.and.arrow.right', 'logout'],
  help: ['questionmark.circle', 'help'], eye: ['eye', 'visibility'], eyeOff: ['eye.slash', 'visibility_off'], back: ['chevron.left', 'chevron_left'],
} as const;
export type IconName = keyof typeof iconNames;
export function Icon({ name, size = 22, color = palette.green }: { name: IconName; size?: number; color?: string }) {
  const [ios, android] = iconNames[name];
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: size, height: size }}><SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} /></View>;
}
export function Screen({ children, bottom, auth = false, dense = false }: { children: ReactNode; bottom?: ReactNode; auth?: boolean; dense?: boolean }) {
  return <View style={ui.outer}><SafeAreaView style={ui.screen}>
    <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={ui.flex} contentContainerStyle={[ui.content, dense && { gap: 14, paddingTop: 22, paddingBottom: 16 }, auth && ui.authContent]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {bottom}
    </KeyboardAvoidingView>
  </SafeAreaView></View>;
}
export function Logo({ small = false, large = false }: { small?: boolean; large?: boolean }) {
  return <View style={[ui.logo, large && { width: 204, height: 138, borderRadius: 34 }, small && ui.smallLogo]}><Text style={[ui.logoText, large && { fontSize: 28 }, small && { fontSize: 21 }]}>LOGO</Text></View>;
}
export function Button({ title, onPress, disabled, loading, icon }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; icon?: IconName }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={[ui.button, (disabled || loading) && { opacity: 0.55 }]}>
    {loading ? <ActivityIndicator color="#FFF" /> : <>{icon && <Icon name={icon} color="#FFF" size={20} />}<Text style={ui.buttonText}>{title}</Text></>}
  </TouchableOpacity>;
}
export function Field({ label, password = false, ...props }: TextInputProps & { label: string; password?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <View style={ui.field}><Text style={ui.label}>{label}</Text><View style={ui.inputWrap}>
    <TextInput accessibilityLabel={label} placeholderTextColor="#969DA4" {...props} secureTextEntry={password && !visible} style={[ui.input, props.style]} />
    {password && <TouchableOpacity accessibilityLabel={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onPress={() => setVisible(!visible)} style={ui.eye}><Icon name={visible ? 'eyeOff' : 'eye'} size={20} color="#A1A8AC" /></TouchableOpacity>}
  </View></View>;
}
export function Card({ children, compact = false }: { children: ReactNode; compact?: boolean }) { return <View style={[ui.card, compact && { gap: 6, padding: 14 }]}>{children}</View>; }
export function Progress({ value, color = palette.green }: { value: number; color?: string }) {
  return <View style={[ui.progress, { backgroundColor: color === palette.orange ? '#FFF2DF' : color === palette.blue ? '#E2F6FD' : '#E8F4EA' }]}><View style={{ height: '100%', width: `${Math.max(0, Math.min(100, value || 0))}%`, backgroundColor: color, borderRadius: 8 }} /></View>;
}
export function BottomNav({ active, caregiver = false }: { active: 'home' | 'food' | 'dashboard' | 'settings'; caregiver?: boolean }) {
  const router = useRouter();
  const items: { key: typeof active; title: string; icon: IconName; href: Href }[] = caregiver ? [
    { key: 'home', title: 'รายชื่อ', icon: 'people', href: '/caregiver-home' }, { key: 'settings', title: 'ตั้งค่า', icon: 'settings', href: '/settings' },
  ] : [
    { key: 'home', title: 'หน้าแรก', icon: 'person', href: '/elderly-home' },
    { key: 'food', title: 'บันทึกอาหาร', icon: 'camera', href: '/food-log' },
    { key: 'dashboard', title: 'แดชบอร์ด', icon: 'grid', href: '/dashboard' },
    { key: 'settings', title: 'ตั้งค่า', icon: 'settings', href: '/settings' },
  ];
  return <View style={ui.nav}>{items.map((item) => <TouchableOpacity key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active === item.key }} aria-selected={active === item.key} onPress={() => active !== item.key && router.replace(item.href)} style={ui.navItem}>
    <Icon name={item.icon} size={22} color={active === item.key ? palette.green : '#7E8790'} /><Text style={[ui.navText, active === item.key && { color: palette.green, fontWeight: '600' }]}>{item.title}</Text>
  </TouchableOpacity>)}</View>;
}
export function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={ui.field}><Text style={ui.label}>{label}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[ui.inputWrap, ui.select]}><Text style={[ui.body, !value && { color: '#969DA4' }]}>{value || 'กรุณาเลือก'}</Text><Text style={{ color: palette.ink }}>⌄</Text></TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={ui.modalOverlay}><View style={ui.modal}>
      <Text style={ui.section}>{label}</Text>{options.map((option) => <TouchableOpacity key={option} onPress={() => { onChange(option); setOpen(false); }} style={ui.option}><Text style={ui.body}>{option}</Text>{value === option && <Icon name="check" size={18} />}</TouchableOpacity>)}
      <TouchableOpacity onPress={() => setOpen(false)} style={ui.option}><Text style={ui.link}>ยกเลิก</Text></TouchableOpacity>
    </View></View></Modal>
  </View>;
}
export function Message({ text }: { text: string }) { return text ? <Text accessibilityRole="alert" style={ui.message}>{text}</Text> : null; }
export const ui = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F0F3F1' }, screen: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: '#FFF' }, flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 24, gap: 18 }, authContent: { flexGrow: 1, paddingHorizontal: 30, paddingTop: 52, gap: 0 },
  logo: { width: 160, height: 110, borderRadius: 28, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20, boxShadow: '0px 4px 8px rgba(18, 65, 38, 0.12)' },
  smallLogo: { width: 82, height: 88, borderRadius: 25, marginBottom: 0 }, logoText: { color: '#FFF', fontSize: 26, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: palette.ink }, authTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: palette.ink },
  subtitle: { fontSize: 13, lineHeight: 21, color: palette.muted }, authSubtitle: { textAlign: 'center', fontSize: 14, color: palette.muted, marginTop: 4 },
  section: { fontSize: 17, fontWeight: '700', color: palette.ink }, body: { fontSize: 14, color: palette.ink }, link: { color: palette.green, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  form: { marginTop: 34 }, field: { marginBottom: 18 }, label: { fontSize: 14, fontWeight: '500', color: palette.ink, marginBottom: 8 },
  inputWrap: { minHeight: 46, borderWidth: 1, borderColor: '#D9DEE2', borderRadius: 8, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: palette.ink, minWidth: 0 }, eye: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  select: { justifyContent: 'space-between', paddingHorizontal: 14 }, button: { minHeight: 50, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: palette.green, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, boxShadow: '0px 3px 7px rgba(18, 65, 38, 0.12)' },
  buttonText: { fontSize: 15, color: '#FFF', fontWeight: '700' }, spacer: { flex: 1, minHeight: 42 }, footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 34, marginBottom: 4 },
  card: { borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 17, backgroundColor: '#FFF', gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progress: { height: 10, borderRadius: 8, overflow: 'hidden' }, nav: { borderTopWidth: 1, borderColor: '#EEF1EF', backgroundColor: '#FFF', flexDirection: 'row', paddingTop: 10, paddingBottom: 9 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 48 }, navText: { fontSize: 10, color: '#7E8790' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DADCDD', alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#D5F0FD', paddingHorizontal: 9, paddingVertical: 3 }, badgeText: { fontSize: 10, color: '#468FB1' },
  tintHeading: { backgroundColor: palette.soft, borderRadius: 9, padding: 12 }, message: { fontSize: 13, color: '#A43D30', lineHeight: 22, marginVertical: 10 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: 24 }, modal: { width: '100%', maxWidth: 390, alignSelf: 'center', padding: 24, borderRadius: 18, backgroundColor: '#FFF', gap: 16 },
  option: { minHeight: 44, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: palette.line },
});
