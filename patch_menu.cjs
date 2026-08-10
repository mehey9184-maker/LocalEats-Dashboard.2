const fs = require('fs');
const file = 'src/components/MenuManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldState = `  const [selectedShopId, setSelectedShopId] = useState<number | null>(() => {
    const found = shops.find((s) => s.id === 18 || s.name === "My-Kota");
    return found ? found.id : 18;
  });

  useEffect(() => {
    const found = shops.find((s) => s.id === 18 || s.name === "My-Kota");
    const targetId = found ? found.id : 18;
    if (selectedShopId !== targetId) {
      setSelectedShopId(targetId);
    }
  }, [shops, selectedShopId]);`;

const newState = `  const [selectedShopId, setSelectedShopId] = useState<number | null>(() => {
    const found = shops.find((s) => isShopOwnedByUser(s, user));
    return found ? found.id : null;
  });

  useEffect(() => {
    const found = shops.find((s) => isShopOwnedByUser(s, user));
    const targetId = found ? found.id : null;
    if (selectedShopId !== targetId) {
      setSelectedShopId(targetId);
    }
  }, [shops, user, selectedShopId]);`;

content = content.replace(oldState, newState);

// replace targetId = selectedShopId || 18
content = content.replace(/selectedShopId \|\| 18/g, 'selectedShopId');
content = content.replace(/String\(18\)/g, 'String(selectedShopId)');

fs.writeFileSync(file, content);
console.log('patched menu management');
