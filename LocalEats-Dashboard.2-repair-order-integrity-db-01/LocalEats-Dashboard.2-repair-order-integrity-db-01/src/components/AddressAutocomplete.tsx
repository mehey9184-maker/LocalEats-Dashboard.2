import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import {
  parseAndNormalizeZAAddress,
  getZASuburbFuzzyMatches,
} from "../utils";

interface OSMPrediction {
  place_id?: number | string;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
  };
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (address: string, city: string, lat: number, lng: number) => void;
  placeholder?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = "Search address...",
}) => {
  const [predictions, setPredictions] = useState<OSMPrediction[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!value || value.length < 3) {
        setPredictions([]);
        return;
      }

      try {
        const query = `${value} Tembisa Midrand South Africa`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query,
          )}&format=json&addressdetails=1&limit=5&countrycodes=za&email=aviwenotununu4@gmail.com`,
          {
            signal: controller.signal,
            headers: {
              "Accept-Language": "en",
            },
          },
        );
        clearTimeout(timeout);
        if (!response.ok) {
          setPredictions([]);
          return;
        }
        const data = await response.json();
        setPredictions((data as OSMPrediction[]) || []);
      } catch {
        setPredictions([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        console.log(`Captured GPS: ${latitude}, ${longitude} (Precision: ${accuracy}m)`);

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&email=aviwenotununu4@gmail.com`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            if (data) {
              const { formattedAddress, city } = parseAndNormalizeZAAddress(data.display_name || "Current GPS Location");
              onSelect(formattedAddress, city, latitude, longitude);
              onChange(formattedAddress);
              toast.success("High-precision GPS captured!");
              return;
            }
          }
        } catch {
          onSelect("GPS Location", "Tembisa", latitude, longitude);
          onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        toast.error("Low precision or GPS denied. Please search manually.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleSelect = (prediction: OSMPrediction) => {
    const lat = parseFloat(prediction.lat);
    const lon = parseFloat(prediction.lon);
    const { formattedAddress, city } = parseAndNormalizeZAAddress(prediction.display_name);

    onChange(formattedAddress);
    setPredictions([]);
    onSelect(formattedAddress, city, lat, lon);
  };

  const fuzzySuggestions = useMemo(() => getZASuburbFuzzyMatches(value), [value]);

  const handleSelectFuzzy = (sug: ReturnType<typeof getZASuburbFuzzyMatches>[0]) => {
    onChange(sug.formattedSuggestion);
    setPredictions([]);
    onSelect(sug.formattedSuggestion, sug.city, -25.9964, 28.2268);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-primary/40"
          size={16}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 sm:h-14 bg-surface-container-low border border-outline-variant/10 rounded-2xl pl-9 sm:pl-12 pr-11 sm:pr-14 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-xs sm:text-base leading-snug py-2 px-3 sm:py-3.5"
        />
        <button
          onClick={useCurrentLocation}
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 hover:bg-primary/10 rounded-xl text-primary transition-all active:scale-95 cursor-pointer"
          title="Use current GPS"
          disabled={isLocating}
          type="button"
        >
          <Navigation size={18} className={isLocating ? "animate-pulse" : ""} />
        </button>
      </div>

      <AnimatePresence>
        {(fuzzySuggestions.length > 0 || predictions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden divide-y divide-outline-variant/10 max-h-[320px] overflow-y-auto"
          >
            {/* Local SA Suburb Fuzzy Aliases Header */}
            {fuzzySuggestions.length > 0 && (
              <div className="bg-surface-container-low/80 p-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5 px-2 mb-1">
                  <MapPin size={12} /> Local Suburb Aliases Matches
                </span>
                {fuzzySuggestions.map((sug, idx) => (
                  <button
                    key={`fuzzy-${sug.alias}-${idx}`}
                    onClick={() => handleSelectFuzzy(sug)}
                    className="w-full text-left p-2 hover:bg-primary/10 rounded-xl transition-colors flex items-center justify-between group cursor-pointer"
                    type="button"
                  >
                    <div>
                      <p className="text-xs font-extrabold text-on-surface group-hover:text-primary transition-colors">
                        {sug.canonicalSuburb}
                      </p>
                      <p className="text-[10px] text-on-surface-variant font-medium">
                        {sug.city}, Gauteng, ZA
                      </p>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      Fuzzy Match
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Nominatim OSM Online Geocoded Search Predictions */}
            {predictions.length > 0 && (
              <div>
                {fuzzySuggestions.length > 0 && (
                  <div className="bg-surface-container-low/40 px-4 py-1">
                    <span className="text-[9px] font-bold text-on-surface-variant/70 uppercase tracking-widest">
                      Full OpenStreetMap Address Results
                    </span>
                  </div>
                )}
                {predictions.map((p, idx) => {
                  const normalized = parseAndNormalizeZAAddress(p.display_name);
                  return (
                    <button
                      key={`${p.place_id || idx}-${idx}`}
                      onClick={() => handleSelect(p)}
                      className="w-full text-left p-2.5 sm:p-3 hover:bg-primary/5 transition-colors border-b border-outline-variant/5 last:border-none group cursor-pointer"
                      type="button"
                    >
                      <p className="text-xs sm:text-sm font-bold text-on-surface group-hover:text-primary transition-colors break-words whitespace-normal leading-snug">
                        {p.display_name.split(",")[0]}
                      </p>
                      <p className="text-[10px] sm:text-xs text-on-surface-variant break-words whitespace-normal leading-snug mt-0.5">
                        {normalized.formattedAddress}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
