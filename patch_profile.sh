#!/bin/bash
awk '
/<div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary\/10 shadow-sm">/ {
    print "              <button"
    print "                onClick={() => setActiveTab(\"settings\")}"
    print "                className=\"w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/10 shadow-sm cursor-pointer hover:border-primary/30 transition-all\""
    print "                title=\"Profile Settings\""
    print "              >"
    skip = 1
    next
}
skip && /<\/div>/ && !found_inner_div {
    # Check if this is the closing tag of the profile picture container
    # Actually, there is an inner div for the placeholder! So just matching </div> is dangerous.
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
