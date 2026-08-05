#!/bin/bash
awk '
/import \{ LocalEatsLogo \}/ {
    print $0
    print "import { NetworkStatus } from \"./components/NetworkStatus\";"
    next
}
/\/\* Swiss-Modern Offline Badge \*\// {
    print "              {/* Real-time Connectivity Monitor */}"
    print "              <div onClick={() => setShowOfflineInfoModal(true)} className=\"cursor-pointer active:scale-95 transition-all\">"
    print "                <NetworkStatus />"
    print "              </div>"
    in_block = 1
    next
}
in_block && /\{currentShop && \(/ {
    in_block = 0
    print $0
    next
}
in_block {
    next
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
