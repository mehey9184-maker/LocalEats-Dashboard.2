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
  Upload,
  Image as ImageIcon,
  X,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { MenuItem, Shop, User } from "../types";
import { supabase } from "../lib/supabase";
import {
  getFirestoreMenuItems,
  createFirestoreMenuItem,
  updateFirestoreMenuItem,
  subscribeToMenuItemsFirestore,
} from "../lib/firebase";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { cn } from "../lib/utils";
import { uploadImageToCloudinary, getOptimizedCloudinaryUrl } from "../lib/cloudinary";
import AIMenuScannerModal from "./AIMenuScannerModal";
import { isShopOwnedByUser, isValidUUID } from "../utils/shopOwnership";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VirtualizedList = List as any;

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

  const [selectedShopId, setSelectedShopId] = useState<string | number | "all">(() => {
    try {
      const saved = localStorage.getItem("localeats_selected_menu_shop_id");
      if (saved) {
        if (saved === "all") return "all";
        const match = shops.find((s) => String(s.id) === String(saved));
        if (match) return match.id;
      }
    } catch {
      // ignore
    }

    // Check if any owned shop has items in cached menu
    try {
      const cachedAll = localStorage.getItem("localeats_cached_menu_items");
      if (cachedAll) {
        const parsedAll = JSON.parse(cachedAll);
        if (Array.isArray(parsedAll) && parsedAll.length > 0) {
          const shopWithItems = shops.find((s) =>
            isShopOwnedByUser(s, user) &&
            parsedAll.some((item: MenuItem) => String(item.shop_id) === String(s.id))
          );
          if (shopWithItems) return shopWithItems.id;
        }
      }
    } catch {
      // ignore
    }

    const found = shops.find((s) => isShopOwnedByUser(s, user));
    return found ? found.id : "all";
  });

  // Ensure selectedShopId stays valid if shops change, but don't reset manual user selections
  useEffect(() => {
    if (selectedShopId !== "all") {
      const exists = shops.some((s) => String(s.id) === String(selectedShopId));
      if (!exists && userOwnedShops.length > 0) {
        setSelectedShopId(userOwnedShops[0].id);
      }
    }
  }, [shops, selectedShopId, userOwnedShops]);

  // STALE-WHILE-REVALIDATE Initial state read from LocalStorage
  const [items, setItems] = useState<MenuItem[]>(() => {
    const targetId = selectedShopId;
    try {
      if (targetId !== "all") {
        const cached = localStorage.getItem(`localeats_menu_${targetId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      const cachedAll = localStorage.getItem("localeats_cached_menu_items");
      if (cachedAll) {
        const parsedAll = JSON.parse(cachedAll);
        if (Array.isArray(parsedAll)) {
          if (targetId === "all") {
            const ownedIds = new Set(userOwnedShops.map((s) => String(s.id)));
            const matched = parsedAll.filter((i: MenuItem) => ownedIds.has(String(i.shop_id)));
            if (matched.length > 0) return matched;
          } else {
            const matched = parsedAll.filter((i: MenuItem) => String(i.shop_id) === String(targetId));
            if (matched.length > 0) return matched;
          }
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
  const [selectedItems, setSelectedItems] = useState<(number | string)[]>([]);

  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | string | null>(null);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    shop_id: (selectedShopId !== "all" ? selectedShopId : userOwnedShops[0]?.id) || 18,
    name: "",
    price: "",
    category: "Main Course",
    description: "",
    stock_quantity: "10",
    is_unlimited: false,
  });
  const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Clean up object URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Please select a valid image file.");
      e.target.value = "";
      return;
    }

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(previewUrl);
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };


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

  // 2. STALE-WHILE-REVALIDATE DUAL (SUPABASE + FIRESTORE) FETCH METHOD
  const fetchMenu = useCallback(
    async (showLoadingSpinner = true) => {
      const targetShopIds: (string | number)[] = selectedShopId === "all"
        ? userOwnedShops.map((s) => s.id)
        : selectedShopId ? [selectedShopId] : [];

      if (targetShopIds.length === 0) {
        console.log("[MenuManagement] ⚠️ No targetShopIds available to fetch menu items.", {
          user,
          availableShops: shops.map((s) => ({ id: s.id, name: s.name, owner_id: s.owner_id })),
        });
        setIsMenuLoading(false);
        return;
      }
      if (showLoadingSpinner) {
        setIsMenuLoading(true);
      } else {
        setIsBackgroundSyncing(true);
      }

      console.log("[MenuManagement] 🔍 Fetching menu items with shop_id filter:", {
        selectedShopId,
        targetShopIds,
        userEmail: user?.email,
        matchedOwnedShops: userOwnedShops.map((s) => ({ id: s.id, name: s.name, owner_id: s.owner_id })),
      });

      try {
        // Query Supabase
        let sbItems: MenuItem[] = [];
        try {
          const query = supabase.from("menu_items").select("*");
          const { data, error } = targetShopIds.length === 1
            ? await query.eq("shop_id", targetShopIds[0]).order("created_at", { ascending: false })
            : await query.in("shop_id", targetShopIds).order("created_at", { ascending: false });

          console.log("[MenuManagement] 📦 Supabase menu_items query response:", {
            targetShopIds,
            itemCount: (data as any)?.length || 0,
            data,
            error: error ? { message: (error as any).message, details: (error as any).details, code: (error as any).code } : null,
          });

          if (!error && Array.isArray(data)) {
            sbItems = data as MenuItem[];
          }
        } catch (sbErr) {
          console.warn("[MenuManagement] Supabase menu query notice:", sbErr);
        }

        // Query Firestore
        let fsItems: MenuItem[] = [];
        try {
          fsItems = await getFirestoreMenuItems(targetShopIds.length === 1 ? targetShopIds[0] : targetShopIds);
          console.log("[MenuManagement] 🔥 Firestore menu_items query response:", {
            targetShopIds,
            itemCount: fsItems.length,
            items: fsItems,
          });
        } catch (fsErr) {
          console.warn("[MenuManagement] Firestore menu query notice:", fsErr);
        }

        // Merge Firestore and Supabase items, deduplicating by ID or name
        const mergedMap = new Map<string, MenuItem>();
        fsItems.forEach((item) => {
          const key = String(item.id || item.name);
          mergedMap.set(key, {
            ...item,
            is_available: item.is_available !== false,
            stock_quantity: item.stock_quantity ?? null,
          });
        });
        sbItems.forEach((item) => {
          const key = String(item.id || item.name);
          mergedMap.set(key, {
            ...item,
            is_available: item.is_available !== false,
            stock_quantity: item.stock_quantity ?? null,
          });
        });

        const freshItems = Array.from(mergedMap.values());
        console.log("[MenuManagement] ✅ Final merged menu items loaded into state:", {
          selectedShopId,
          targetShopIds,
          totalCount: freshItems.length,
          items: freshItems,
        });

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
    [selectedShopId, user, shops, userOwnedShops]
  );

  useEffect(() => {
    const targetShopIds: (string | number)[] = selectedShopId === "all"
      ? userOwnedShops.map((s) => s.id)
      : selectedShopId ? [selectedShopId] : [];

    if (targetShopIds.length > 0) {
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

      // 1. Subscribe to Supabase realtime changes
      void subscribeWithAuthGuard(`menu_items_${selectedShopId}`, (ch) =>
        ch.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_items",
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

      // 2. Subscribe to Firestore realtime changes
      const unsubFirestore = subscribeToMenuItemsFirestore(
        targetShopIds.length === 1 ? targetShopIds[0] : targetShopIds,
        (updatedFsItems) => {
          if (!isMounted) return;
          console.log("[MenuManagement] 🔔 Realtime Firestore update received:", {
            selectedShopId,
            itemCount: updatedFsItems.length,
            items: updatedFsItems,
          });
          setItems((prev) => {
            const map = new Map<string, MenuItem>();
            prev.forEach((i) => map.set(String(i.id || i.name), i));
            updatedFsItems.forEach((i) => {
              map.set(String(i.id || i.name), {
                ...i,
                is_available: i.is_available !== false,
                stock_quantity: i.stock_quantity ?? null,
              });
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(`localeats_menu_${selectedShopId}`, JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      );

      return () => {
        isMounted = false;
        if (activeChannel) void supabase.removeChannel(activeChannel);
        if (unsubFirestore) unsubFirestore();
      };
    }
  }, [selectedShopId, fetchMenu, subscribeWithAuthGuard, userOwnedShops]);

  const handleAdd = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setEditingItem(null);
    setSelectedDietaryTags([]);
    const defaultShopId = (selectedShopId !== "all" ? selectedShopId : userOwnedShops[0]?.id) || 18;
    setFormData({
      shop_id: defaultShopId,
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
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setEditingItem(item);
    // Prefer explicit dietary_tags array if present; fallback to legacy bracket parser
    const tags = Array.isArray(item.dietary_tags) && item.dietary_tags.length > 0
      ? item.dietary_tags
      : parseDescriptionAndTags(item.description).tags;
    setSelectedDietaryTags(tags);

    // Save description unmodified without embedded tags
    const cleanDesc = Array.isArray(item.dietary_tags) && item.dietary_tags.length > 0
      ? (item.description || "")
      : (parseDescriptionAndTags(item.description).description || item.description || "");

    setFormData({
      shop_id: item.shop_id || (selectedShopId !== "all" ? selectedShopId : userOwnedShops[0]?.id) || 18,
      name: item.name,
      price: item.price.toString(),
      category: item.category || "Main Course",
      description: cleanDesc,
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
    const effectiveShopId = formData.shop_id || (selectedShopId !== "all" ? selectedShopId : userOwnedShops[0]?.id) || 18;
    if (!formData.name.trim() || !formData.price || !effectiveShopId) {
      toast.error("Please enter a name and price.");
      return;
    }

    setIsSaving(true);
    try {
      let finalImageUrl = editingItem ? (editingItem.image_url || null) : null;

      // If a new image file was selected, upload it to Cloudinary first
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          finalImageUrl = await uploadImageToCloudinary(imageFile);
        } catch (uploadErr: unknown) {
          const errMsg = uploadErr instanceof Error ? uploadErr.message : "Failed to upload image to Cloudinary";
          toast.error(errMsg);
          setIsSaving(false);
          setIsUploadingImage(false);
          return; // Abort save so item is not saved with broken or missing URL
        } finally {
          setIsUploadingImage(false);
        }
      } else if (imagePreview === null && editingItem) {
        // If image was explicitly removed
        finalImageUrl = null;
      }

      // Payload separates dietary tags from description and preserves unmodified description
      const payload = {
        shop_id: effectiveShopId,
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        dietary_tags: selectedDietaryTags,
        stock_quantity: formData.is_unlimited ? null : parseInt(formData.stock_quantity || "0"),
        is_available: editingItem ? editingItem.is_available : true,
        image_url: finalImageUrl,
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        // 1. Update in Supabase (if configured)
        try {
          await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
        } catch (sbErr) {
          console.warn("[MenuManagement] Notice updating Supabase menu item:", sbErr);
        }

        // 2. Update in Firestore
        try {
          await updateFirestoreMenuItem(editingItem.id, payload);
        } catch (fsErr) {
          console.warn("[MenuManagement] Notice updating Firestore menu item:", fsErr);
        }

        toast.success("Item updated");
      } else {
        // 1. Insert in Supabase (if configured)
        try {
          await supabase.from("menu_items").insert({
            ...payload,
            created_at: new Date().toISOString()
          });
        } catch (sbErr) {
          console.warn("[MenuManagement] Notice inserting Supabase menu item:", sbErr);
        }

        // 2. Insert in Firestore
        try {
          await createFirestoreMenuItem(payload);
        } catch (fsErr) {
          console.warn("[MenuManagement] Notice inserting Firestore menu item:", fsErr);
        }

        toast.success("Item added");
      }
      
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(null);
      setImagePreview(null);
      void fetchMenu(false);
      setActiveMenuSection("list");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg || "Failed to save item");
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    const nextAvailability = !item.is_available;
    // Optimistic Update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: nextAvailability } : i))
    );

    // Sync Supabase
    try {
      await supabase
        .from("menu_items")
        .update({
          is_available: nextAvailability,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } catch (sbErr) {
      console.warn("[MenuManagement] Notice updating Supabase availability:", sbErr);
    }

    // Sync Firestore
    try {
      await updateFirestoreMenuItem(item.id, {
        is_available: nextAvailability,
        updated_at: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn("[MenuManagement] Notice updating Firestore availability:", fsErr);
    }

    toast.success(`${item.name} is now ${nextAvailability ? "available" : "unavailable"}`);
  };

  const toggleSelectItem = (id: number | string) => {
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

  const handleQuickPriceUpdate = async (itemId: number | string, newPriceStr: string) => {
    const val = parseFloat(newPriceStr);
    if (isNaN(val) || val < 0) {
      setEditingPriceId(null);
      return;
    }
    setEditingPriceId(null);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, price: val } : i)));

    // Sync Supabase
    try {
      await supabase
        .from("menu_items")
        .update({ price: val, updated_at: new Date().toISOString() })
        .eq("id", itemId);
    } catch (sbErr) {
      console.warn("[MenuManagement] Notice updating Supabase price:", sbErr);
    }

    // Sync Firestore
    try {
      await updateFirestoreMenuItem(itemId, {
        price: val,
        updated_at: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn("[MenuManagement] Notice updating Firestore price:", fsErr);
    }

    toast.success("Price updated successfully");
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
              src={getOptimizedCloudinaryUrl(item.image_url)}
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
              {item.dietary_tags && item.dietary_tags.length > 0
                ? (item.description || "No description provided.")
                : (parseDescriptionAndTags(item.description).description || item.description || "No description provided.")}
            </p>
            {item.dietary_tags && item.dietary_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.dietary_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {userOwnedShops.length > 1 && (
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-on-surface-variant/80 bg-surface-container-high/60 px-2 py-0.5 rounded-md w-fit">
                <Store size={10} className="text-primary" />
                <span>{shops.find((s) => String(s.id) === String(item.shop_id))?.name || `Store #${item.shop_id}`}</span>
              </div>
            )}
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
    return <div style={style}>{renderItemCard(item)}</div>;
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

      {/* Multi-Store Switcher (if merchant has more than 1 store) */}
      {userOwnedShops.length > 1 && (
        <div className="flex items-center gap-2 p-2 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-on-surface-variant shrink-0">
            <Store size={14} className="text-primary" />
            <span>Store Filter:</span>
          </div>
          <button
            onClick={() => {
              setSelectedShopId("all");
              try {
                localStorage.setItem("localeats_selected_menu_shop_id", "all");
              } catch {
                // ignore
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer",
              selectedShopId === "all"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            All My Stores ({items.length})
          </button>
          {userOwnedShops.map((shop) => (
            <button
              key={shop.id}
              onClick={() => {
                setSelectedShopId(shop.id);
                try {
                  localStorage.setItem("localeats_selected_menu_shop_id", String(shop.id));
                } catch {
                  // ignore
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5",
                String(selectedShopId) === String(shop.id)
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              )}
            >
              <span>{shop.name}</span>
              <span className="text-[10px] opacity-75 font-mono">#{shop.id}</span>
            </button>
          ))}
        </div>
      )}

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
            <div className="py-16 text-center space-y-3 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-6">
              <UtensilsCrossed size={40} className="text-on-surface-variant/40 mx-auto" />
              <h3 className="font-extrabold text-base text-on-surface">
                {searchTerm
                  ? "No matching menu items"
                  : selectedShopId === "all"
                  ? "No menu items found across your stores"
                  : `No menu items found in "${shops.find((s) => String(s.id) === String(selectedShopId))?.name || `Store #${selectedShopId}`}"`}
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                {searchTerm
                  ? "No items match your search query."
                  : "Start adding items or switch stores to view other inventory."}
              </p>
              {userOwnedShops.length > 1 && selectedShopId !== "all" && (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedShopId("all");
                      try {
                        localStorage.setItem("localeats_selected_menu_shop_id", "all");
                      } catch {
                        // ignore
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer"
                  >
                    View All Stores
                  </button>
                  {userOwnedShops
                    .filter((s) => String(s.id) !== String(selectedShopId))
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedShopId(s.id);
                          try {
                            localStorage.setItem("localeats_selected_menu_shop_id", String(s.id));
                          } catch {
                            // ignore
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-all cursor-pointer"
                      >
                        Switch to {s.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : filteredItems.length > 20 ? (
            /* Virtualized Window for Large Inventory */
            <div className="bg-surface-container-lowest p-2 rounded-3xl border border-outline-variant/15">
              <VirtualizedList
                height={600}
                itemCount={filteredItems.length}
                itemSize={220}
                width="100%"
              >
                {VirtualRow}
              </VirtualizedList>
            </div>
          ) : (
            /* Standard Grid for Standard Inventory Size */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => renderItemCard(item))}
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
            {userOwnedShops.length > 1 && (
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1 flex items-center gap-1.5">
                  <Store size={14} className="text-primary" />
                  <span>Assign to Store</span>
                </label>
                <select
                  value={formData.shop_id}
                  onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none text-xs font-bold"
                >
                  {userOwnedShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (ID: {s.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {/* Photo Upload with Cloudinary direct integration */}
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1.5">
                Item Photo (Cloudinary)
              </label>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="relative w-32 h-32 rounded-2xl bg-surface-container-high border-2 border-dashed border-outline-variant/30 flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview && !isPlaceholderImage(imagePreview) ? (
                    <>
                      <img
                        src={imagePreview.startsWith("blob:") ? imagePreview : getOptimizedCloudinaryUrl(imagePreview)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={isSaving}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all cursor-pointer shadow-md"
                        title="Remove photo"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-on-surface-variant/50 p-2 text-center">
                      <ImageIcon size={28} className="mb-1" />
                      <span className="text-[10px] font-semibold">No Image</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-xl cursor-pointer transition-all border border-outline-variant/20">
                    <Upload size={16} className="text-primary" />
                    <span>{imagePreview ? "Change Photo" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageChange}
                      disabled={isSaving}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    JPEG, PNG, WebP, or GIF up to 10MB. Uploads directly to Cloudinary for fast delivery.
                  </p>
                  {imageFile && (
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ Ready to upload: {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
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

            {/* Dietary Flags */}
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1.5">Dietary Flags</label>
              <div className="flex flex-wrap gap-1.5">
                {DIETARY_TAGS.map((tag) => {
                  const isSelected = selectedDietaryTags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setSelectedDietaryTags((prev) =>
                          isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                        );
                      }}
                      className={cn(
                        "px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary text-on-primary shadow-xs"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
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
                disabled={isSaving}
                className="px-6 py-2.5 bg-surface-container-high text-on-surface font-bold text-sm rounded-xl hover:bg-surface-container-highest cursor-pointer disabled:opacity-50"
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
                    <span>{isUploadingImage ? "Uploading to Cloudinary..." : "Saving Item..."}</span>
                  </>
                ) : (
                  editingItem ? "Update Item" : "Save Item"
                )}
             </button>
          </div>
        </form>
      )}

      {/* AI Scanner Modal */}
      <AIMenuScannerModal
        isOpen={isAiScannerOpen}
        onClose={() => setIsAiScannerOpen(false)}
        selectedShopId={typeof selectedShopId === "number" ? selectedShopId : selectedShopId ? Number(selectedShopId) : null}
        onRefreshMenu={() => void fetchMenu(true)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase={supabase as any}
        defaultCategories={categories}
      />
    </div>
  );
};

export default MenuManagement;
