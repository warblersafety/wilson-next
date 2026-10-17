import { contextCase, setContextFact } from './reviewed-context';
export const monthDob = { precision: 'month' as const, year: '1969', month: '02', wording: 'Date of birth recorded as February 1969' };
export function dobPrecisionCase() {
    return setContextFact(setContextFact(contextCase(), 'patient:patient:dateOfBirth', { kind: 'known', value: '1969-02-12' }), 'patient:patient:a2Value', { kind: 'known', value: 'date-of-birth' });
}
