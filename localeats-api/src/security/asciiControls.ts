/** Security-sensitive identity guards. Reject ASCII C0 controls and DEL without
 * relying on a control-character regexp that can be hidden by lint suppression.
 * Whitespace is checked separately so Unicode JS \s semantics are preserved.
 */
export function containsAsciiControl(value:string):boolean {
  return Array.from(value).some(c=>{
    const point=c.charCodeAt(0);
    return point<32 || point===127;
  });
}
export function containsAsciiControlOrWhitespace(value:string):boolean {
  return containsAsciiControl(value)||/\s/u.test(value);
}
