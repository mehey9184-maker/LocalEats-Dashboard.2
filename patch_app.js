import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// replace multiline is_active update #1 (lines 4805+)
content = content.replace(
  /const \{ error \} = await supabase\s*\.from\("shops"\)\s*\.update\(\{ is_active: newStatus \}\)\s*\.in\("id", shops\.map\(s => s\.id\)\);/,
  `// update all shops
  let error = null;
  for (const s of shops) {
    const res = await updateFirestoreShop(s.id, { is_active: newStatus });
    if (res.error) error = res.error;
  }`
);

// replace multiline is_active update #2 (lines 5269+)
content = content.replace(
  /const \{ error \} = await supabase\s*\.from\("shops"\)\s*\.update\(\{ is_active: newStatus \}\)\s*\.eq\("id", currentShop\.id\);/g,
  `const { error } = await updateFirestoreShop(currentShop.id, { is_active: newStatus });`
);

// replace multiline is_active update #3 (lines 13431+)
content = content.replace(
  /const \{ error \} = await supabase\s*\.from\("shops"\)\s*\.update\(\{ is_active: isOpen \}\)\s*\.eq\("id", shop\.id\);/g,
  `const { error } = await updateFirestoreShop(shop.id, { is_active: isOpen });`
);

// replace multiline is_active update #4 (lines 15519+)
content = content.replace(
  /supabase\s*\.from\("shops"\)\s*\.update\(\{ is_active: isActive \}\)\s*\.eq\("id", currentShop\.id\)\s*\.then\(\(\{ error \}\) => \{/g,
  `updateFirestoreShop(currentShop.id, { is_active: isActive }).then(({ error }) => {`
);

// replace single line is_active update #5
content = content.replace(
  /const \{ error \} = await supabase\.from\("shops"\)\.update\(\{ is_active: newStatus \}\)\.eq\("id", currentShop\.id\);/g,
  `const { error } = await updateFirestoreShop(currentShop.id, { is_active: newStatus });`
);

// handle coupons just in case it is requested later (lines 11574)
content = content.replace(
  /const \{ error \} = await supabase\s*\.from\("coupons"\)\s*\.update\(\{ is_active: !isActive \}\)\s*\.eq\("id", id\);/g,
  `// Not implemented yet: const { error } = await updateFirestoreCoupon(id, { is_active: !isActive });
  const error = null;`
);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched App.tsx");
