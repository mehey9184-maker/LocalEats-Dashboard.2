/** Merchant Settings S2: inspect original Operations/Hardware layouts safely.
 * No write, print, terminal pairing or order automation is authorised here.
 * This is a hard Preview safety boundary, not a Production feature flag.
 */
export function merchantSettingsOperationalWritesEnabled():boolean { return false; }

export function merchantSettingsOperationsNotice():string {
  return "Operations Preview only. Shop open/closed indicators do not confirm online ordering. Availability changes, holiday schedules, opening hours and preparation times cannot be changed here.";
}
export function merchantSettingsHardwareNotice():string {
  return "Hardware Preview only. No card-terminal pairing, payment verification, auto-accept, printer connection or test print is established by this screen.";
}
