#!/bin/bash
awk '
/onClick=\{() => \{/ && /const newVal = !dataSaverMode;/ {
    in_block = 1
    next
}
in_block && /<span className="xs:hidden">\{dataSaverMode \? "Saver" : "HD"\}<\/span>/ {
    next_is_button_close = 1
    next
}
in_block && next_is_button_close && /<\/button>/ {
    in_block = 0
    next_is_button_close = 0
    next
}
in_block {
    next
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx

sed -i 's/{!isOnline ? "Network Offline" : supabaseStatus === "offline" ? "Limited Offline Mode" : supabaseStatus === "connecting" ? "Connecting..." : pendingSyncs > 0 ? "Syncing..." : "Online"}/{!isOnline || supabaseStatus === "offline" ? "Offline" : supabaseStatus === "connecting" ? "Connecting" : pendingSyncs > 0 ? "Syncing" : "Online"}/g' src/components/NetworkStatus.tsx
