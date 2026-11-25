// Only visible while a requested optional modal chunk is loading.
// Keep the approved App.tsx layout and original modal components unchanged.
export function DeferredModalLoading({kind}:{kind:"legal"|"diagnostics"}){
 return kind==="legal"
  ? <div role="status" className="fixed bottom-12 left-2 z-[9900] rounded-lg bg-surface p-3 text-on-surface">Loading legal information…</div>
  : <div role="status" className="fixed bottom-24 right-6 z-[55] rounded-lg bg-surface p-3 text-on-surface">Loading diagnostics…</div>;
}
