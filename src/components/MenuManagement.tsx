import React, { useState, useEffect, useCallback, useMemo } from "react";
import Fuse from "fuse.js";
import { List } from "react-window";
import {
  Plus,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  UtensilsCrossed,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";

import { MenuItem, Shop, User } from "../types";
import { supabase } from "../lib/supabase";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { cn } from "../lib/utils";
import AIMenuScannerModal from "./AIMenuScannerModal";


export const DIETARY_TAGS = [
  "Halal",
  "Vegan",
  "Vegetarian",
  "Gluten-Free",
  "Spicy",
  "Dairy-Free",
  "Nut-Free",
  "Keto",
];

export const FoodPlaceholder = ({ size = 48 }: { size?: number }) => (
  <div className="w-full h-full bg-surface-container flex flex-col items-center justify-center text-on-surface-variant/40">
    <UtensilsCrossed size={size} />
  </div>
);

const isPlaceholderImage = (url?: string) => {
  if (!url) return true;
  return (
    url.includes("placeholder.com") ||
    url.includes("via.placeholder") ||
    url.includes("food-placeholder")
  );
};

const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop) return false;

  // 1. Permanent Vendor Identifier in Supabase Auth user_metadata (Highest Priority)
  if (user?.user_metadata?.vendor_shop_id && String(shop.id) === String(user.user_metadata.vendor_shop_id)) {
    return true;
  }
  if (user?.user_metadata?.shop_id && String(shop.id) === String(user.user_metadata.shop_id)) {
    return true;
  }

  // 2. Permanent Vendor Identifier in LocalStorage
  try {
    const vendorShopId = localStorage.getItem("localeats_vendor_shop_id");
    if (vendorShopId && String(shop.id) === String(vendorShopId)) return true;
  } catch {
    // ignore
  }

  // 3. Database direct owner matching
  if (user && shop.owner_id === user.id) return true;

  // 4. Vendor Email matching
  if (user?.email && shop.email && shop.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;

  // 5. Default single-vendor shop fallback ("My-Kota" / shop ID 18)
  if (user && (shop.id === 18 || (shop.name && shop.name.toLowerCase().includes("kota")))) return true;

  // 6. Local cache shop ID fallback
  try {
    const savedShopId = localStorage.getItem("localeats_my_shop_id");
    if (savedShopId && String(shop.id) === String(savedShopId)) return true;
    const lastShopId = localStorage.getItem("localeats_last_selected_shop_id");
    if (lastShopId && String(shop.id) === String(lastShopId)) return true;
  } catch {
    // ignore
  }

  return false;
};

const isValidUUID = (str?: string) => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};

export const validateImageFile = (file: File) => {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return { isValid: false, error: "Please select a valid image file (JPEG, PNG, WebP, or GIF)." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { isValid: false, error: "Image size exceeds 10MB limit." };
  }
  return { isValid: true };
};

export const getCroppedImg = (imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<Blob> => {
  const image = new Image();
  image.src = imageSrc;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  return new Promise((resolve, reject) => {
    image.onload = () => {
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      if (ctx) {
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );
      }
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, "image/jpeg", 0.85);
    };
    image.onerror = (error) => reject(error);
  });
};

export const parseDescriptionAndTags = (descString?: string): { tags: string[]; description: string } => {
  if (!descString) return { tags: [], description: "" };
  const tagRegex = /\[Tags:\s*([^\]]+)\]/i;
  const match = descString.match(tagRegex);
  if (match) {
    const tags = match[1].split(",").map((t) => t.trim()).filter(Boolean);
    const cleanDesc = descString.replace(tagRegex, "").trim();
    return { tags, description: cleanDesc };
  }
  return { tags: [], description: descString };
};

interface MenuManagementProps {
  shops: Shop[];
  loading: boolean;
  user: User | null;
  onRefreshMenu?: () => void;
  setIsSaving?: (val: boolean) => void;
  setIsSaveSuccess?: (val: boolean) => void;
  isSaving?: boolean;
  dataSaverMode?: boolean;
}

export const MenuManagement: React.FC<MenuManagementProps> = ({
  shops,
  user,
}) => {

  const { subscribeWithAuthGuard } = useAuthGuard();
  const userOwnedShops = useMemo(
    () => shops.filter((s) => isShopOwnedByUser(s, user)),
    [shops, user]
  );

  useEffect(() => {
    if (user && userOwnedShops.length > 0) {
      userOwnedShops.forEach((s) => {
        if (s.owner_id !== user.id && isValidUUID(user.id)) {
          supabase
            .from("shops")
            .update({ owner_id: user.id })
            .eq("id", s.id)
            .then()
            .catch(() => {});
        }
      });
    }
  }, [userOwnedShops, user]);

  const [selectedShopId, setSelectedShopId] = useState<number | null>(() => {
    const found = shops.find((s) => isShopOwnedByUser(s, user));
    return found ? found.id : null;
  });

  useEffect(() => {
    const found = shops.find((s) => isShopOwnedByUser(s, user));
    const targetId = found ? found.id : null;
    if (selectedShopId !== targetId) {
      setSelectedShopId(targetId);
    }
  }, [shops, user, selectedShopId]);

  // STALE-WHILE-REVALIDATE Initial state read from LocalStorage
  const [items, setItems] = useState<MenuItem[]>(() => {
    const targetId = selectedShopId;
    try {
      const cached = localStorage.getItem(`localeats_menu_${targetId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const cachedAll = localStorage.getItem("localeats_cached_menu_items");
      if (cachedAll) {
        const parsedAll = JSON.parse(cachedAll);
        if (Array.isArray(parsedAll)) {
          const matched = parsedAll.filter((i: MenuItem) => String(i.shop_id) === String(targetId));
          if (matched.length > 0) return matched;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(() => {
    return items.length === 0;
  });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);

  const [activeMenuSection, setActiveMenuSection] = useState<"list" | "form">("list");

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "Main Course",
    description: "",
    stock_quantity: "10",
    is_unlimited: false,
  });
  const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([]);
  const [, setImageFile] = useState<File | null>(null);
  const [, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);


  // 1. FUSE.JS CLIENT-SIDE SEARCH INDEXING
  const fuseIndex = useMemo(() => {
    return new Fuse(items, {
      keys: [
        { name: "name", weight: 0.5 },
        { name: "description", weight: 0.3 },
        { name: "category", weight: 0.2 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    let source = items;

    if (searchTerm && searchTerm.trim().length > 0) {
      const fuseResults = fuseIndex.search(searchTerm.trim());
      source = fuseResults.map((r) => r.item);
    }

    return source.filter((item) => {
      const matchesCategory = filterCategory === "All" || item.category === filterCategory;
      return matchesCategory;
    });
  }, [items, searchTerm, fuseIndex, filterCategory]);

  const categories = useMemo(() => {
    const defaultCats = [
      "All",
      "Breakfast Menu",
      "Eggs Menu",
      "Toast Bread",
      "Sandwiches",
      "Main Course",
      "Appetizers",
      "Desserts",
      "Beverages",
    ];
    items.forEach((item) => {
      if (item.category && !defaultCats.includes(item.category)) {
        defaultCats.push(item.category);
      }
    });
    return defaultCats;
  }, [items]);

  // 2. STALE-WHILE-REVALIDATE FETCH METHOD
  const fetchMenu = useCallback(
    async (showLoadingSpinner = true) => {
      if (!selectedShopId) {
        setIsMenuLoading(false);
        return;
      }
      if (showLoadingSpinner) {
        setIsMenuLoading(true);
      } else {
        setIsBackgroundSyncing(true);
      }

      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("shop_id", selectedShopId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const freshItems = data || [];
        setItems(freshItems);
        try {
          localStorage.setItem(`localeats_menu_${selectedShopId}`, JSON.stringify(freshItems));
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("Error fetching menu items:", err);
      } finally {
        setIsMenuLoading(false);
        setIsBackgroundSyncing(false);
      }
    },
    [selectedShopId]
  );

  useEffect(() => {
    if (selectedShopId) {
      let hasCached = false;
      try {
        const cached = localStorage.getItem(`localeats_menu_${selectedShopId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setIsMenuLoading(false);
            hasCached = true;
          }
        }
      } catch {
        // ignore
      }

      if (!hasCached) {
        setIsMenuLoading(true);
      }

      void fetchMenu(!hasCached);

      let isMounted = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activeChannel: any = null;

      void subscribeWithAuthGuard(`menu_items_${selectedShopId}`, (ch) =>
        ch.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_items",
            filter: `shop_id=eq.${selectedShopId}`,
          },
          () => {
            void fetchMenu(false);
          }
        )
      ).then((ch) => {
        if (ch) {
          if (isMounted) activeChannel = ch;
          else void supabase.removeChannel(ch);
        }
      });

      return () => {
        isMounted = false;
        if (activeChannel) void supabase.removeChannel(activeChannel);
      };
    }
  }, [selectedShopId, fetchMenu, subscribeWithAuthGuard]);

  const handleAdd = () => {
    setEditingItem(null);
    setSelectedDietaryTags([]);
    setFormData({
      name: "",
      price: "",
      category: "Main Course",
      description: "",
      stock_quantity: "10",
      is_unlimited: false,
    });
    setImageFile(null);
    setImagePreview(null);
    setActiveMenuSection("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    const { tags, description } = parseDescriptionAndTags(item.description);
    setSelectedDietaryTags(tags);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category || "Main Course",
      description: description,
      stock_quantity: item.stock_quantity?.toString() || "10",
      is_unlimited: item.stock_quantity === null || item.stock_quantity === -1,
    });
    setImageFile(null);
    setImagePreview(item.image_url || null);
    setActiveMenuSection("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price || !selectedShopId) {
      toast.error("Please enter a name and price.");
      return;
    }

    setIsSaving(true);
    try {
      const fullDescription = formData.description + (selectedDietaryTags.length > 0 ? ` [${selectedDietaryTags.join(", ")}]` : "");
      
      const payload = {
        shop_id: selectedShopId,
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        description: fullDescription,
        stock_quantity: formData.is_unlimited ? null : parseInt(formData.stock_quantity || "0"),
        is_available: editingItem ? editingItem.is_available : true,
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        const { error } = await supabase.from("menu_items").insert({
          ...payload,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
        toast.success("Item added");
      }
      
      void fetchMenu(false);
      setActiveMenuSection("list");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg || "Failed to save item");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    // Optimistic Update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: !item.is_available } : i))
    );

    const { error } = await supabase
      .from("menu_items")
      .update({
        is_available: !item.is_available,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      // Rollback
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: item.is_available } : i))
      );
      toast.error("We couldn't update availability. Please try again.");
    } else {
      toast.success(`${item.name} is now ${!item.is_available ? "available" : "unavailable"}`);
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((i) => i.id));
    }
  };

  const handleQuickPriceUpdate = async (itemId: number, newPriceStr: string) => {
    const val = parseFloat(newPriceStr);
    if (isNaN(val) || val < 0) {
      setEditingPriceId(null);
      return;
    }
    setEditingPriceId(null);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, price: val } : i)));

    const { error } = await supabase
      .from("menu_items")
      .update({ price: val, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to update price.");
      void fetchMenu(false);
    } else {
      toast.success("Price updated successfully");
    }
  };

  // Render Card Component for each item
  const renderItemCard = (item: MenuItem) => {
    const isLowStock =
      item.stock_quantity !== null &&
      item.stock_quantity !== undefined &&
      item.stock_quantity !== -1 &&
      (item.stock_quantity || 0) < 5;


    return (
      <div
        key={item.id}
        className={cn(
          "group relative bg-surface-container-lowest rounded-2xl md:rounded-[2rem] overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 border flex flex-col justify-between h-full p-4 mb-3",
          selectedItems.includes(item.id)
            ? "ring-2 ring-primary ring-offset-2 border-primary/25"
            : isLowStock
            ? "border-red-500/30 bg-red-500/[0.01]"
            : "border-outline-variant/10"
        )}
      >
        <button
          onClick={() => toggleSelectItem(item.id)}
          className={cn(
            "absolute top-3 left-3 z-20 p-2 rounded-xl transition-all shadow-lg cursor-pointer",
            selectedItems.includes(item.id)
              ? "bg-primary text-on-primary scale-110"
              : "bg-surface-container-highest/60 text-on-surface-variant backdrop-blur-md border border-outline-variant/10"
          )}
        >
          {selectedItems.includes(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>

        <div className="relative h-36 bg-surface-container rounded-xl flex items-center justify-center overflow-hidden shrink-0">
          {!isPlaceholderImage(item.image_url) ? (
            <img
              className={cn(
                "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500",
                !item.is_available && "grayscale opacity-50"
              )}
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <FoodPlaceholder size={44} />
          )}
          {(!item.is_available || item.stock_quantity === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-xs">
              <span className="bg-error text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                {!item.is_available ? "Unavailable" : "Out of Stock"}
              </span>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-surface/90 backdrop-blur-md px-2.5 py-1 rounded-full text-primary font-bold text-xs shadow-xs z-30">
            {editingPriceId === item.id ? (
              <input
                type="number"
                step="0.01"
                className="w-16 bg-white dark:bg-zinc-800 text-primary rounded border border-primary/25 px-1 py-0.5 text-xs font-bold outline-none"
                defaultValue={item.price}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickPriceUpdate(item.id, (e.target as HTMLInputElement).value);
                  else if (e.key === "Escape") setEditingPriceId(null);
                }}
                onBlur={(e) => handleQuickPriceUpdate(item.id, e.target.value)}
                autoFocus
              />
            ) : (
              <span
                onClick={() => setEditingPriceId(item.id)}
                className="cursor-pointer font-bold hover:scale-105 transition-all"
              >
                R {Number(item.price || 0).toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                {item.category || "General"}
              </span>
              <button
                onClick={() => toggleAvailability(item)}
                className={cn(
                  "text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider cursor-pointer transition-colors",
                  item.is_available
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                    : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-500/25"
                )}
              >
                {item.is_available ? "Available" : "Hidden"}
              </button>
            </div>

            <h4 className="font-extrabold text-sm text-on-surface line-clamp-1">{item.name}</h4>
            <p className="text-xs text-on-surface-variant/80 line-clamp-2 mt-0.5">
              {parseDescriptionAndTags(item.description).description || "No description provided."}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
            <button
              onClick={() => handleEdit(item)}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              Edit Item
            </button>
            <span className="text-[10px] font-mono font-bold text-on-surface-variant">
              Stock: {item.stock_quantity === null || item.stock_quantity === -1 ? "∞" : item.stock_quantity}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // 3. REACT-WINDOW VIRTUALIZED LIST ROW RENDERER
  const VirtualRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index];
    if (!item) return null;
    return <div style={style}>{renderItemCard(item, index)}</div>;
  };

  return (
    <div className="w-full space-y-6">
      {/* Background Revalidating Indicator */}
      {isBackgroundSyncing && (
        <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <RotateCw size={14} className="animate-spin text-emerald-600" />
            <span>Syncing latest menu data in background...</span>
          </div>
          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">SWR Active</span>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
            <UtensilsCrossed size={22} className="text-primary" />
            <span>Menu & Inventory Management</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage your food items, instant stock, prices, and dietary flags.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleAdd}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add New Item</span>
          </button>
          <button
            onClick={() => setIsAiScannerOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-all cursor-pointer border border-outline-variant/20"
          >
            <Sparkles size={16} className="text-amber-500" />
            <span className="hidden md:inline">Scan Menu PDF/Image</span>
          </button>
        </div>
      </div>

      {/* Main List View */}
      {activeMenuSection === "list" && (
        <div className="space-y-4">
          {/* Fuse.js Instant Search Bar & Filters */}
          <div className="bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/15 space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-3.5 text-on-surface-variant/60" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Instant Fuse.js Search by item name, ingredient, tag or category..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchTerm && (
                <span className="absolute right-3.5 top-3.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Fuse Indexed
                </span>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer",
                    filterCategory === cat
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Item Count and Bulk Actions Bar */}
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-on-surface-variant">
              Showing {filteredItems.length} of {items.length} items
            </span>
            {filteredItems.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                {selectedItems.length === filteredItems.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {/* Render Items with Virtualization or Responsive Grid */}
          {isMenuLoading ? (
            <div className="py-20 text-center space-y-3 bg-surface-container-lowest rounded-3xl border border-outline-variant/15">
              <RotateCw size={32} className="animate-spin text-primary mx-auto" />
              <p className="text-xs font-bold text-on-surface-variant">Loading menu inventory...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center space-y-3 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-6">
              <UtensilsCrossed size={40} className="text-on-surface-variant/40 mx-auto" />
              <h3 className="font-extrabold text-base text-on-surface">No menu items found</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                {searchTerm ? "No items match your Fuse.js search query." : "Start adding your items to get orders!"}
              </p>
            </div>
          ) : filteredItems.length > 20 ? (
            /* Virtualized Window for Large Inventory */
            <div className="bg-surface-container-lowest p-2 rounded-3xl border border-outline-variant/15">
              <List
                height={600}
                itemCount={filteredItems.length}
                itemSize={220}
                width="100%"
              >
                {VirtualRow}
              </List>
            </div>
          ) : (
            /* Standard Grid for Standard Inventory Size */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item, idx) => renderItemCard(item, idx))}
            </div>
          )}
        </div>
      )}

      {/* Form View */}
      {activeMenuSection === "form" && (
        <form onSubmit={handleSave} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 space-y-4">
          <h3 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
            <UtensilsCrossed size={22} className="text-primary" />
            <span>{editingItem ? "Edit Item" : "Add New Item"}</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g. Classic Burger"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1">Price (R)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Mains, Sides"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none"
                placeholder="Describe this item..."
              />
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="unlimitedStock"
                checked={formData.is_unlimited}
                onChange={(e) => setFormData({ ...formData, is_unlimited: e.target.checked })}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <label htmlFor="unlimitedStock" className="text-sm font-medium text-on-surface cursor-pointer">
                Unlimited Stock
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/15 mt-6">
             <button
                type="button"
                onClick={() => setActiveMenuSection("list")}
                className="px-6 py-2.5 bg-surface-container-high text-on-surface font-bold text-sm rounded-xl hover:bg-surface-container-highest cursor-pointer"
             >
                Cancel
             </button>
             <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-70 flex items-center gap-2"
             >
                {isSaving ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Item"
                )}
             </button>
          </div>
        </form>
      )}

      {/* AI Scanner Modal */}
      <AIMenuScannerModal
        isOpen={isAiScannerOpen}
        onClose={() => setIsAiScannerOpen(false)}
        shopId={selectedShopId}
        onItemsImported={() => fetchMenu(true)}
      />
    </div>
  );
};

export default MenuManagement;
