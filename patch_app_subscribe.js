import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const { serviceLoading } = useAppInitializer({
    user,
    role: "merchant",`;

const replacement = `  // Subscribe to Firestore for real-time shop updates (e.g. is_active toggles)
  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToShopsFirestore((updatedShops) => {
        let list = updatedShops;
        if (!list.some((s) => s.id === 18)) {
          list = [MY_KOTA_SHOP, ...list];
        } else {
          list = list.map((s) => (s.id === 18 ? { ...MY_KOTA_SHOP, ...s } : s));
        }
        setShops(list);
        
        try {
          localStorage.setItem("localeats_cached_shops", JSON.stringify(list));
        } catch {
          // ignore
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const { serviceLoading } = useAppInitializer({
    user,
    role: "merchant",`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched App.tsx with subscribeToShopsFirestore");
