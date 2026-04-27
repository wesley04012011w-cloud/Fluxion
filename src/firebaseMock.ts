export const collection = (...args: any[]) => ({} as any);
export const doc = (...args: any[]) => ({} as any);
export const query = (...args: any[]) => ({} as any);
export const where = (...args: any[]) => ({} as any);
export const orderBy = (...args: any[]) => ({} as any);
export const setDoc = async (...args: any[]) => {};
export const deleteDoc = async (...args: any[]) => {};
export const updateDoc = async (...args: any[]) => {};
export const onSnapshot = (ref: any, onNext: any, onError?: any) => {
  // onNext({ docs: [] });
  return () => {}; // unsubscribe function
};
export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1000000; }
  toDate() { return new Date(this.toMillis()); }
  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromMillis(ms: number) {
    return new Timestamp(Math.floor(ms / 1000), 0);
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
}
export const limit = (...args: any[]) => ({} as any);
export const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => ({}) } as any);
export const getDocFromServer = async (...args: any[]) => ({ exists: () => false, data: () => ({}) } as any);
export const getDocsFromServer = async (...args: any[]) => ({ docs: [], empty: true, forEach: () => {} } as any);
export const getDocs = async (...args: any[]) => ({ docs: [], empty: true, forEach: () => {} } as any);
export const serverTimestamp = () => Timestamp.now();
export const addDoc = async (...args: any[]) => ({ id: 'mock-id' });
