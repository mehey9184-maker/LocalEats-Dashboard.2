import React, {useEffect,useRef} from "react";

/** A visual-only preview of legacy tools. The subtree is inert before a
 * merchant can interact with it, and pointer events are also blocked in
 * browsers that have not implemented inert. No writes or exports are offered.
 */
export const ReadOnlyMarketingPreview:React.FC<{
  locked:boolean;
  description:string;
  children:React.ReactNode;
}> = ({locked,description,children}) => {
  const contentRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=contentRef.current;
    if(!element)return;
    element.inert=locked;
    return ()=>{element.inert=false;};
  },[locked]);
  return (
    <div className="space-y-3">
      {locked && (
        <p role="status" className="text-xs text-on-surface-variant bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/15">
          {description} This is a visual-only design preview. Buttons, links, downloads, offers and customer outreach are disabled. Text and sample values below are not evidence of active services.
        </p>
      )}
      <div ref={contentRef}
        className={locked?"pointer-events-none select-none":" "}
        onClickCapture={locked?(event)=>{event.preventDefault();event.stopPropagation();}:undefined}
        onKeyDownCapture={locked?(event)=>{event.preventDefault();event.stopPropagation();}:undefined}
        onSubmitCapture={locked?(event)=>{event.preventDefault();event.stopPropagation();}:undefined}>
        {children}
      </div>
    </div>
  );
};
