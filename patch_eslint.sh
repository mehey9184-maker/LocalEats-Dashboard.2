#!/bin/bash
sed -i 's/\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect//g' src/components/NetworkStatus.tsx
awk '
/setSupabaseStatus\("connecting"\);/ {
    print "      // eslint-disable-next-line react-hooks/set-state-in-effect"
    print $0
    next
}
/setSupabaseStatus\("offline"\);/ {
    print "      // eslint-disable-next-line react-hooks/set-state-in-effect"
    print $0
    next
}
{ print }
' src/components/NetworkStatus.tsx > temp.tsx && mv temp.tsx src/components/NetworkStatus.tsx
