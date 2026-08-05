#!/bin/bash
awk '
/className="text-white drop-shadow-sm"/ {
    print $0
    next
}
/strokeWidth=\{2\.5\}/ {
    print $0
    next_is_divs = 1
    next
}
next_is_divs && /\/>/ {
    print $0
    next
}
next_is_divs && /<\/div>/ {
    print $0
    next
}
next_is_divs && /}\)/ {
    print $0
    next
}
next_is_divs && /<\/div>/ {
    print "              </button>"
    next_is_divs = 0
    next
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
