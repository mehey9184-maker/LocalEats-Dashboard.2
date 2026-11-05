// Receipt markup must treat customer instructions as text, including literal HTML.
export function receiptText(value:unknown):string {
 return String(value ?? "").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
}
