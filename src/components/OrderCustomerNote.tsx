import React from "react";
import {MessageSquareText} from "lucide-react";

// A customer instruction is preparation information, NOT a paid modifier,
// merchant-authored note or automatic acceptance decision.
type NoteLine={name?:unknown;notes?:unknown};
type NoteOrder={notes?:unknown;items?:unknown};

export function getCustomerPreparationNotes(order:NoteOrder):string[] {
  const orderNote=typeof order.notes==="string"?order.notes.trim():"";
  // The pickup API may already combine item notes into order.notes.
  // Prefer that authoritative display value to avoid repeating instructions.
  if(orderNote)return [orderNote.slice(0,2000)];
  if(!Array.isArray(order.items))return [];
  return (order.items as NoteLine[])
    .filter(item=>item && typeof item==="object" && typeof item.notes==="string")
    .map(item=>{
      const note=(item.notes as string).trim();
      if(!note)return "";
      const name=typeof item.name==="string" ? item.name.trim() : "";
      return name?`${name}: ${note}`:note;
    }).filter(Boolean).slice(0,50);
}

export function OrderCustomerNote({order,compact=false}:{order:NoteOrder;compact?:boolean}){
  const notes=getCustomerPreparationNotes(order);
  if(notes.length===0)return null;
  return <section
    data-testid="order-customer-note"
    aria-label="Customer preparation instructions"
    className={`min-w-0 rounded-lg border-l-[3px] border-amber-500 bg-amber-50 dark:bg-amber-950/25 ${compact?"px-2.5 py-2":"px-3 py-2.5"}`}
  >
    <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-900 dark:text-amber-200">
      <MessageSquareText size={13} aria-hidden="true"/> Special request
    </p>
    {notes.map((note,index)=><p key={index} className={`mt-1 whitespace-pre-wrap break-words font-bold leading-snug text-slate-900 dark:text-zinc-100 ${compact?"text-xs":"text-sm"}`}>{note}</p>)}
  </section>;
}
