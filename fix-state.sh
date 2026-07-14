sed -i '/const \[darkMode, setDarkMode/a \
  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => localStorage.getItem("soundAlerts") !== "false");\
  const [soundStyle, setSoundStyle] = useState<string>(() => localStorage.getItem("soundStyle") || "modern");\
  const [soundVolume, setSoundVolume] = useState<number>(() => Number(localStorage.getItem("soundVolume") || "70"));\
  const [autoAcceptOrders, setAutoAcceptOrders] = useState<boolean>(() => localStorage.getItem("autoAcceptOrders") === "true");\
  const [autoPrint, setAutoPrint] = useState<boolean>(() => localStorage.getItem("autoPrint") === "true");\
  const [printingFormat, setPrintingFormat] = useState<"80mm" | "58mm">(() => (localStorage.getItem("printingFormat") as "80mm" | "58mm") || "80mm");\
  const [deliverySettings, setDeliverySettings] = useState({ type: "fixed", baseFee: 15, freeDeliveryOver: 200, minOrderAmount: 0, maxDistanceKm: 15 });\
' src/App.tsx
