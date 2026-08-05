#!/bin/bash
awk '
/\{\/\* Real-time Connectivity Monitor \*\/\}/ {
    skip = 1
}
skip && /<\/div>/ {
    skip = 0
    next
}
skip { next }
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
