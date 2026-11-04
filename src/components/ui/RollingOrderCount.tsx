import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const digits = "0123456789";

/**
 * Roll verified integer counters only. Never animate estimated payments,
 * stale figures, unknown values or amounts that have not been verified.
 */
export const RollingOrderCount: React.FC<{ value: number; animate?: boolean }> = ({
  value,
  animate = true,
}) => {
  const reducedMotion = useReducedMotion();
  const safeValue = Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  if (safeValue === null) return <span aria-label="Count unavailable">—</span>;

  const formatted = safeValue.toLocaleString("en-ZA");
  if (!animate || reducedMotion) return <span className="tabular-nums">{formatted}</span>;

  return (
    <span role="img" aria-label={formatted} className="inline-flex items-center tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
      {Array.from(formatted).map((char, index) => {
        if (!digits.includes(char)) return <span key={index} aria-hidden="true">{char}</span>;
        return (
          <span key={index} aria-hidden="true" className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-baseline leading-none">
            <motion.span
              className="absolute left-0 top-0 flex w-full flex-col text-center"
              initial={false}
              animate={{ y: `-${Number(char)}em` }}
              transition={{ duration: 0.33, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.045, 0.25) }}
            >
              {Array.from(digits).map(digit => (
                <span key={digit} className="block h-[1em] leading-none">{digit}</span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
};
