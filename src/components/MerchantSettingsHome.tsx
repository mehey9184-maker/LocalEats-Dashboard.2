import React from "react";
import {
  ChevronRight,
  Clock,
  CreditCard,
  HelpCircle,
  MapPin,
  Printer,
  Settings,
  Store,
  Truck,
  Users,
} from "lucide-react";
import type { Shop } from "../types";

interface MerchantSettingsHomeProps {
  shop: Shop | null;
  onSelect: (category: string) => void;
  onOpenStorefront: () => void;
  onOpenPayments: () => void;
}

const settingsCards = [
  { title: "Shop profile", description: "Name, logo, description and customer contact.", icon: Store, action: "storefront" },
  { title: "Location", description: "Where customers and riders find your shop.", icon: MapPin, action: "storefront" },
  { title: "Opening hours", description: "When your shop accepts orders.", icon: Clock, action: "operations" },
  { title: "Delivery", description: "Delivery radius and fulfilment settings.", icon: Truck, action: "delivery" },
  { title: "Staff & access", description: "People who can help manage your shop.", icon: Users, action: "account" },
  { title: "Payments", description: "Payout and payment information.", icon: CreditCard, action: "payments" },
  { title: "Preferences", description: "Notifications, appearance and other preferences.", icon: Settings, action: "preferences" },
  { title: "Printing & hardware", description: "Receipt printers and payment terminals.", icon: Printer, action: "hardware" },
  { title: "Advanced", description: "Help, diagnostics and technical troubleshooting.", icon: HelpCircle, action: "advanced" },
] as const;

export const MerchantSettingsHome: React.FC<MerchantSettingsHomeProps> = ({
  shop,
  onSelect,
  onOpenStorefront,
  onOpenPayments,
}) => {
  const chooseAction = (action: string) => {
    if (action === "storefront") onOpenStorefront();
    else if (action === "payments") onOpenPayments();
    else onSelect(action);
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5" aria-labelledby="store-status-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${shop?.is_active ? "bg-emerald-500" : "bg-on-surface-variant/40"}`} aria-hidden="true" />
            <div>
              <h3 id="store-status-heading" className="font-bold text-on-surface">
                {shop?.is_active ? "Your shop is online" : "Your shop is offline"}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                {shop?.is_active ? "Customers can place orders." : "Customers can't place orders right now."}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onSelect("operations")} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50">
            {shop?.is_active ? "Manage status" : "Go online"}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {settingsCards.map(({ title, description, icon: Icon, action }) => (
          <button key={title} type="button" onClick={() => chooseAction(action)} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/50">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={20} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-on-surface">{title}</span><span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{description}</span></span>
            <ChevronRight size={18} className="shrink-0 text-on-surface-variant/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
};
