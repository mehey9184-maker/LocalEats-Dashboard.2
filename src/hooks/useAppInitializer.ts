import { useEffect } from "react";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseMocked } from "../lib/supabase";

interface UseAppInitializerProps {
  user: User | null;
  role: string | null;
  fetchOrders: () => Promise<void>;
  fetchShops: () => Promise<void>;
  fetchAllMenuItems: () => Promise<void>;
  supabase: SupabaseClient;
}

export const useAppInitializer = ({
  user,
  role,
  fetchOrders,
  fetchShops,
  fetchAllMenuItems,
  supabase,
}: UseAppInitializerProps) => {
  useEffect(() => {
    // If the user is logged in OR they are viewing as a customer (guest mode)
    if (user || role === "customer") {
      if (user) {
        void fetchOrders();
      }
      void fetchShops();
      void fetchAllMenuItems();

      if (isSupabaseMocked()) {
        return;
      }

      // Real-time subscription for shops
      const shopsChannel = supabase
        .channel("shops_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "shops" },
          () => {
            void fetchShops();
          },
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(shopsChannel);
      };
    }
  }, [user, role, fetchOrders, fetchShops, fetchAllMenuItems, supabase]);
};
