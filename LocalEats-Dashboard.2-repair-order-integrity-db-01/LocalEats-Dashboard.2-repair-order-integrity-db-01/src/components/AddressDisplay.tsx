import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { parseAndNormalizeZAAddress, shortenAddress } from "../utils";

interface AddressDisplayProps {
  address: string;
  city?: string;
  className?: string;
  maxParts?: number;
  showIcon?: boolean;
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  city,
  className = "",
  maxParts = 2,
  showIcon = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!address) {
    return <span className="text-on-surface-variant/60 italic text-xs">No address</span>;
  }

  const parsed = parseAndNormalizeZAAddress(address, city || "Tembisa");
  const fullFormatted = parsed.formattedAddress || address;
  const shortFormatted = shortenAddress(fullFormatted, maxParts);

  const isTruncated = shortFormatted !== fullFormatted && shortFormatted.length < fullFormatted.length;

  const displayText = expanded ? fullFormatted : shortFormatted;

  return (
    <span
      onClick={(e) => {
        if (isTruncated) {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }
      }}
      title={fullFormatted}
      className={`inline-flex items-center gap-1 max-w-full break-words whitespace-normal leading-snug cursor-pointer transition-all ${className}`}
    >
      {showIcon && <MapPin size={12} className="text-primary/70 shrink-0" />}
      <span className="break-words whitespace-normal leading-snug max-sm:text-xs text-sm sm:text-base p-0.5 sm:p-1 rounded max-sm:px-1 max-sm:py-0.5">
        {displayText}
        {city && !displayText.toLowerCase().includes(city.toLowerCase()) ? `, ${city}` : ""}
      </span>
      {isTruncated && (
        <span className="text-[9px] font-bold text-primary/80 bg-primary/10 px-1 py-0.2 rounded shrink-0 ml-1 select-none">
          {expanded ? "less" : "more"}
        </span>
      )}
    </span>
  );
};

export default AddressDisplay;
