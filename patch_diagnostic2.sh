#!/bin/bash
# Insert the ws test logic before setTestingPing(false)

awk '
/setTestingPing\(false\);/ && !done {
    print "      try {"
    print "        setTestingWs(true);"
    print "        const wsChannel = supabase.channel('\''diagnostic_test_ws'\'');"
    print "        const wsPromise = new Promise<void>((resolve, reject) => {"
    print "          let isResolved = false;"
    print "          const timeout = setTimeout(() => {"
    print "            if (!isResolved) {"
    print "              isResolved = true;"
    print "              reject(new Error(\"WebSocket connection timed out after 8 seconds\"));"
    print "            }"
    print "          }, 8000);"
    print "          wsChannel.subscribe((status, err) => {"
    print "            if (isResolved) return;"
    print "            if (status === '\''SUBSCRIBED'\'') {"
    print "              isResolved = true;"
    print "              clearTimeout(timeout);"
    print "              setWsResult({ status: \"success\", message: \"WebSocket connected successfully\" });"
    print "              resolve();"
    print "            } else if (status === '\''CHANNEL_ERROR'\'' || status === '\''CLOSED'\'' || status === '\''TIMED_OUT'\'') {"
    print "              isResolved = true;"
    print "              clearTimeout(timeout);"
    print "              setWsResult({ status: \"error\", message: `WebSocket failed with status: ${status} ${err?.message || \"\"}` });"
    print "              reject(new Error(`WebSocket failed with status: ${status}`));"
    print "            }"
    print "          });"
    print "        });"
    print "        await wsPromise;"
    print "        await supabase.removeChannel(wsChannel);"
    print "      } catch (err) {"
    print "        setWsResult({ status: \"error\", message: err instanceof Error ? err.message : \"WebSocket connection failed\" });"
    print "      } finally {"
    print "        setTestingWs(false);"
    print "      }"
    print "      " $0
    done = 1
    next
}
{ print }
' src/components/DiagnosticUtilityModal.tsx > temp.tsx && mv temp.tsx src/components/DiagnosticUtilityModal.tsx
