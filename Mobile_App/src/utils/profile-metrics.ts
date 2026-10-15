type Measurements = { dob: string; weight: string; height: string };

export function ageFromDob(dob: string, today = new Date()): number | null {
  const match = dob.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]),
    month = Number(match[2]);
  let year = Number(match[3]);
  // Accept both Buddhist Era and Common Era in the Thai date field.
  if (year >= 2400) year -= 543;
  if (year < 1900) return null;
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day ||
    birth > today
  )
    return null;
  const birthdayPending =
    today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day);
  return today.getFullYear() - year - (birthdayPending ? 1 : 0);
}

function positiveNumber(value: string): number | null {
  const number = Number(value.trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

// สูตรพลังงานที่กำหนดสำหรับผู้สูงอายุเท่านั้น
function energyFactorForAge(age: number | null): 20 | 25 | null {
  if (age === null || age < 60) return null;
  if (age > 80) return 20;
  return 25;
}

export function profileMetrics(profile: Measurements | null, today = new Date()) {
  const age = profile ? ageFromDob(profile.dob, today) : null;
  const weight = profile ? positiveNumber(profile.weight) : null;
  const height = profile ? positiveNumber(profile.height) : null;
  const rawBmi = weight !== null && height !== null ? weight / (height / 100) ** 2 : null;
  const bmi = rawBmi !== null && Number.isFinite(rawBmi) ? rawBmi : null;
  const factor = energyFactorForAge(age);
  const rawEnergy = factor !== null && weight !== null ? factor * weight : null;
  const energy =
    rawEnergy !== null && Number.isFinite(rawEnergy) && Math.round(rawEnergy) > 0
      ? Math.round(rawEnergy)
      : null;
  return { age, weight, bmi, factor, energy };
}
