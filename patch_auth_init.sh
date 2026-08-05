#!/bin/bash
awk '
index($0, "const [isAuthReady, setIsAuthReady] = useState(() => {") {
    print "  const [isSessionChecking, setIsSessionChecking] = useState(true);"
    print "  const [isAuthReady, setIsAuthReady] = useState(false);"
    in_block = 1
    next
}
in_block && index($0, "});") {
    in_block = 0
    next
}
in_block {
    next
}
index($0, "const [loading, setLoading] = useState(() => {") {
    print "  const [loading, setLoading] = useState(true);"
    in_block2 = 1
    next
}
in_block2 && index($0, "});") {
    in_block2 = 0
    next
}
in_block2 {
    next
}
index($0, "if (loading || !isAuthReady) {") {
    print "  if (isSessionChecking || loading || !isAuthReady) {"
    next
}
index($0, "setIsAuthReady(true);") {
    print "      setIsSessionChecking(false);"
    print "      setIsAuthReady(true);"
    next
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
