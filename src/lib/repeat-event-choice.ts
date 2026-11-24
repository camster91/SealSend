/** When only one event may be active, repeating takes the current one offline, so it must be chosen. */
export function canSubmitRepeat(choice: { mustArchiveSource: boolean; archiveSource: boolean }): boolean {
  return !choice.mustArchiveSource || choice.archiveSource;
}
