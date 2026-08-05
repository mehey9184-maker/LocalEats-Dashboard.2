#!/bin/bash
awk '
/Supabase Database Ping/ && !done {
    print "            {/* Supabase WebSocket Status */}"
    print "            <div className=\"p-4 rounded-2xl bg-surface-container-high border border-outline-variant/10 flex items-center justify-between\">"
    print "              <div className=\"space-y-0.5\">"
    print "                <span className=\"text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant\">"
    print "                  Realtime WebSocket"
    print "                </span>"
    print "                <p className=\"text-sm font-bold text-on-surface flex items-center gap-1.5\">"
    print "                  <Activity size={14} className=\"text-primary\" />"
    print "                  {testingWs ? ("
    print "                    <span className=\"text-xs text-on-surface-variant animate-pulse\">Testing...</span>"
    print "                  ) : wsResult.status === \"success\" ? ("
    print "                    <span className=\"text-emerald-600 dark:text-emerald-400 font-semibold text-xs\">Connected</span>"
    print "                  ) : wsResult.status === \"error\" ? ("
    print "                    <span className=\"text-rose-600 dark:text-rose-400 font-semibold text-xs truncate max-w-[120px]\" title={wsResult.message}>Failed</span>"
    print "                  ) : ("
    print "                    \"Idle\""
    print "                  )}"
    print "                </p>"
    print "              </div>"
    print "            </div>"
    print ""
    print $0
    done = 1
    next
}
{ print }
' src/components/DiagnosticUtilityModal.tsx > temp.tsx && mv temp.tsx src/components/DiagnosticUtilityModal.tsx
