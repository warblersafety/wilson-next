import { contextCase, setContextFact } from './reviewed-context';
export const monthReturnDate = { precision: 'month' as const, year: '2028', month: '02', wording: 'Returned to the manufacturer during February 2028' };
export function returnDateCase() {
    return setContextFact(setContextFact(contextCase(), 'event:event:productAvailability', { kind: 'known', value: 'returned-to-manufacturer' }), 'event:event:productReturnDate', { kind: 'known', value: '2028-02-12' });
}
