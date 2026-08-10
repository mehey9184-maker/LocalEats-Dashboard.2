const fs = require('fs');
const file = 'src/components/RiderManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `    const { error } = await supabase.from("rider_connections").insert({
      shop_id: currentShop.id,
      connection_code: code,
      expires_at: expiresAt,
      status: "active",
    });

    if (error) {
      toast.error(error.message);
    } else {
      setActiveCode({ code, expires: expiresAt });
      setShowCode(true);
      void fetchConnections();
      toast.success(\`Pairing code generated! Valid for \${durationLabel}.\`);
    }`;

const newCode = `    let insertData = {
      shop_id: currentShop.id,
      connection_code: code,
      expires_at: expiresAt,
      status: "active",
    };
    
    let res = await supabase.from("rider_connections").insert(insertData);
    
    if (res.error) {
      // Fallback: try without status
      const { status, ...rest } = insertData;
      res = await supabase.from("rider_connections").insert(rest);
    }
    
    if (res.error) {
       // Fallback: try with pending
       res = await supabase.from("rider_connections").insert({ ...insertData, status: "pending" });
    }

    if (res.error) {
      toast.error(res.error.message || "Failed to generate code");
    } else {
      setActiveCode({ code, expires: expiresAt });
      setShowCode(true);
      void fetchConnections();
      toast.success(\`Pairing code generated! Valid for \${durationLabel}.\`);
    }`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(file, content);
console.log('patched gen code');
