import { createContext, useContext, useEffect, useState } from 'react';
import { accountRequest } from '@/services/account-api';
import { AccountDeletedCleanupError, AccountSession, clearSession, deleteAccountSession, restoreSession, storeSession } from '@/services/auth-session';
import { cancelMealReminders } from '@/services/meal-reminders';

const AuthContext = createContext<{
  session: AccountSession | null; loading: boolean; error: string;
  signIn: (value: AccountSession) => Promise<void>; signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}>({ session: null, loading: true, error: '', signIn: async () => {}, signOut: async () => {}, deleteAccount: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    restoreSession().then(value => { if (active) setSession(value); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'ตรวจสอบบัญชีไม่สำเร็จ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const signIn = async (value: AccountSession) => { await storeSession(value); setError(''); setSession(value); };
  const signOut = async () => {
    try { await cancelMealReminders(); } catch { /* Local account sign-out must still complete. */ }
    if (session) { try { await accountRequest('logout', {}, session.token); } catch { /* Local sign-out still works when the server is offline. */ } }
    await clearSession(); setSession(null); setError('');
  };
  const deleteAccount = async (password: string) => {
    if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อนลบบัญชี');
    try { await deleteAccountSession(session, password); try { await cancelMealReminders(); } catch {} setSession(null); setError('ลบบัญชีเรียบร้อยแล้ว'); }
    catch (err) {
      if (err instanceof AccountDeletedCleanupError) { setSession(null); setError(err.message); }
      throw err;
    }
  };
  return <AuthContext.Provider value={{ session, loading, error, signIn, signOut, deleteAccount }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
