/** Reserved identity for the isolated read-only My-Kota sample.
 * Never store, price, expose via public catalog, or submit this fixture.
 */
export const PRIVATE_MY_KOTA_SHOP_ID="private-test-my-kota-preview";
export const isPrivateMyKotaFixtureId=(id:unknown):boolean=>
  id===PRIVATE_MY_KOTA_SHOP_ID;
