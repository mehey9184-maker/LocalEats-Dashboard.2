import fs from 'fs';
let content = fs.readFileSync('src/lib/firebase.ts', 'utf8');

const replacement = `
export function subscribeToShopsFirestore(
  onUpdate: (shops: Shop[]) => void,
  ownerId?: string
): Unsubscribe {
  const coll = collection(db, "shops");
  const q = ownerId ? query(coll, where("owner_id", "==", ownerId)) : query(coll);

  return onSnapshot(q, (snap) => {
    const shops = snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as Shop));
    onUpdate(shops);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, "shops");
  });
}
`;

// Insert before getFirestoreShops
content = content.replace(
  'export async function getFirestoreShops',
  replacement + '\nexport async function getFirestoreShops'
);

fs.writeFileSync('src/lib/firebase.ts', content);
console.log("Added subscribeToShopsFirestore");
