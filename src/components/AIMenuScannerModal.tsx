import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  X, Camera, Upload, RefreshCw, Sparkles, Check, 
  Trash2, AlertCircle, Info, Wifi, WifiOff, CloudLightning 
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { toast } from "sonner";

interface ScannedItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  selected: boolean;
}

interface SupabaseFilterBuilder {
  eq: (column: string, value: string | number) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
}

interface SupabaseQueryBuilder {
  select: (columns: string) => SupabaseFilterBuilder;
  insert: (records: Record<string, unknown>[]) => Promise<{ error: unknown }>;
}

interface AIMenuScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShopId: number | null;
  onRefreshMenu?: () => void;
  supabase: {
    from: (table: string) => SupabaseQueryBuilder;
  };
  defaultCategories: string[];
}

export default function AIMenuScannerModal({
  isOpen,
  onClose,
  selectedShopId,
  onRefreshMenu,
  supabase,
  defaultCategories,
}: AIMenuScannerModalProps) {
  // Network detection state
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("upload");
  const [cameraState, setCameraState] = useState<"idle" | "streaming" | "captured" | "error">("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [importing, setImporting] = useState(false);
  
  // Offline pending AI process queue
  const [pendingScanQueued, setPendingScanQueued] = useState(false);

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync outstanding offline queues from localStorage to Supabase
  const processOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || !selectedShopId) return;

    const savedQueueStr = localStorage.getItem("localeats_offline_menu_items");
    if (!savedQueueStr) return;

    try {
      const itemsToSync = JSON.parse(savedQueueStr);
      if (Array.isArray(itemsToSync) && itemsToSync.length > 0) {
        toast.promise(
          (async () => {
            const records = itemsToSync.map((item: Record<string, unknown>) => ({
              name: typeof item.name === "string" ? item.name : "",
              price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
              category: typeof item.category === "string" ? item.category : "",
              description: typeof item.description === "string" ? item.description : "",
              shop_id: selectedShopId,
              is_available: true,
              stock_quantity: 10,
            }));

            // Retrieve live current catalog names to dynamically prevent duplication
            const { data: existingItems } = await supabase
              .from("menu_items")
              .select("name")
              .eq("shop_id", selectedShopId);

            const existingNames = new Set((existingItems || []).map((i) => String(i.name).trim().toLowerCase()));
            const finalRecords = records.filter((rec) => !existingNames.has(rec.name.trim().toLowerCase()));

            if (finalRecords.length > 0) {
              const { error } = await supabase.from("menu_items").insert(finalRecords);
              if (error) throw error;
            }

            localStorage.removeItem("localeats_offline_menu_items");
            onRefreshMenu?.();
          })(),
          {
            loading: "Detected offline menu additions. Synchronizing with cloud database...",
            success: "Synced offline menu items cleanly, avoiding any duplicates!",
            error: "Failed to sync offline items. We will try again soon.",
          }
        );
      }
    } catch (e) {
      console.error("Failed to sync offline queue", e);
    }
  }, [selectedShopId, supabase, onRefreshMenu]);

  // Network State Listener & sync triggers
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored! You are back online.");
      processOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are offline. Scanned menus and additions will be queued to post when signal returns.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (navigator.onLine) {
      processOfflineQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [processOfflineQueue]);

  // Reset modal state on mount or close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setUploadedFile(null);
      setFilePreview(null);
      setScannedItems([]);
      setIsScanning(false);
      setCameraState("idle");
      setPendingScanQueued(false);
    }
  }, [isOpen]);

  // Handle webcam start
  const startCamera = async () => {
    setCameraState("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraState("streaming");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraState("error");
      toast.error("Unable to access camera. Please upload an image instead.");
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Switch tabs
  const handleTabChange = (tab: "camera" | "upload") => {
    setActiveTab(tab);
    if (tab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Capture snapshot
  const captureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Set canvas dimensions equal to the video source size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(dataUrl);
        setCameraState("captured");
        stopCamera();
      }
    }
  };

  // Recapture
  const handleRecapture = () => {
    setCapturedImage(null);
    startCamera();
  };

  // File drag & drop or select triggers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
  };

  // Helper: Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  // Main Gemini processing function or Offline Queue
  const runMenuExtraction = async () => {
    let base64Data = "";
    let mimeType = "image/jpeg";

    if (activeTab === "camera" && capturedImage) {
      base64Data = capturedImage.split(",")[1];
      mimeType = "image/jpeg";
    } else if (activeTab === "upload" && uploadedFile) {
      base64Data = await fileToBase64(uploadedFile);
      mimeType = uploadedFile.type;
    } else {
      toast.error("Please capture or upload a menu photo first.");
      return;
    }

    // Check if offline
    if (!isOnline) {
      setPendingScanQueued(true);
      toast.info("Offline Queue Active", {
        description: "Menu image saved in browser memory. We will automatically analysis using Gemini AI the moment your internet is back!",
      });
      return;
    }

    try {
      setIsScanning(true);
      setScanProgress("Scanning text...");
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your environment variables."
        );
      }

      const ai = new GoogleGenAI({ apiKey });

      setTimeout(() => setScanProgress("Detecting dishes & descriptions..."), 1200);
      setTimeout(() => setScanProgress("Formatting prices in South African Rand (R)..."), 2400);
      setTimeout(() => setScanProgress("Sorting items into shop categories..."), 3600);

      const prompt = `You are an expert AI Food Menu Scanner for South African eateries (LocalEats South Africa).
Analyze the printed menu sheet in this image carefully.
Your objective is to extract all food items, including beverages or desserts, returning them as structured menu data.

Extract details including:
1. Item Name (clean, readable human readable text).
2. Price (convert any detected prices to South African Rands as a raw number, e.g. 54.50 instead of R54.50, handle written fractions safely).
3. Description (detail the ingredients, preparation form, items included. Keep it short, appetizing, under 180 characters).
4. Category suggestion. Categorize items into one of the following menu categories, deciding which fits best:
   - "Breakfast Menu" (All breakfast items, standard morning combinations)
   - "Eggs Menu" (Dishes centered on egg preparation, i.e. scrambled, fried on toast, Benedicts)
   - "Toast Bread" (Toasted sandwiches, plain toasts, toasted breads with butter or jams)
   - "Sandwiches" (Subways, high-stack burgers, wraps, fresh sandwiches)
   - "Main Course" (Curries, roasted meals, large standard courses)
   - "Appetizers" (Starters, wings, small snacks)
   - "Desserts" (Sweet pastries, ice cream)
   - "Beverages" (Coffees, cold drinks, fresh juices)
   
All prices must be South African Rand numerals. If multiple sizes/prices exist, create separate lines (e.g. "Small Filter Coffee" at R18.00 and "Large Filter Coffee" at R25.00).

Return ONLY a valid JSON array of objects of the exact format below, without any markdown formatting or surrounding string labels.
Example JSON:
[
  {
    "name": "Classic Breakfast",
    "price": 65.00,
    "category": "Breakfast Menu",
    "description": "2 fried eggs, grilled bacon, pork sausage, roasted tomato, and 1 slice of toasted sourdough"
  },
  {
    "name": "Single Scrambled Egg Toast",
    "price": 35.00,
    "category": "Eggs Menu",
    "description": "Creamy scrambled eggs served on toasted white bread"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text?.trim() || "";
      const parsedArray = JSON.parse(resultText);

      if (Array.isArray(parsedArray)) {
        const enriched: ScannedItem[] = parsedArray.map((item: Record<string, unknown>, idx: number) => ({
          id: `${Date.now()}-${idx}`,
          name: typeof item.name === "string" ? item.name : "Untitled Dish",
          price: typeof item.price === "number" ? item.price : parseFloat(String(item.price)) || 0,
          category: typeof item.category === "string" ? item.category : "Main Course",
          description: typeof item.description === "string" ? item.description : "",
          selected: true,
        }));
        setScannedItems(enriched);
        setPendingScanQueued(false);
        toast.success(`Successfully scanned ${enriched.length} dishes from the menu!`);
      } else {
        throw new Error("Returned content is not a valid JSON array.");
      }
    } catch (err: unknown) {
      console.error("Scanning Error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      toast.error("We couldn't extract items from the image. Please try another clear angle/photo.", {
        description: errorMessage,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger scanning when network comes back online if auto-queued
  useEffect(() => {
    if (isOnline && pendingScanQueued && !isScanning && (capturedImage || uploadedFile)) {
      toast.success("Connection detected! Auto-triggering menu scanner from offline queue...");
      runMenuExtraction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingScanQueued]);

  // Handle adding manually during offline scenarios to build fast draft lists
  const handleAddNewManualItem = () => {
    const newItem: ScannedItem = {
      id: `${Date.now()}`,
      name: "",
      price: 0,
      category: defaultCategories.includes("Breakfast Menu") ? "Breakfast Menu" : defaultCategories[1] || "Main Course",
      description: "",
      selected: true,
    };
    setScannedItems((prev) => [...prev, newItem]);
  };

  // Modify individual scanned item state
  const handleEditItem = <K extends keyof ScannedItem>(id: string, field: K, value: ScannedItem[K]) => {
    setScannedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Delete individual parsed row
  const handleDeleteRow = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Handle Bulk DB Import / LocalStorage Sync Caching
  const handleBulkImport = async () => {
    if (!selectedShopId) {
      toast.error("Please ensure a valid shop is active to import menu items.");
      return;
    }

    const itemsToImport = scannedItems.filter((i) => i.selected);
    if (itemsToImport.length === 0) {
      toast.error("Please select at least one menu item to import.");
      return;
    }

    // Checking if offline to cache queue in localStorage
    if (!isOnline) {
      try {
        const existingOffline = localStorage.getItem("localeats_offline_menu_items");
        const parsedExisting = existingOffline ? JSON.parse(existingOffline) : [];
        const updatedList = [...parsedExisting, ...itemsToImport];
        localStorage.setItem("localeats_offline_menu_items", JSON.stringify(updatedList));

        toast.warning("Items Saved Offline!", {
          description: `You are currently offline. We've queued ${itemsToImport.length} menu items. They will auto-sync with Supabase as soon as your connection stays stable!`,
        });

        onClose();
        setScannedItems([]);
      } catch (err) {
        console.error("Failed to serialize offline scan queue", err);
        toast.error("An error occurred trying to queue offline creations.");
      }
      return;
    }

    setImporting(true);
    try {
      // Check for duplicates first by fetching currently active menu item names
      const { data: existingItems, error: fetchError } = await supabase
        .from("menu_items")
        .select("name")
        .eq("shop_id", selectedShopId);

      if (fetchError) throw fetchError;

      const existingNames = new Set((existingItems || []).map((i) => String(i.name).trim().toLowerCase()));

      const finalRecordsToInsert: Record<string, unknown>[] = [];
      const skippedDuplicates: string[] = [];

      itemsToImport.forEach((item) => {
        const trimmedName = item.name.trim();
        if (existingNames.has(trimmedName.toLowerCase())) {
          skippedDuplicates.push(trimmedName);
        } else {
          finalRecordsToInsert.push({
            name: trimmedName,
            price: item.price,
            category: item.category,
            description: item.description,
            shop_id: selectedShopId,
            is_available: true,
            stock_quantity: 10,
          });
          // Avoid creating duplicates in the same batch
          existingNames.add(trimmedName.toLowerCase());
        }
      });

      if (finalRecordsToInsert.length === 0) {
        toast.warning("Duplicate items detected", {
          description: "All selected items are already present in your menu catalog.",
        });
        setImporting(false);
        return;
      }

      const { error } = await supabase.from("menu_items").insert(finalRecordsToInsert);
      if (error) throw error;

      if (skippedDuplicates.length > 0) {
        toast.success(`Imported ${finalRecordsToInsert.length} items successfully!`, {
          description: `Skipped ${skippedDuplicates.length} duplicate(s): ${skippedDuplicates.slice(0, 3).join(", ")}${skippedDuplicates.length > 3 ? "..." : ""}`,
        });
      } else {
        toast.success(`Hooray! ${finalRecordsToInsert.length} items added into your food menu successfully.`);
      }

      onRefreshMenu?.();
      onClose();
    } catch (err: unknown) {
      console.error("Bulk Import Error:", err);
      toast.error("Failed to import items to Supabase database. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="menu-scanner-title" className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative bg-surface p-6 sm:p-8 rounded-[2.5rem] shadow-[0_24px_50px_-12px_rgba(167,52,0,0.15)] border border-outline-variant/10 w-full max-w-4xl max-h-[90vh] flex flex-col justify-between overflow-hidden transform scale-100 opacity-100 transition-all duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-headline text-on-surface">
                  AI Menu Scanner & Creator
                </h3>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                    <Wifi size={10} />
                    Online Mode
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse">
                    <WifiOff size={10} />
                    Offline Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant font-medium">
                Instantly populate your menu using your device camera or an uploaded printed catalog
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:bg-surface-container/30 hover:text-on-surface rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Inner Body */}
        <div className="flex-1 overflow-y-auto pt-6 pb-4 min-h-[350px]">
          {/* Offline Sync Banner if active */}
          {!isOnline && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl p-3.5 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
              <CloudLightning size={16} className="mt-0.5 shrink-0 animate-bounce" />
              <div className="space-y-1">
                <span className="font-bold">Offline Resilience Enabled</span>
                <p className="text-amber-700/80 leading-relaxed">
                  You are currently offline. You can still snap images or add items manually! They will be cached in local memory and instantly synchronized as soon as the signal returns!
                </p>
              </div>
            </div>
          )}

          {scannedItems.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch h-full">
              {/* Selector Sidebar */}
              <div className="space-y-6 flex flex-col justify-between">
                <div>
                  <h4 className="text-md font-bold text-on-surface">Step 1: Provide Your Menu Photo</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Take a picture clearly showing the dish names, detail strings, and prices. Ensure the printed page is flat and well-lit.
                  </p>

                  {/* Tab switches */}
                  <div className="flex gap-2 mt-4 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/5">
                    <button
                      type="button"
                      onClick={() => handleTabChange("upload")}
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        activeTab === "upload"
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40"
                      }`}
                    >
                      <Upload size={14} />
                      Uploader
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange("camera")}
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        activeTab === "camera"
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40"
                      }`}
                    >
                      <Camera size={14} />
                      Live Camera
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 text-[11px] text-on-surface-variant/80 flex items-start gap-2.5">
                  <Info size={14} className="text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-semibold text-on-surface block">AI Features Supported:</span>
                    <p className="leading-relaxed">
                      Custom categorization, prices automatically configured to Rands, dietary keyword labeling, and temporary unlimited quantities!
                    </p>
                  </div>
                </div>

                {/* Scan Action */}
                <div className="space-y-3">
                  <button
                    onClick={runMenuExtraction}
                    disabled={
                      isScanning || (activeTab === "upload" ? !uploadedFile : !capturedImage)
                    }
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {scanProgress}
                      </>
                    ) : pendingScanQueued ? (
                      <>
                        <Check size={16} />
                        Queued for Auto-Scan!
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {isOnline ? "Analyze Menu with AI" : "Queue Image for Offline Scan"}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAddNewManualItem}
                    className="w-full py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container rounded-xl transition-all border border-outline-variant/15 flex items-center justify-center gap-1.5"
                  >
                    Create Manual Draft Rows
                  </button>
                </div>
              </div>

              {/* View capture/upload container */}
              <div className="bg-surface-container-low border border-outline-variant/10 rounded-[1.5rem] overflow-hidden relative flex flex-col items-center justify-center min-h-[300px]">
                {/* Drag and Drop / File Input */}
                {activeTab === "upload" && (
                  <div className="w-full h-full p-4 flex flex-col items-center justify-center">
                    {!filePreview ? (
                      <label className="w-full h-full min-h-[250px] border-2 border-dashed border-outline-variant/50 hover:border-primary/50 transition-colors rounded-2xl flex flex-col items-center justify-center cursor-pointer p-6 space-y-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-xs font-semibold text-on-surface">Click to upload menu sheet</p>
                          <p className="text-[10px] text-on-surface-variant">PNG, JPG, or WEBP up to 8MB</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    ) : (
                      <div className="relative w-full h-full flex flex-col justify-between">
                        <div className="relative rounded-xl overflow-hidden aspect-video border border-outline-variant/10 max-h-[220px]">
                          <img
                            src={filePreview}
                            alt="Uploaded menu"
                            className="w-full h-full object-contain bg-black/5"
                          />
                          {isScanning && (
                            <div className="absolute inset-0 bg-black/10">
                              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent h-1.5 absolute top-0 shadow-lg shadow-primary animate-[bounce_2s_infinite]" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={removeFile}
                          className="mt-4 w-full py-2.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"
                        >
                          Remove Photo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Webcam capture wrapper */}
                {activeTab === "camera" && (
                  <div className="w-full h-full min-h-[250px] flex flex-col justify-between p-4">
                    {cameraState === "captured" && capturedImage ? (
                      <div className="relative w-full h-full flex flex-col justify-between">
                        <div className="relative rounded-xl overflow-hidden aspect-video border border-outline-variant/10 max-h-[220px]">
                          <img
                            src={capturedImage}
                            alt="Captured snapshot"
                            className="w-full h-full object-contain bg-black/5"
                          />
                          {isScanning && (
                            <div className="absolute inset-0 bg-black/10">
                              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent h-1.5 absolute top-0 shadow-lg shadow-primary animate-[bounce_2s_infinite]" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleRecapture}
                          className="mt-4 w-full py-2.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw size={12} />
                          Retake Snapshot
                        </button>
                      </div>
                    ) : (
                      <div className="relative flex-1 flex flex-col items-center justify-center">
                        {cameraState === "error" ? (
                          <div className="text-center p-6 space-y-3">
                            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                            <p className="text-xs font-semibold text-on-surface">Webcam was disabled or unavailable</p>
                            <p className="text-[10px] text-on-surface-variant leading-relaxed max-w-xs">
                              Please allow browser webcam exceptions or select the Uploader tab to upload a file snapshot.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="relative rounded-xl overflow-hidden border border-outline-variant/10 aspect-video w-full max-h-[210px] bg-black">
                              <video
                                ref={videoRef}
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={captureSnapshot}
                              className="mt-4 w-12 h-12 rounded-full border-4 border-primary bg-surface shadow-md hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center shrink-0"
                              title="Take Photo"
                            >
                              <div className="w-8 h-8 rounded-full bg-primary" />
                            </button>
                          </>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Scanned items review section */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-md font-bold text-on-surface">Step 2: Review Extract Outcomes</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Verify names, descriptions, pricing Rands, and modify matching catalog categories. Deselect items you want to skip.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNewManualItem}
                    className="px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors flex items-center gap-1"
                  >
                    + Add New Row
                  </button>
                  <button
                    onClick={() => setScannedItems([])}
                    className="px-3.5 py-1.5 text-xs font-bold bg-surface-container/30 hover:bg-surface-container text-on-surface rounded-xl transition-colors border border-outline-variant/10 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    Start Over/Scan
                  </button>
                </div>
              </div>

              {/* Parsed List Container */}
              <div className="border border-outline-variant/10 rounded-[1.5rem] overflow-hidden bg-surface-container-lowest max-h-[350px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/10 font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      <th className="py-3 px-4 w-10 text-center">Include</th>
                      <th className="py-3 px-4 min-w-[150px]">Item Name</th>
                      <th className="py-3 px-4 w-[120px]">Price (ZAR)</th>
                      <th className="py-3 px-4 min-w-[150px]">Category</th>
                      <th className="py-3 px-4 min-w-[200px]">Description</th>
                      <th className="py-3 px-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scannedItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`border-b border-outline-variant/10 text-xs transition-colors hover:bg-surface-container/10 ${
                          !item.selected ? "opacity-60 bg-black/5" : ""
                        }`}
                      >
                        {/* Selector checkbox */}
                        <td className="py-2 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => handleEditItem(item.id, "selected", e.target.checked)}
                            className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                        </td>
                        
                        {/* Title input */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleEditItem(item.id, "name", e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary focus:bg-surface rounded p-1.5 text-xs font-semibold text-on-surface border-b border-outline/10 focus:border-primary"
                            placeholder="Type dish name..."
                            disabled={!item.selected}
                          />
                        </td>

                        {/* Price input */}
                        <td className="py-2 px-2">
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-[11px] text-on-surface-variant">R</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => handleEditItem(item.id, "price", parseFloat(e.target.value) || 0)}
                              className="w-full pl-5 bg-transparent border-none focus:ring-1 focus:ring-primary focus:bg-surface rounded p-1.5 text-xs font-semibold text-on-surface border-b border-outline/10 focus:border-primary"
                              placeholder="0.00"
                              disabled={!item.selected}
                              step="0.01"
                            />
                          </div>
                        </td>

                        {/* Category selection */}
                        <td className="py-2 px-2">
                          <select
                            value={item.category}
                            onChange={(e) => handleEditItem(item.id, "category", e.target.value)}
                            className="bg-transparent border-none focus:ring-1 focus:ring-primary focus:bg-surface rounded p-1.5 text-xs font-semibold text-on-surface cursor-pointer w-full border-b border-outline/10"
                            disabled={!item.selected}
                          >
                            {/* Filter default empty strings */}
                            {defaultCategories.filter(c => c !== "All").map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            {/* Safe fallbacks block */}
                            {!defaultCategories.includes(item.category) && (
                              <option value={item.category}>{item.category}</option>
                            )}
                          </select>
                        </td>

                        {/* Description input */}
                        <td className="py-2 px-2">
                          <textarea
                            value={item.description}
                            onChange={(e) => handleEditItem(item.id, "description", e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary focus:bg-surface rounded p-1.5 text-xs font-medium text-on-surface-variant resize-y min-h-[32px] max-h-[70px] border-b border-outline/10 focus:border-primary"
                            placeholder="Add ingredients or brief summary..."
                            disabled={!item.selected}
                          />
                        </td>

                        {/* Action buttons */}
                        <td className="py-2 px-4 text-center">
                          <button
                            onClick={() => handleDeleteRow(item.id)}
                            className="p-1 px-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Delete Row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action Button footer */}
        {scannedItems.length > 0 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-outline-variant/10">
            <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
              {!isOnline && <CloudLightning size={12} className="text-amber-500 animate-pulse" />}
              {isOnline ? "Ready to upload" : "Will queue locally for sync:"} {scannedItems.filter(i => i.selected).length} Items selected
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setScannedItems([])}
                className="px-5 py-3 rounded-xl border border-outline-variant/15 text-on-surface text-xs font-bold hover:bg-surface-container-high/30 transition-all"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={importing || scannedItems.filter(i => i.selected).length === 0}
                className="px-6 py-3 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Adding items...
                  </>
                ) : (
                  <>
                    <Check size={14} className="stroke-[2.5px]" />
                    {isOnline ? "Import Selected Items" : "Save Offline Draft Queue"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

