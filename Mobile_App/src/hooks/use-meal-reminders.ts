import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { cancelMealReminders, notificationApi, reminderDestination, syncMealReminders } from '@/services/meal-reminders';

export function useMealReminders(email?: string, loading = false) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web' || loading) return;
    let active = true;
    let listener: { remove: () => void } | undefined;
    const sync = () => { (email ? syncMealReminders() : cancelMealReminders()).catch(() => {}); };
    sync();
    const appState = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    notificationApi().then(api => {
      if (!active) return;
      const handle = async (data: Record<string, unknown>) => {
        if (!email) return;
        const destination = await reminderDestination(data);
        await api.clearLastNotificationResponseAsync();
        if (active && destination) router.push(destination);
      };
      listener = api.addNotificationResponseReceivedListener(response => { handle(response.notification.request.content.data ?? {}).catch(() => {}); });
      const last = api.getLastNotificationResponse();
      if (last) handle(last.notification.request.content.data ?? {}).catch(() => {});
    }).catch(() => {});
    return () => { active = false; appState.remove(); listener?.remove(); };
  }, [email, loading, pathname, router]);
}
