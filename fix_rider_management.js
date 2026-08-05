import fs from 'fs';
let content = fs.readFileSync('src/components/RiderManagement.tsx', 'utf-8');

// We want to remove the "External Riders" toggle block in the "controls" tab.
// It starts from `<div className="flex items-start justify-between gap-4">` and ends before `Auto-Find On-Demand Search`.
const targetStr = `                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Allow Independent Fleet</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                      Permit third-party independent agents to accept deliveries from your store on the regional network.
                    </p>
                  </div>
                  <button
                    onClick={toggleAllowExternalRiders}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative cursor-pointer border shrink-0",
                      allowExternalRiders ? "bg-primary border-primary" : "bg-on-surface/10 border-outline-variant"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all",
                      allowExternalRiders ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
`;
content = content.replace(targetStr, "");

fs.writeFileSync('src/components/RiderManagement.tsx', content);
