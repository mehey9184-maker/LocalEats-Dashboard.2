/** Merchant Settings S3: hard read-only boundary for pickup-payment and
 * deferred-delivery settings. No activation, billing or order writes authorised. */
export function merchantSettingsS3WritesEnabled():boolean {return false;}

export function pickupMethodRecordLabel(value:unknown):string {
  if(!Array.isArray(value) || value.length===0)return "No verified pickup methods available";
  if(value.some(x=>x!=="cash" && x!=="card_machine") ||
    new Set(value).size!==value.length || value.length>2)
    return "Pickup methods unavailable or unsupported";
  if(value.includes("cash") && value.includes("card_machine"))
    return "Shop record lists cash or physical card machine";
  if(value[0]==="cash")return "Shop record lists cash at shop";
  return "Shop record lists physical card machine at shop";
}

export function merchantSettingsS3PickupNotice():string {
 return "Pickup-payment Preview only. Shop-listed methods are not verified card-terminal connections or proof of payment. Changing methods and placing real orders are disabled until separately approved.";
}
export function merchantSettingsS3DeliveryNotice():string {
 return "Delivery and riders are deferred. Radius, fees and location examples below are not live delivery coverage, customer charges or approved ordering limits. This Preview cannot save any delivery or shop-location changes.";
}
