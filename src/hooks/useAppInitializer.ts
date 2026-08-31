import { useEffect, useState, useCallback, useRef } from "react";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseMocked } from "../lib/supabase";
import { handleCentralizedError } from "../utils/errorHandler";

export interface ServiceLoadingState {
  shops: boolean;
  orders: boolean;
  menu: boolean;
}

interface UseAppInitializerProps {
  user: User | null;
  role: string | null;
  fetchOrders: () => Promise<void>;
  fetchShops: () => Promise<void>;
  fetchAllMenuItems: () => Promise<void>;
  supabase?: SupabaseClient;
  authReady?: boolean;
}

export const useAppInitializer = ({
  user,
  role,
  fetchOrders,
  fetchShops,
  fetchAllMenuItems,
  authReady = true,
}: UseAppInitializerProps) => {
  const [serviceLoading, setServiceLoading] = useState<ServiceLoadingState>({
    shops: true,
    orders: user ? true : false,
    menu: true,
  });

  const fetchOrdersRef = useRef(fetchOrders);
  const fetchShopsRef = useRef(fetchShops);
  const fetchAllMenuItemsRef = useRef(fetchAllMenuItems);

  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
    fetchShopsRef.current = fetchShops;
    fetchAllMenuItemsRef.current = fetchAllMenuItems;
  }, [fetchOrders, fetchShops, fetchAllMenuItems]);

  const loadShopsService = useCallback(async () => {
    setServiceLoading((prev) => ({ ...prev, shops: true }));
    try {
      await fetchShopsRef.current();
    } catch (err) {
      handleCentralizedError(err, "Shops Service", "Failed to load restaurant list", false);
    } finally {
      setServiceLoading((prev) => ({ ...prev, shops: false }));
    }
  }, []);

  const loadOrdersService = useCallback(async () => {
    if (!user) {
      setServiceLoading((prev) => ({ ...prev, orders: false }));
      return;
    }
    setServiceLoading((prev) => ({ ...prev, orders: true }));
    try {
      await fetchOrdersRef.current();
    } catch (err) {
      handleCentralizedError(err, "Orders Service", "Failed to load active orders", false);
    } finally {
      setServiceLoading((prev) => ({ ...prev, orders: false }));
    }
  }, [user]);

  const loadMenuService = useCallback(async () => {
    setServiceLoading((prev) => ({ ...prev, menu: true }));
    try {
      await fetchAllMenuItemsRef.current();
    } catch (err) {
      handleCentralizedError(err, "Menu Service", "Failed to load menu catalog", false);
    } finally {
      setServiceLoading((prev) => ({ ...prev, menu: false }));
    }
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!authReady) return;
    if (role === "merchant" && !userId) return;

    if (userId || role === "customer" || role === "merchant") {
      void loadOrdersService();
      void loadShopsService();
      void loadMenuService();

      if (isSupabaseMocked()) {
        return;
      }
    }
  }, [userId, role, loadOrdersService, loadShopsService, loadMenuService, authReady]);

  return {
    serviceLoading,
    isShopsLoading: serviceLoading.shops,
    isOrdersLoading: serviceLoading.orders,
    isMenuLoading: serviceLoading.menu,
    isAnyLoading: serviceLoading.shops || serviceLoading.orders || serviceLoading.menu,
    isAllLoading: serviceLoading.shops && serviceLoading.orders && serviceLoading.menu,
    reloadShops: loadShopsService,
    reloadOrders: loadOrdersService,
    reloadMenu: loadMenuService,
  };
};
