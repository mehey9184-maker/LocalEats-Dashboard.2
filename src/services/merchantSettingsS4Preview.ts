/** Merchant Settings S4: final read-only safeguard for account, storefront
 * and preference controls. It cannot be enabled by an environment variable.
 * Real settings changes require a separately approved workflow and API gate.
 */
export function merchantSettingsS4ActionsEnabled():boolean { return false; }

export function merchantSettingsS4Notice():string {
  return "Settings Preview only. Profile and staff changes, storefront location edits, rider access and notification preferences are not activated. Use the navigation tabs to inspect the original layouts.";
}
