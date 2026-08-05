#!/bin/bash
sed -i 's/const \[testingPing, setTestingPing\] = useState(false);/const [testingPing, setTestingPing] = useState(false);\n  const [testingWs, setTestingWs] = useState(false);\n  const [wsResult, setWsResult] = useState<{ status: "idle" | "success" | "error"; message?: string }>({ status: "idle" });/' src/components/DiagnosticUtilityModal.tsx

