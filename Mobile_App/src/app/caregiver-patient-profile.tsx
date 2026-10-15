import { useLocalSearchParams } from 'expo-router';
import ProfileForm from '@/components/profile-form';

export default function CaregiverPatientProfileScreen() {
  const { patient } = useLocalSearchParams<{ patient?: string }>();
  return <ProfileForm key={patient ?? 'new'} patient patientId={patient} />;
}
