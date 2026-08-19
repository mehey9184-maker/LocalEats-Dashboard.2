import fs from 'fs';
let content = fs.readFileSync('src/hooks/useAppInitializer.ts', 'utf8');

const target = `      // Real-time subscription for shops
      const shopsChannel = getFreshChannel("shops_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "shops" },
          () => {
            void fetchShops();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(shopsChannel);
      };`;

const replacement = `      // Firebase handles its own real-time subscriptions, Supabase mock channels are disabled for shops.`;

content = content.replace(target, replacement);

fs.writeFileSync('src/hooks/useAppInitializer.ts', content);
console.log("Patched useAppInitializer.ts");
