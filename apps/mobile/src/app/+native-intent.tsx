import { nativeDestination } from '../native-links';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) { return nativeDestination(path); }
