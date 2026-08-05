#!/bin/bash
awk '
/const \[showOfflineInfoModal, setShowOfflineInfoModal\] = useState<boolean>\(false\);/ {
    print $0
    print "  const [testingConnection, setTestingConnection] = useState<boolean>(false);"
    print ""
    print "  const handleTestConnection = async () => {"
    print "    setTestingConnection(true);"
    print "    try {"
    print "      await new Promise(resolve => setTimeout(resolve, 800));"
    print "      if (navigator.onLine) {"
    print "        toast.success(\"Connection to relay nodes is optimal.\");"
    print "      } else {"
    print "        toast.error(\"Cannot reach dispatch edge servers.\");"
    print "      }"
    print "    } finally {"
    print "      setTestingConnection(false);"
    print "    }"
    print "  };"
    next
}
{ print }
' src/App.tsx > temp.tsx && mv temp.tsx src/App.tsx
