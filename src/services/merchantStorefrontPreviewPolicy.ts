/** Storefront F1 is an isolated design and correctness Preview.
 * This constant is deliberately not a Vite environment toggle; a future
 * production-authorised write flow requires separate review and approval.
 */
export function merchantStorefrontPreviewOnly():boolean{return true;}
export function merchantStorefrontWritesEnabled():boolean{return false;}
export function merchantStorefrontPreviewNotice():string {
  return "Storefront Preview only. Shop information is read-only. Saving shop details, changing availability, following, image uploads, map pin updates and new shop registration are unavailable; customer visibility and ordering are not verified by this page.";
}
