import React, { useState, useEffect } from "react";
import { 
  Database, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  UploadCloud, 
  RefreshCw,
  Layers,
  UtensilsCrossed,
  ReceiptText,
  Server
} from "lucide-react";
import { toast } from "sonner";
import { migrateDataToFirestore, verifyFirestoreCollections } from "../lib/firebase";
import { Order, MenuItem, Shop } from "../types";

interface FirebaseMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  menuItems: MenuItem[];
  shops: Shop[];
  currentShopId?: string | number;
}

export const FirebaseMigrationModal: React.FC<FirebaseMigrationModalProps> = ({
  isOpen,
  onClose,
  orders,
  menuItems,
  shops,
  currentShopId,
}) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "in_progress" | "success" | "error">("idle");
  const [summary, setSummary] = useState<{ orders: number; menu: number; shops: number } | null>(null);
  const [firestoreStats, setFirestoreStats] = useState<{
    connected: boolean;
    databaseId: string;
    collections: {
      shops: number;
      orders: number;
      menu_items: number;
      users: number;
      rider_profiles: number;
      rider_connections: number;
    };
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsVerifying(true);
      verifyFirestoreCollections()
        .then((res) => {
          setFirestoreStats(res);
        })
        .catch((err) => {
          console.warn("[Migration Modal] Verification warning:", err);
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartMigration = async () => {
    setIsMigrating(true);
    setMigrationStatus("in_progress");
    try {
      const result = await migrateDataToFirestore({
        orders,
        menuItems,
        shops,
        shopId: currentShopId,
      });

      setSummary({
        orders: result.ordersMigrated,
        menu: result.menuItemsMigrated,
        shops: result.shopsMigrated,
      });
      setMigrationStatus("success");
      toast.success("Successfully synchronized and migrated data to Firebase Firestore!");

      // Refresh verification stats
      const refreshedStats = await verifyFirestoreCollections();
      setFirestoreStats(refreshedStats);
    } catch (err) {
      console.error("[Migration] Error:", err);
      setMigrationStatus("error");
      toast.error(err instanceof Error ? err.message : "Failed to migrate data to Firestore");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant/20 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-primary flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline font-black text-xl text-on-surface">
                Firestore Cloud Migration
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                Verify collections and migrate shops, menus, & orders to Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant/60 hover:text-on-surface p-1.5 rounded-xl hover:bg-surface-container transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Firestore Connection status banner */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low dark:bg-zinc-800/40 border border-outline-variant/10 text-xs">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="font-medium text-on-surface">Firestore Instance:</span>
            <span className="font-mono text-[11px] text-on-surface-variant truncate max-w-[180px]">
              {firestoreStats?.databaseId || "ai-studio-localeats..."}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold">
            {isVerifying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : firestoreStats?.connected ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live
              </span>
            ) : (
              <span className="text-orange-500">Ready</span>
            )}
          </div>
        </div>

        {/* Data counts ready for migration */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 text-center">
            <div className="flex items-center justify-center gap-1.5 text-on-surface-variant mb-1">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-bold uppercase">Shops</span>
            </div>
            <p className="text-xl font-headline font-black text-on-surface">
              {shops.length || 1}
            </p>
            {firestoreStats && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {firestoreStats.collections.shops} in cloud
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 text-center">
            <div className="flex items-center justify-center gap-1.5 text-on-surface-variant mb-1">
              <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] font-bold uppercase">Menu Items</span>
            </div>
            <p className="text-xl font-headline font-black text-on-surface">
              {menuItems.length}
            </p>
            {firestoreStats && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {firestoreStats.collections.menu_items} in cloud
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 text-center">
            <div className="flex items-center justify-center gap-1.5 text-on-surface-variant mb-1">
              <ReceiptText className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-bold uppercase">Orders</span>
            </div>
            <p className="text-xl font-headline font-black text-on-surface">
              {orders.length}
            </p>
            {firestoreStats && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {firestoreStats.collections.orders} in cloud
              </span>
            )}
          </div>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 space-y-2 text-xs text-on-surface">
          <div className="flex items-center gap-2 font-bold text-primary">
            <UploadCloud className="w-4 h-4" />
            <span>Direct Firestore Document Mapping</span>
          </div>
          <p className="text-on-surface-variant/90 leading-relaxed">
            Transfers your catalog and transaction records into Firestore collections mapped to schema specifications, supporting realtime order sync and multi-vendor scaling.
          </p>
        </div>

        {/* Success / Status Display */}
        {migrationStatus === "success" && summary && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Migration Completed Successfully!</span>
            </div>
            <p>
              Synced {summary.shops} shop profiles, {summary.menu} menu items, and {summary.orders} orders to Firestore.
            </p>
          </div>
        )}

        {migrationStatus === "error" && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>An error occurred while synchronizing data. Local cached copy remains safe.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container font-bold text-xs text-on-surface transition-colors"
          >
            {migrationStatus === "success" ? "Done" : "Cancel"}
          </button>
          
          <button
            type="button"
            disabled={isMigrating}
            onClick={handleStartMigration}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isMigrating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Migrating Data...</span>
              </>
            ) : migrationStatus === "success" ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Re-Sync to Firestore</span>
              </>
            ) : (
              <>
                <span>Migrate to Firestore Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
