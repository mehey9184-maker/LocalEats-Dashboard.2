/** Merchant Riders R1: visual inspection only. Not an activation flag.
 * No pairing, rider data retrieval, dispatch, notifications, COD settlements,
 * location subscriptions, document exports or client-side cache changes.
 */
export function merchantRiderPreviewOnly():boolean{return true;}
export function merchantRiderActionsEnabled():boolean{return false;}
export function merchantRiderPreviewNotice():string {
  return "Rider and delivery features are deferred. This is a read-only design Preview: no rider contacts, live location, pairing codes, cash settlement, payouts, messaging or dispatch are loaded or activated.";
}
export function merchantRiderNoRecordsNotice():string {
  return "Rider records are not loaded in Preview. This does not confirm there are no riders, orders, cash handovers or active connections in the underlying system.";
}
