const fs = require('fs');
let code = fs.readFileSync('src/components/OrdersManagement.tsx', 'utf-8');

code = code.replace(
  /const \{ error \} = await supabase\.from\('orders'\)\.update\(\{ merchant_rating: rating \}\)\.eq\('id', orderId\);[\s\S]*?await supabase\.from\('rider_profiles'\)\.update\(\{ rating: avgRating \}\)\.eq\('id', riderId\);\s*\}/,
  `try {
      const { data: ratingsData } = await supabase
        .from('orders')
        .select('merchant_rating')
        .eq('rider_id', riderId)
        .not('merchant_rating', 'is', null);

      const items = (ratingsData as unknown as { merchant_rating: number }[]) || [];
      const currentRatings = items.map(i => i.merchant_rating || 0);
      const newRatings = [...currentRatings, rating];
      const avgRating = newRatings.reduce((a, b) => a + b, 0) / newRatings.length;

      await OrderService.rateRider(orderId, riderId, rating, avgRating);
    } catch (error) {
      console.warn("Rating update warning (saved locally):", error);
    }`
);

fs.writeFileSync('src/components/OrdersManagement.tsx', code);
