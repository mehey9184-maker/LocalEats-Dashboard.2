#!/bin/bash
awk '
/\{currentShop.is_active \? "• Accepting Orders" : "• Paused"\}/ {
    print $0
    next_is_button = 1
    next
}
next_is_button && /<\/button>/ {
    print $0
    print "              )}"
    next_is_button = 0
    next
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
