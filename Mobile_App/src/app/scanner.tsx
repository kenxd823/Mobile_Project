import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeftoverSlider from '@/components/leftover-slider';
import EnergyBar from '@/components/energy-bar';
import { analyzeFood, checkFoodApiConnection } from '@/services/food-api';
import { finishMeal, getPendingMeal, PendingMeal, savePendingMeal } from '@/services/meal-storage';
import { ENABLE_TEST_PHOTO_LIBRARY, pickTestPhotoUri } from '@/services/test-photo-picker';
import { syncMealReminders } from '@/services/meal-reminders';
import {
  estimateLeftover,
  formatNutrient,
  MenuCandidate,
  NutritionVariant,
  PLATE_NUTRIENTS,
  splitNutrition,
} from '@/utils/nutrition';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [focused, setFocused] = useState(false);
  const [ready, setReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [capturingAfter, setCapturingAfter] = useState(false);
  const [afterMethod, setAfterMethod] = useState<'photo' | 'manual' | 'empty' | null>(null);
  const [menuConfirmed, setMenuConfirmed] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const [photoEstimate, setPhotoEstimate] = useState<number | null>(null);
  const [meal, setMeal] = useState<PendingMeal | null>(null);
  const [stage, setStage] = useState<'before' | 'after' | 'saved'>('before');
  const [leftover, setLeftover] = useState(100);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState('');
  const [picking, setPicking] = useState(false);
  const [gallerySelected, setGallerySelected] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const activePhotoUri = capturingAfter ? afterPhotoUri : photoUri;
  const canSave = canSaveCurrentMeal();
  const working = loading || checking || picking;

  // ก่อนกินต้องเลือกเมนู/สูตร หลังกินต้องมีภาพและวิธีระบุปริมาณที่เหลือ
  function canSaveCurrentMeal() {
    if (stage === 'before') {
      const menuSelected = !meal?.candidates?.length || menuConfirmed;
      const recipeSelected = !meal?.nutritionVariants?.length || !!meal.nutritionVariantId;
      return menuSelected && recipeSelected;
    }
    if (stage === 'saved') return true;
    if (!afterPhotoUri) return false;
    if (afterMethod === 'manual' || afterMethod === 'empty') return true;
    return afterMethod === 'photo' && photoEstimate !== null;
  }

  function captureButtonLabel() {
    if (capturingAfter) {
      if (activePhotoUri) return 'ใช้รูปนี้เป็นภาพหลังกิน';
      return ready ? 'ถ่ายและใช้ภาพหลังกิน' : 'กำลังเปิดกล้อง…';
    }
    if (activePhotoUri) {
      return gallerySelected ? 'วิเคราะห์รูปที่เลือก' : 'ลองส่งรูปอีกครั้ง';
    }
    return ready ? 'ถ่ายรูปและวิเคราะห์อาหาร' : 'กำลังเปิดกล้อง…';
  }

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setReady(false);
      return () => {
        setFocused(false);
        setReady(false);
      };
    }, []),
  );
  useEffect(() => {
    mounted.current = true;
    getPendingMeal()
      .then((pending) => {
        if (mounted.current && pending) {
          setMeal(pending);
          setStage('after');
        }
      })
      .catch(() => {
        if (mounted.current) setError('โหลดมื้ออาหารเดิมไม่ได้ กรุณาเปิดหน้านี้ใหม่');
      })
      .finally(() => {
        if (mounted.current) setRestoring(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleCapture = async () => {
    if (busy.current || (!activePhotoUri && (!ready || !cameraRef.current))) return;
    busy.current = true;
    setLoading(true);
    setError('');
    setConnection('');
    try {
      let uri = activePhotoUri;
      if (!uri) {
        try {
          const photo = await cameraRef.current!.takePictureAsync({ quality: 0.9 });
          if (!photo?.uri) throw new Error();
          uri = photo.uri;
          if (mounted.current) {
            if (capturingAfter) setAfterPhotoUri(uri);
            else setPhotoUri(uri);
          }
        } catch {
          throw new Error('ถ่ายภาพไม่สำเร็จ กรุณาตรวจสอบกล้องแล้วลองใหม่');
        }
      }
      if (capturingAfter) {
        if (mounted.current) {
          setCapturingAfter(false);
          setAfterMethod(null);
          setPhotoEstimate(null);
          setEmptyHint(false);
        }
        return;
      }
      const analysis = await analyzeFood(uri, { mode: 'before' });
      if (mounted.current) {
        setMeal({
          ...analysis,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          createdAt: new Date().toISOString(),
        });
        setMenuConfirmed(false);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'วิเคราะห์อาหารไม่สำเร็จ');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const analyzeAfterPhoto = async () => {
    if (!meal || !afterPhotoUri || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    setEmptyHint(false);
    // Clear previous results so a failed retry cannot save an obsolete estimate.
    setAfterMethod(null);
    setPhotoEstimate(null);
    try {
      const analysis = await analyzeFood(afterPhotoUri, {
        mode: 'after',
        menuClass: meal.referenceClass ?? meal.portions?.[0]?.className,
      });
      if (analysis.emptyCandidate) {
        if (mounted.current) setEmptyHint(true);
        return;
      }
      const percent = estimateLeftover(meal, analysis);
      if (mounted.current) {
        setLeftover(percent);
        setPhotoEstimate(percent);
        setAfterMethod('photo');
      }
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error ? err.message : 'วิเคราะห์อาหารที่เหลือไม่สำเร็จ เลือกปรับเองได้',
        );
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const chooseMenu = (candidate: MenuCandidate) => {
    if (!meal || working) return;
    setMeal({
      ...meal,
      ...candidate,
      nutritionVariants: candidate.nutritionVariants,
      nutritionVariantId: undefined,
      candidates: meal.candidates,
    });
    setMenuConfirmed(true);
    setError('');
  };
  const chooseNutritionVariant = (variant: NutritionVariant) => {
    if (!meal || working) return;
    setMeal({
      ...meal,
      menu: variant.label,
      nutrition: variant.nutrition,
      nutritionVariantId: variant.id,
      servingLabel: variant.servingLabel,
      source: variant.source,
      sourceUrl: variant.sourceUrl,
    });
    setError('');
  };

  // Temporary gallery entry point; analysis still runs through handleCapture.
  const handlePickLibrary = async () => {
    if (busy.current) return;
    busy.current = true;
    setPicking(true);
    try {
      const uri = await pickTestPhotoUri();
      if (mounted.current && uri) {
        if (capturingAfter) setAfterPhotoUri(uri);
        else setPhotoUri(uri);
        setGallerySelected(true);
        setError('');
        setConnection('');
      }
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : 'เปิดคลังภาพไม่ได้ กรุณาลองใหม่');
    } finally {
      busy.current = false;
      if (mounted.current) setPicking(false);
    }
  };

  const handleCheckConnection = async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setConnection('');
    try {
      await checkFoodApiConnection();
      if (mounted.current)
        setConnection(
          'แอปเชื่อมต่อเซิร์ฟเวอร์และฐานข้อมูลได้แล้ว ลองส่งรูปอีกครั้ง หากยังส่งไม่ได้ให้ถ่ายภาพใหม่',
        );
    } catch (err) {
      if (mounted.current)
        setConnection(err instanceof Error ? err.message : 'ทดสอบการเชื่อมต่อไม่สำเร็จ');
    } finally {
      busy.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  // บันทึกก่อนกินก่อนตั้งเตือน เพื่อให้มื้อไม่หายแม้มือถือไม่อนุญาตแจ้งเตือน
  const startMeal = async (currentMeal: PendingMeal) => {
    const startedMeal = { ...currentMeal, startedAt: new Date().toISOString() };
    await savePendingMeal(startedMeal);
    if (mounted.current) {
      setMeal(startedMeal);
      setStage('after');
    }
    try {
      const result = await syncMealReminders(true);
      if (!mounted.current) return;
      if (!result.supported) {
        setReminderMessage(
          'บันทึกมื้อแล้ว เว็บมีข้อความเตือนในแอป การแจ้งเตือนเมื่อปิดแอปใช้บนมือถือ',
        );
      } else if (!result.afterMeal) {
        setReminderMessage('การเตือนหลังกินปิดอยู่ เปิดได้ในตั้งค่า');
      } else if (result.allowed) {
        setReminderMessage('ตั้งเตือนถ่ายภาพหลังกินตามการตั้งค่าแล้ว');
      } else {
        setReminderMessage(
          'บันทึกมื้อแล้ว กรุณาอนุญาตแจ้งเตือนในตั้งค่ามือถือเพื่อรับการเตือนหลังกิน',
        );
      }
    } catch {
      if (mounted.current)
        setReminderMessage('บันทึกมื้อแล้ว แต่ตั้งแจ้งเตือนไม่สำเร็จ อย่าลืมกลับมาถ่ายภาพหลังกิน');
    }
  };

  // บันทึกหลังกินพร้อมสารอาหารที่กิน/เหลือ แล้วหยุดเตือนมื้อนี้
  const completeMeal = async (currentMeal: PendingMeal) => {
    await finishMeal(currentMeal, leftover, {
      afterPhotoRecordedAt: new Date().toISOString(),
      method: afterMethod ?? 'manual',
    });
    if (mounted.current) setStage('saved');
    try {
      await syncMealReminders();
      if (mounted.current) setReminderMessage('บันทึกครบแล้ว ยกเลิกการเตือนหลังกินของมื้อนี้แล้ว');
    } catch {
      if (mounted.current)
        setReminderMessage('บันทึกครบแล้ว แต่ปรับการแจ้งเตือนไม่สำเร็จ กรุณาเปิดแอปใหม่');
    }
  };

  const handleSave = async () => {
    if (!meal || busy.current || !canSave) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      if (stage === 'before') await startMeal(meal);
      else await completeMeal(meal);
    } catch {
      if (mounted.current) setError('บันทึกมื้ออาหารไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  const retake = () => {
    setReady(false);
    setError('');
    setConnection('');
    setGallerySelected(false);
    setReminderMessage('');
    if (capturingAfter) {
      setAfterPhotoUri(null);
      return;
    }
    setMeal(null);
    setPhotoUri(null);
    setAfterPhotoUri(null);
    setAfterMethod(null);
    setPhotoEstimate(null);
    setStage('before');
    setLeftover(100);
    setMenuConfirmed(false);
    setEmptyHint(false);
  };
  const useManual = () => {
    if (!afterPhotoUri) {
      setError('กรุณาถ่ายภาพหลังกินก่อน แล้วจึงปรับเปอร์เซ็นต์');
      return;
    }
    setAfterMethod('manual');
    setCapturingAfter(false);
    setError('');
    setConnection('');
    setEmptyHint(false);
  };
  const markEmpty = () => {
    if (afterPhotoUri && !working) {
      setAfterMethod('empty');
      setLeftover(0);
      setPhotoEstimate(0);
      setEmptyHint(false);
      setError('');
    }
  };
  const startAfterPhoto = () => {
    if (working) return;
    setAfterMethod('photo');
    setAfterPhotoUri(null);
    setPhotoEstimate(null);
    setCapturingAfter(true);
    setReady(false);
    setError('');
    setConnection('');
    setGallerySelected(false);
  };
  const leaveScanner = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/food-log');
  };
  const leaveCamera = () => {
    if (capturingAfter) {
      setCapturingAfter(false);
      setError('');
      setConnection('');
    } else leaveScanner();
  };
  const errorBox = error ? (
    <View accessibilityRole="alert" style={styles.error}>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  ) : null;
  const testGalleryButton = ENABLE_TEST_PHOTO_LIBRARY ? (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={working}
      onPress={handlePickLibrary}
      style={[styles.secondary, working && styles.disabled]}
    >
      <Text style={styles.link}>
        {picking ? 'กำลังเปิดคลังภาพ…' : 'เลือกรูปจากคลังภาพ (ทดสอบ)'}
      </Text>
    </TouchableOpacity>
  ) : null;

  if (restoring)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#1C6741" />
        <Text>กำลังโหลดมื้ออาหาร</Text>
      </SafeAreaView>
    );

  if (meal && !capturingAfter) {
    const { eaten, remaining } = splitNutrition(meal.nutrition, leftover);
    const after = stage !== 'before';
    return (
      <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity disabled={loading} onPress={leaveScanner} style={styles.back}>
            <Text style={styles.link}>← กลับ</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {stage === 'saved' ? 'บันทึกมื้ออาหารแล้ว' : after ? 'หลังกินอาหาร' : 'อาหารก่อนกิน'}
          </Text>
          <Text style={styles.subtitle}>
            {after ? 'คำนวณสารอาหารจากสัดส่วนที่คุณกิน' : 'ตรวจสอบเมนูและสารอาหารก่อนเริ่มกิน'}
          </Text>
          {!!reminderMessage && <Text style={styles.note}>{reminderMessage}</Text>}
          {(after ? afterPhotoUri || photoUri : photoUri) && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>
                {after && afterPhotoUri ? 'ภาพหลังกิน' : 'ภาพก่อนกิน'}
              </Text>
              <Image
                source={{ uri: after ? afterPhotoUri || photoUri! : photoUri! }}
                style={styles.preview}
              />
              {after && !afterPhotoUri && (
                <Text style={styles.note}>
                  ภาพนี้เป็นภาพก่อนกิน ยังไม่ได้ถ่ายภาพหลังกิน
                </Text>
              )}
            </View>
          )}
          {stage === 'before' && !!meal.candidates?.length && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>เลือกเมนูที่ตรงกับอาหารของคุณ</Text>
              <Text style={styles.note}>
                เมนูที่เป็นไปได้สูงสุด {meal.candidates.length} อันดับ · คะแนนความมั่นใจจากโมเดล
                ไม่ใช่การยืนยันว่าเมนูถูกต้อง
              </Text>
              {meal.candidates.map((candidate, index) => (
                <TouchableOpacity
                  key={candidate.referenceClass || candidate.menu}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: menuConfirmed && meal.referenceClass === candidate.referenceClass,
                  }}
                  disabled={working}
                  style={[
                    styles.card,
                    menuConfirmed &&
                      meal.referenceClass === candidate.referenceClass && {
                        borderColor: '#216440',
                        backgroundColor: '#EAF5EC',
                      },
                  ]}
                  onPress={() => chooseMenu(candidate)}
                >
                  <Text style={styles.label}>
                    {index + 1}. {candidate.menu}
                  </Text>
                  <Text style={styles.note}>
                    ความมั่นใจ {(candidate.confidence * 100).toFixed(1)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.caption}>เมนูที่ตรวจพบ</Text>
            <Text style={styles.menu}>{meal.menu}</Text>
            <Text style={styles.note}>
              {meal.comparisonReady
                ? 'ภาพก่อนกิน: พบหัวช้อนสำหรับเทียบปริมาณแล้ว'
                : 'ภาพก่อนกิน: ยังไม่มีหัวช้อนที่ใช้เทียบปริมาณได้ เลือกปรับเปอร์เซ็นต์หลังกินเองได้'}
            </Text>
            <Text style={styles.note}>
              {meal.nutritionBasis === 'fixed-serving'
                ? `ค่าโภชนาการคงที่ต่อ ${meal.servingLabel || '1 จาน'} · ไม่เปลี่ยนตามขนาดภาพ`
                : 'มื้อจากเวอร์ชันเดิม ใช้ค่าโภชนาการที่บันทึกไว้'}
            </Text>
            {meal.nutritionBasis === 'fixed-serving' && (
              <Text style={styles.note}>
                {meal.source
                  ? `แหล่งข้อมูล: ${meal.source}`
                  : 'ยังไม่ได้ใส่ข้อมูลอ้างอิง ค่าโภชนาการจะแสดงว่าไม่มีข้อมูล แต่ยังบันทึกเปอร์เซ็นต์ที่กินได้'}
              </Text>
            )}
          </View>
          {stage === 'before' && (
            <Text style={styles.note}>
              ตรวจสอบว่าเมนูตรงกับอาหารจริงก่อนบันทึก
              {!meal.comparisonReady
                ? ' · ยังไม่พบช้อนสำหรับเทียบปริมาณ มื้อนี้ใช้ปรับหลังกินเองได้'
                : ''}
            </Text>
          )}
          {stage === 'before' && !!meal.nutritionVariants?.length && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>เลือกสูตรอาหารก่อนบันทึก</Text>
              {meal.nutritionVariants.map((variant) => (
                <TouchableOpacity
                  key={variant.id}
                  accessibilityRole="radio"
                  accessibilityLabel={variant.label}
                  accessibilityState={{ checked: meal.nutritionVariantId === variant.id }}
                  aria-checked={meal.nutritionVariantId === variant.id}
                  disabled={working}
                  onPress={() => chooseNutritionVariant(variant)}
                  style={{
                    padding: 14,
                    minHeight: 56,
                    borderWidth: 1.5,
                    borderRadius: 12,
                    borderColor: meal.nutritionVariantId === variant.id ? '#1C6741' : '#E1E8E3',
                    backgroundColor: meal.nutritionVariantId === variant.id ? '#EAF5EC' : '#FFF',
                    gap: 5,
                  }}
                >
                  <Text style={styles.label}>{variant.label}</Text>
                  <Text style={styles.note}>
                    {formatNutrient(variant.nutrition.calories)} kcal · {variant.servingLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {after && (
            <View style={styles.card}>
              {stage !== 'saved' && (
                <>
                  <Text style={styles.sectionTitle}>
                    {afterPhotoUri ? 'บันทึกผลจากภาพหลังกิน' : 'ถ่ายภาพหลังกินก่อนบันทึก'}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={working}
                    style={styles.button}
                    onPress={startAfterPhoto}
                  >
                    <Text style={styles.buttonText}>
                      {afterPhotoUri ? 'ถ่ายภาพหลังกินใหม่' : 'ถ่ายภาพหลังกิน'}
                    </Text>
                  </TouchableOpacity>
                  {!!afterPhotoUri && (
                    <>
                      {emptyHint && (
                        <Text style={styles.note}>
                          โมเดลตรวจไม่พบอาหาร แต่ยังยืนยันว่าเป็นจานเปล่าไม่ได้
                          หากภาพนี้เป็นจานเปล่าให้กดกินหมดด้านล่าง
                        </Text>
                      )}
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={working}
                        style={styles.secondary}
                        onPress={markEmpty}
                      >
                        <Text style={styles.link}>จานเปล่า กินหมดแล้ว</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={working}
                        style={styles.button}
                        onPress={analyzeAfterPhoto}
                      >
                        <Text style={styles.buttonText}>
                          {loading ? 'กำลังวิเคราะห์…' : 'ให้แอปวิเคราะห์อาหารที่เหลือ'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={working}
                        style={styles.secondary}
                        onPress={useManual}
                      >
                        <Text style={styles.link}>ปรับเปอร์เซ็นต์เอง</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
              {afterMethod === 'empty' && (
                <Text style={styles.menu}>กินหมดแล้ว · กินไป 100% · เหลือ 0%</Text>
              )}
              {afterMethod !== 'empty' &&
                (stage === 'saved' || (afterMethod === 'photo' && photoEstimate !== null)) && (
                  <Text style={styles.menu}>
                    กินไป {100 - leftover}% · เหลือ {leftover}%
                  </Text>
                )}
              {stage !== 'saved' && afterMethod === 'manual' && (
                <LeftoverSlider value={leftover} onChange={setLeftover} />
              )}
              {afterMethod === 'photo' && (
                <Text style={styles.note}>
                  แอปเทียบพื้นที่กรอบตรวจจับกับภาพก่อนกิน โดยใช้ช้อนช่วยเทียบขนาด ผลเป็นค่าประมาณ
                  ตรวจสอบหรือเลือกปรับเองก่อนบันทึก
                </Text>
              )}
              <Text style={styles.note}>
                ใช้ค่าโภชนาการต่อจานที่บันทึกก่อนกิน คูณสัดส่วนที่กินไป
                ไม่คำนวณค่าตั้งต้นใหม่จากภาพหลังกิน
              </Text>
            </View>
          )}
          {(!after || canSave) && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {after ? 'สารอาหารที่กินไปและที่เหลือ' : 'สารอาหารต่อจาน (100%)'}
              </Text>
              <EnergyBar
                label={after ? 'พลังงานที่กินไป' : 'พลังงานต่อจาน'}
                value={after ? eaten.calories : meal.nutrition.calories}
                total={meal.nutrition.calories}
              />
              {after && (
                <Text style={styles.note}>
                  พลังงานที่เหลือ {formatNutrient(remaining.calories)} kcal
                </Text>
              )}
              {PLATE_NUTRIENTS.map(({ key, label, unit }) => (
                <View key={key} style={{ gap: 8, marginTop: 16 }}>
                  <EnergyBar
                    label={after ? `${label}ที่กินไป` : label}
                    unit={unit}
                    value={after ? eaten[key] : meal.nutrition[key]}
                    total={meal.nutrition[key]}
                  />
                  {after && (
                    <Text style={styles.note}>
                      {label}ที่เหลือ {formatNutrient(remaining[key])} {unit}
                    </Text>
                  )}
                </View>
              ))}
              {PLATE_NUTRIENTS.some(({ key }) => meal.nutrition[key] === null) && (
                <Text style={styles.note}>
                  “ไม่มีข้อมูล” หมายถึงฐานข้อมูลยังไม่มีค่าสารอาหารนี้
                </Text>
              )}
            </View>
          )}
          {errorBox}
          {stage !== 'saved' ? (
            <>
              <TouchableOpacity
                disabled={loading || !canSave}
                style={[styles.button, (loading || !canSave) && styles.disabled]}
                onPress={handleSave}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>
                    {after ? 'ยืนยันและบันทึกผลหลังกิน' : 'บันทึกก่อนกิน / เริ่มกิน'}
                  </Text>
                )}
              </TouchableOpacity>
              {stage === 'before' && (
                <TouchableOpacity disabled={loading} style={styles.secondary} onPress={retake}>
                  <Text style={styles.link}>ถ่ายใหม่</Text>
                </TouchableOpacity>
              )}
              {after && (
                <TouchableOpacity
                  disabled={loading}
                  style={styles.secondary}
                  onPress={leaveScanner}
                >
                  <Text style={styles.link}>กลับก่อน แล้วมาปรับหลังกิน</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={styles.note}>บันทึกไว้ในอุปกรณ์นี้แล้ว</Text>
              <TouchableOpacity style={styles.button} onPress={leaveScanner}>
                <Text style={styles.buttonText}>กลับหน้าหลัก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={retake}>
                <Text style={styles.link}>ถ่ายอาหารมื้อใหม่</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!permission)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#1C6741" />
      </SafeAreaView>
    );
  if (!permission.granted && !activePhotoUri)
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>ถ่ายรูปอาหาร</Text>
        <Text style={styles.subtitle}>อนุญาตให้ใช้กล้องเพื่อวิเคราะห์เมนูและสารอาหารก่อนกิน</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        >
          <Text style={styles.buttonText}>
            {permission.canAskAgain ? 'อนุญาตให้ใช้กล้อง' : 'เปิดการตั้งค่าสิทธิ์กล้อง'}
          </Text>
        </TouchableOpacity>
        {testGalleryButton}
        {errorBox}
        <TouchableOpacity disabled={working} style={styles.secondary} onPress={leaveCamera}>
          <Text style={styles.link}>กลับ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <TouchableOpacity disabled={working} onPress={leaveCamera} style={styles.back}>
          <Text style={styles.link}>← กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{capturingAfter ? 'ถ่ายอาหารหลังกิน' : 'ถ่ายอาหารก่อนกิน'}</Text>
        <Text style={styles.subtitle}>
          {capturingAfter
            ? 'ใช้จานและช้อนอันเดิม ให้เห็นหัวช้อนชัดและมีด้ามช้อนในภาพ ถ่ายจากมุมและระยะใกล้เคียงก่อนกิน'
            : 'ถ่ายจากด้านบน ให้เห็นอาหารทั้งจานและหัวช้อนชัด มีด้ามช้อนในภาพเพื่อช่วยแยกหัวช้อน แสงสว่าง ถือกล้องนิ่ง'}
        </Text>
      </View>
      <View style={styles.cameraFrame}>
        {activePhotoUri ? (
          <Image source={{ uri: activePhotoUri }} style={styles.camera} />
        ) : (
          focused && (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onCameraReady={() => setReady(true)}
              onMountError={() => {
                setReady(false);
                setError('เปิดกล้องไม่ได้ กรุณาตรวจสอบสิทธิ์กล้องหรือเปิดหน้านี้ใหม่');
              }}
            />
          )
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {errorBox}
        {!!error && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={loading || checking}
            style={styles.secondary}
            onPress={handleCheckConnection}
          >
            <Text style={styles.link}>
              {checking ? 'กำลังทดสอบการเชื่อมต่อ…' : 'ทดสอบการเชื่อมต่อ'}
            </Text>
          </TouchableOpacity>
        )}
        {!!connection && (
          <View accessibilityRole="alert" style={styles.card}>
            <Text style={styles.label}>{connection}</Text>
          </View>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={working || (!activePhotoUri && !ready)}
          onPress={handleCapture}
          style={[styles.button, (working || (!activePhotoUri && !ready)) && styles.disabled]}
        >
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="white" />
              <Text style={styles.buttonText}>กำลังวิเคราะห์อาหาร…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>{captureButtonLabel()}</Text>
          )}
        </TouchableOpacity>
        {testGalleryButton}
        {activePhotoUri && !working && (
          <TouchableOpacity style={styles.secondary} onPress={retake}>
            <Text style={styles.link}>ถ่ายใหม่</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: '#FFFFFF' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#F8FAF9',
  },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1C2921' },
  subtitle: { fontSize: 16, color: '#64736B', lineHeight: 24 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  link: { color: '#1C6741', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    borderColor: '#E1E8E3',
    borderWidth: 1,
    gap: 8,
  },
  caption: { color: '#64736B', fontSize: 14 },
  menu: { fontSize: 22, color: '#1C6741', fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 21, color: '#64736B' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1C2921', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#EEF2EF',
    gap: 6,
  },
  nutrient: { flex: 1.4 },
  label: { fontSize: 15, color: '#263C2F', fontWeight: '600' },
  unit: { fontSize: 12, color: '#64736B', marginTop: 3 },
  number: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600', color: '#1C6741' },
  remaining: { color: '#8A6B33' },
  columnTitle: { flex: 1, textAlign: 'right', fontSize: 14, color: '#64736B' },
  preview: { width: '100%', height: 200, borderRadius: 18 },
  cameraFrame: {
    flex: 1,
    minHeight: 200,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#15221B',
  },
  camera: { flex: 1, width: '100%', height: '100%' },
  button: {
    backgroundColor: '#1C6741',
    padding: 16,
    borderRadius: 12,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { padding: 14, backgroundColor: '#FFF0ED', borderRadius: 12 },
  errorText: { color: '#9D3425', fontSize: 15, lineHeight: 23 },
});
