import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const fetchShops = useCallback(async () => {
    let remoteShops: Shop[] | null = null;
    let remoteError: { message: string; code?: string } | null = null;

    try {
      const res = await fetchWithRetry(() =>
        supabase
          .from("shops")
          .select("*")
          .order("created_at", { ascending: false })
      );
      if (res.data) {
        remoteShops = res.data as Shop[];
      } else if (res.error) {
        remoteError = res.error;
        // If created_at column is missing in schema (SQL 42703), retry without ordering
        if ((res.error as { code?: string; message?: string }).code === "42703" || res.error.message?.includes("column")) {
          const fallbackRes = await fetchWithRetry(() => supabase.from("shops").select("*"));
          if (fallbackRes.data) {
            remoteShops = fallbackRes.data as Shop[];
            remoteError = null;
          }
        }
      }
      
      // Diagnostic Debug Logging
      if (remoteShops) {
        const activeShops = remoteShops.filter(s => s.is_active);
        console.log(\`[Diagnostic] Found \${remoteShops.length} total shops in Firestore.\`);
        console.log(\`[Diagnostic] \${activeShops.length} shops are marked 'is_active'.\`);
        remoteShops.forEach(s => {
          console.log(\`[Diagnostic] Shop: \${s.name} | is_active: \${s.is_active} | owner_id: \${s.owner_id}\`);
        });
      }
      
    } catch (e) {
      console.debug("[Shop Discovery] Exception during fetchShops:", e);
    }`;

const replacement = `  const fetchShops = useCallback(async () => {
    let remoteShops: Shop[] | null = null;
    let remoteError: { message: string; code?: string } | null = null;

    try {
      // Force cache purge on fetch execution
      localStorage.removeItem("localeats_cached_shops");

      // We load from Firestore instead of the Supabase mock now
      remoteShops = await getFirestoreShops();
      
      // Diagnostic Debug Logging
      if (remoteShops) {
        const activeShops = remoteShops.filter(s => s.is_active);
        console.log(\`[Diagnostic - Firestore] Found \${remoteShops.length} total shops in Firestore.\`);
        console.log(\`[Diagnostic - Firestore] \${activeShops.length} shops are marked 'is_active'.\`);
        remoteShops.forEach(s => {
          const isMatch = user && isShopOwnedByUser(s, user);
          console.log(\`[Diagnostic - Firestore] Shop: \${s.name} | is_active: \${s.is_active} | owner_id: \${s.owner_id} | Matches Current User: \${isMatch ? 'YES' : 'NO'}\`);
        });
      }
      
    } catch (e: any) {
      console.error("[Shop Discovery] Exception during fetchShops:", e);
      remoteError = { message: e.message };
    }`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched fetchShops in App.tsx");
