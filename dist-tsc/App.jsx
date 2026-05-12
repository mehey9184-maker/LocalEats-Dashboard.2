"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var react_2 = require("motion/react");
var sonner_1 = require("sonner");
var genai_1 = require("@google/genai");
var lucide_react_1 = require("lucide-react");
var recharts_1 = require("recharts");
var date_fns_1 = require("date-fns");
var AppMapBackground_1 = require("./components/AppMapBackground");
var SavingOverlay_1 = require("./components/ui/SavingOverlay");
var supabase_js_1 = require("@supabase/supabase-js");
var react_leaflet_1 = require("react-leaflet");
var leaflet_1 = require("leaflet");
var clsx_1 = require("clsx");
var tailwind_merge_1 = require("tailwind-merge");
var browser_image_compression_1 = require("browser-image-compression");
var LocalEatsLogo_1 = require("./components/LocalEatsLogo");
// Fix Leaflet marker icons
// @ts-expect-error - Leaflet Default Icon prototype doesn't have _getIconUrl type
delete leaflet_1.default.Icon.Default.prototype._getIconUrl;
leaflet_1.default.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});
var DEFAULT_MENU_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800";
var DEFAULT_SHOP_LOGO = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800";
var calculateDistance = function (lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
var LeafletMap = function (_a) {
    var center = _a.center, _b = _a.zoom, zoom = _b === void 0 ? 13 : _b, onLocationSelect = _a.onLocationSelect;
    var MapEvents = function () {
        (0, react_leaflet_1.useMapEvents)({
            click: function (e) {
                if (onLocationSelect) {
                    onLocationSelect(e.latlng.lat, e.latlng.lng);
                }
            },
        });
        return null;
    };
    var ChangeView = function (_a) {
        var coords = _a.coords;
        var map = (0, react_leaflet_1.useMap)();
        (0, react_1.useEffect)(function () {
            map.setView([coords.lat, coords.lng], zoom);
        }, [coords, map]);
        return null;
    };
    return (<div className="w-full h-full min-h-[200px] rounded-xl overflow-hidden shadow-inner border border-outline-variant/10 relative z-0">
      <react_leaflet_1.MapContainer center={[center.lat, center.lng]} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <react_leaflet_1.TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <react_leaflet_1.Marker position={[center.lat, center.lng]} draggable={true} eventHandlers={{
            dragend: function (e) {
                var marker = e.target;
                var position = marker.getLatLng();
                if (onLocationSelect) {
                    onLocationSelect(position.lat, position.lng);
                }
            },
        }}/>
        <MapEvents />
        <ChangeView coords={center}/>
      </react_leaflet_1.MapContainer>
    </div>);
};
var AddressAutocomplete = function (_a) {
    var value = _a.value, onChange = _a.onChange, onSelect = _a.onSelect, _b = _a.placeholder, placeholder = _b === void 0 ? "Search address..." : _b;
    var _c = (0, react_1.useState)([]), predictions = _c[0], setPredictions = _c[1];
    (0, react_1.useEffect)(function () {
        var timeoutId = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, data, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!value || value.length < 3) {
                            setPredictions([]);
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("https://nominatim.openstreetmap.org/search?q=".concat(encodeURIComponent(value), "&format=json&addressdetails=1&limit=5&countrycodes=za&email=aviwenotununu4@gmail.com"), {
                                headers: {
                                    "Accept-Language": "en",
                                },
                            })];
                    case 2:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        setPredictions(data || []);
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("OSM Nominatim Error:", error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); }, 500);
        return function () { return clearTimeout(timeoutId); };
    }, [value]);
    var handleSelect = function (prediction) {
        var lat = parseFloat(prediction.lat);
        var lon = parseFloat(prediction.lon);
        var city = prediction.address.city ||
            prediction.address.town ||
            prediction.address.village ||
            prediction.address.suburb ||
            "Unknown";
        var address = prediction.display_name;
        onChange(address);
        setPredictions([]);
        onSelect(address, city, lat, lon);
    };
    return (<div className="relative w-full">
      <div className="relative">
        <lucide_react_1.MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18}/>
        <input type="text" value={value} onChange={function (e) { return onChange(e.target.value); }} placeholder={placeholder} className="w-full h-14 bg-surface-container-low border border-outline-variant/10 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-base"/>
      </div>

      <react_2.AnimatePresence>
        {predictions.length > 0 && (<react_2.motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden">
            {predictions.map(function (p, idx) { return (<button key={"".concat(p.place_id, "-").concat(idx)} onClick={function () { return handleSelect(p); }} className="w-full text-left p-4 hover:bg-primary/5 transition-colors border-b border-outline-variant/5 last:border-none group">
                <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                  {p.display_name.split(",")[0]}
                </p>
                <p className="text-[10px] text-on-surface-variant line-clamp-1">
                  {p.display_name}
                </p>
              </button>); })}
          </react_2.motion.div>)}
      </react_2.AnimatePresence>
    </div>);
};
var supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
var supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// The official dashboard URL for LocalEats South Africa
var DASHBOARD_URL = "https://dashboard.localeatssa.co.za";
var FLAT_DELIVERY_FEE = 5;
/**
 * 🛠 RIDER APP COORDINATION CHECKLIST (For Developer Reference)
 * 1. STATUS SYNC: The Merchant app uses 'preparing' for accepted orders.
 *    Ensure the Rider app feed listens for 'preparing' OR 'accepted'.
 *    (We've updated requestRider to force 'accepted' status for compatibility).
 * 2. ORDER TYPE: Ensure orders are created with order_type: 'delivery' to appear in rider feeds.
 * 3. SUPABASE REALTIME: Enable Realtime on 'orders' and 'rider_connections' tables in Supabase Dashboard.
 * 4. PAIRING: Merchants generate a 6-digit 'connection_code' in RiderManagement.
 *    Riders must enter this to populate their 'rider_id' in rider_connections.
 */
var getRedirectUrl = function () {
    var origin = window.location.origin;
    // If we're on the production domain, use the official dashboard URL.
    // Otherwise (localhost or AI Studio preview), use the current origin.
    if (origin.includes("localeatssa.co.za")) {
        return DASHBOARD_URL;
    }
    return origin;
};
var handleGoogleSignIn = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                        redirectTo: getRedirectUrl(),
                    },
                })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing. Please check your environment variables.");
}
var isSecretKey = supabaseAnonKey === null || supabaseAnonKey === void 0 ? void 0 : supabaseAnonKey.startsWith("sb_secret_");
var isProbablyNotSupabaseKey = (supabaseAnonKey === null || supabaseAnonKey === void 0 ? void 0 : supabaseAnonKey.length) &&
    supabaseAnonKey.length < 50 &&
    !supabaseAnonKey.startsWith("eyJ");
if (isSecretKey) {
    var msg = 'CRITICAL SECURITY ERROR: You are using a Supabase SECRET key (service_role) in the browser. This is forbidden and will cause the app to crash. Please replace VITE_SUPABASE_ANON_KEY with the public "anon" key in your project secrets.';
    console.error(msg);
    if (typeof window !== "undefined") {
        console.log("%c" + msg, "color: white; background: red; font-size: 20px; padding: 10px; border-radius: 5px;");
    }
}
if (isProbablyNotSupabaseKey) {
    var msg = 'WARNING: The Supabase Anon Key looks incorrect. It should be a long JWT string starting with "eyJ". Please check your Supabase dashboard.';
    console.warn(msg);
}
console.log("Supabase initialized with URL:", supabaseUrl ? "".concat(supabaseUrl.substring(0, 10), "...") : "MISSING");
var supabase = (0, supabase_js_1.createClient)(supabaseUrl || "", supabaseAnonKey || "");
/**
 * Global fetch wrapper with retry logic to handle intermittent "Failed to fetch" errors.
 */
function fetchWithRetry(fn_1) {
    return __awaiter(this, arguments, void 0, function (fn, retries, delay) {
        var lastError, _loop_1, i, state_1;
        var _a, _b, _c;
        if (retries === void 0) { retries = 3; }
        if (delay === void 0) { delay = 1000; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    lastError = null;
                    _loop_1 = function (i) {
                        var result, error, err_1;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, fn()];
                                case 1:
                                    result = _e.sent();
                                    error = result.error;
                                    if (!error)
                                        return [2 /*return*/, { value: result }];
                                    lastError = error;
                                    // Only retry on network errors or Failed to fetch
                                    if (!((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("Failed to fetch")) &&
                                        !((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("network")) &&
                                        !((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("FetchError"))) {
                                        return [2 /*return*/, { value: result }];
                                    }
                                    return [3 /*break*/, 3];
                                case 2:
                                    err_1 = _e.sent();
                                    if (err_1 instanceof Error) {
                                        lastError = { message: err_1.message.includes("Failed to fetch") ? "Failed to fetch" : err_1.message };
                                    }
                                    else {
                                        lastError = { message: String(err_1) };
                                    }
                                    return [3 /*break*/, 3];
                                case 3:
                                    if (!(i < retries - 1)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, delay * (i + 1)); })];
                                case 4:
                                    _e.sent();
                                    _e.label = 5;
                                case 5: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _d.label = 1;
                case 1:
                    if (!(i < retries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    state_1 = _d.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _d.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, { data: null, error: lastError }];
            }
        });
    });
}
function cn() {
    var inputs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        inputs[_i] = arguments[_i];
    }
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
// --- Components ---
var Skeleton = function (_a) {
    var className = _a.className;
    return (<div className={cn("bg-surface-container-highest/50 rounded-md animate-skeleton", className)}/>);
};
var SignIn = function (_a) {
    var onSignUpClick = _a.onSignUpClick, onSuccess = _a.onSuccess;
    var _b = (0, react_1.useState)(""), email = _b[0], setEmail = _b[1];
    var _c = (0, react_1.useState)(""), password = _c[0], setPassword = _c[1];
    var _d = (0, react_1.useState)(false), showPassword = _d[0], setShowPassword = _d[1];
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(null), error = _f[0], setError = _f[1];
    // Removed unused handleQuickSignIn and handleQuickCreate
    var handleSignIn = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var error_2, err_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    e.preventDefault();
                    setLoading(true);
                    setError(null);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase.auth.signInWithPassword({
                            email: email,
                            password: password,
                        })];
                case 2:
                    error_2 = (_b.sent()).error;
                    if (error_2) {
                        setError(error_2.message);
                    }
                    else {
                        onSuccess();
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _b.sent();
                    if (err_2 instanceof Error &&
                        ((_a = err_2.message) === null || _a === void 0 ? void 0 : _a.includes("Forbidden use of secret API key"))) {
                        setError('CRITICAL: You are using a Supabase SECRET key in the browser. Please update your project secrets with the public "anon" key.');
                    }
                    else {
                        setError(err_2 instanceof Error ? err_2.message : "An unexpected error occurred.");
                    }
                    return [3 /*break*/, 4];
                case 4:
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 z-0 opacity-40 bg-cover bg-center" style={{
            backgroundImage: "linear-gradient(to bottom, rgba(250, 249, 248, 0.85), rgba(250, 249, 248, 0.95)), url(https://picsum.photos/seed/map/1200/800)",
        }}></div>

      <main className="relative z-10 w-full max-w-md">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="text-4xl font-headline font-black text-primary tracking-tighter">
              LocalEats
            </span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-on-surface-variant font-medium">
            Taste the finest flavors from your neighborhood
          </p>
        </header>

        <div className="bg-surface-container-lowest/70 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_8px_32px_-4px_rgba(167,52,0,0.08)]">
          <form className="space-y-6" onSubmit={handleSignIn}>
            {error && (<div className="p-3 bg-error-container text-error text-sm rounded-xl font-medium">
                {error}
              </div>)}

            <div className="space-y-2">
              <div className="relative group">
                <input className="peer w-full h-14 px-4 pt-4 bg-surface-container-low border-0 rounded-xl font-medium focus:ring-2 focus:ring-primary/40 transition-all outline-none" id="email" placeholder=" " type="email" value={email} onChange={function (e) { return setEmail(e.target.value); }} required/>
                <label className={cn("absolute left-4 top-4 text-on-surface-variant transition-all pointer-events-none origin-left font-medium", "peer-focus:-translate-y-3 peer-focus:scale-85 peer-focus:text-primary", email && "-translate-y-3 scale-85 text-primary")} htmlFor="email">
                  Email
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative group">
                <input className="peer w-full h-14 px-4 pt-4 bg-surface-container-low border-0 rounded-xl font-medium focus:ring-2 focus:ring-primary/40 transition-all outline-none" id="password" placeholder=" " type={showPassword ? "text" : "password"} value={password} onChange={function (e) { return setPassword(e.target.value); }} required/>
                <label className={cn("absolute left-4 top-4 text-on-surface-variant transition-all pointer-events-none origin-left font-medium", "peer-focus:-translate-y-3 peer-focus:scale-85 peer-focus:text-primary", password && "-translate-y-3 scale-85 text-primary")} htmlFor="password">
                  Password
                </label>
                <button className="absolute right-4 top-4 text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={function () { return setShowPassword(!showPassword); }}>
                  {showPassword ? <lucide_react_1.EyeOff size={20}/> : <lucide_react_1.Eye size={20}/>}
                </button>
              </div>
              <div className="flex justify-end">
                <a className="text-sm font-semibold text-primary hover:text-primary-container transition-colors" href="#">
                  Forgot Password?
                </a>
              </div>
            </div>

            <button className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.24)] hover:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50" type="submit" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
              <lucide_react_1.ArrowRight size={20}/>
            </button>
          </form>

          <div className="relative my-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30"></div>
            </div>
            <span className="relative bg-surface-container-lowest px-4 text-sm font-medium text-on-surface-variant">
              Or sign in with
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.96.95-2.04 1.72-3.24 1.72-1.16 0-1.54-.71-2.94-.71-1.4 0-1.83.7-2.94.7-1.16 0-2.32-.82-3.32-1.82-2.04-2.04-3.52-5.76-3.52-8.52 0-2.76 1.44-4.2 2.88-4.2 1.44 0 2.28.84 3.12.84.84 0 1.68-.84 3.12-.84 1.44 0 2.88 1.44 2.88 4.2 0 .6-.06 1.2-.18 1.8-.36 1.8-1.56 3.6-2.88 5.04zM12 5.04c0-1.68 1.44-3.12 3.12-3.12.12 0 .24 0 .36.12-.12 1.68-1.56 3.12-3.12 3.12-.12 0-.24 0-.36-.12z"/>
              </svg>
            </button>
            <button onClick={handleGoogleSignIn} className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          </div>
        </div>

        <footer className="mt-8 text-center">
          <p className="text-on-surface-variant font-medium">
            Don't have an account?
            <button onClick={onSignUpClick} className="text-primary font-bold ml-1 hover:underline decoration-2 underline-offset-4 transition-all">
              Sign Up
            </button>
          </p>
        </footer>
      </main>
    </div>);
};
var SignUp = function (_a) {
    var onSignInClick = _a.onSignInClick, onSuccess = _a.onSuccess;
    var _b = (0, react_1.useState)(""), name = _b[0], setName = _b[1];
    var _c = (0, react_1.useState)(""), phone = _c[0], setPhone = _c[1];
    var _d = (0, react_1.useState)(""), email = _d[0], setEmail = _d[1];
    var _e = (0, react_1.useState)(""), password = _e[0], setPassword = _e[1];
    var _f = (0, react_1.useState)(false), loading = _f[0], setLoading = _f[1];
    var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
    var isValidSouthAfricanPhone = function (p) {
        var cleaned = p.replace(/[\s-]/g, "");
        return /^(?:\+27|0)[0-9]{9}$/.test(cleaned);
    };
    var handleSignUp = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, _error, err_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (e)
                        e.preventDefault();
                    setLoading(true);
                    setError(null);
                    if (!isValidSouthAfricanPhone(phone)) {
                        setError("Please enter a valid South African phone number (e.g., +27 82 123 4567 or 082 123 4567).");
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: {
                                    full_name: name,
                                    phone: phone,
                                },
                                emailRedirectTo: getRedirectUrl(),
                            },
                        })];
                case 2:
                    _a = _b.sent(), data = _a.data, _error = _a.error;
                    if (_error) {
                        setError(_error.message);
                    }
                    else if (data && data.user && data.session) {
                        onSuccess(email);
                    }
                    else {
                        onSuccess(email);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _b.sent();
                    console.error("Sign up error:", err_3);
                    setError(err_3 instanceof Error ? err_3.message : "An unexpected error occurred.");
                    return [3 /*break*/, 4];
                case 4:
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<div className="min-h-screen bg-surface font-body text-on-surface antialiased">
      <header className="fixed top-0 w-full z-50 bg-[#faf9f8]/70 backdrop-blur-xl flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
        <div className="text-2xl font-black text-[#a73400] tracking-tight font-headline">
          LocalEats
        </div>
        <button onClick={onSignInClick} className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <lucide_react_1.ArrowLeft size={20}/>
          <span className="font-medium text-body-md">Back</span>
        </button>
      </header>

      <main className="min-h-screen pt-16 flex items-center justify-center bg-cover bg-center" style={{
            backgroundImage: "linear-gradient(to bottom, rgba(250, 249, 248, 0.8), rgba(250, 249, 248, 0.95)), url(https://picsum.photos/seed/map/1200/800)",
        }}>
        <div className="w-full max-w-lg px-6 py-12">
          <div className="bg-surface-container-lowest/80 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_24px_-4_rgba(167,52,0,0.12)]">
            <div className="mb-10 text-center md:text-left">
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-3">
                Create Account
              </h1>
              <p className="text-on-surface-variant font-medium">
                Join the community celebrating authentic local flavors.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSignUp}>
              {error && (<div className="p-3 bg-error-container text-error text-sm rounded-xl font-medium">
                  {error}
                </div>)}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="name">
                  Full Name
                </label>
                <input className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" id="name" placeholder="John Doe" type="text" value={name} onChange={function (e) { return setName(e.target.value); }} required/>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="phone">
                  Phone Number
                </label>
                <input className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" id="phone" placeholder="+27 82 123 4567" type="tel" value={phone} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setPhone(result.formatted);
        }} required/>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="email">
                  Email
                </label>
                <input className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" id="email" placeholder="name@example.com" type="email" value={email} onChange={function (e) { return setEmail(e.target.value); }} required/>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="password">
                  Password
                </label>
                <input className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" id="password" placeholder="••••••••" type="password" value={password} onChange={function (e) { return setPassword(e.target.value); }} required/>
              </div>

              <button className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.25)] hover:scale-[0.98] active:scale-95 transition-all duration-200 mt-4 disabled:opacity-50" type="submit" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div className="mt-10">
              <div className="relative flex items-center justify-center mb-8">
                <div className="flex-grow border-t border-outline-variant/30"></div>
                <span className="mx-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Or continue with
                </span>
                <div className="flex-grow border-t border-outline-variant/30"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <button className="flex items-center justify-center h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <lucide_react_1.Facebook className="text-blue-600" size={24}/>
                </button>
                <button onClick={handleGoogleSignIn} className="flex items-center justify-center h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </button>
                <button className="flex items-center justify-center h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <lucide_react_1.Instagram className="text-pink-600" size={24}/>
                </button>
              </div>
            </div>

            <div className="mt-10 text-center">
              <p className="text-on-surface-variant font-medium">
                Already have an account?
                <button onClick={onSignInClick} className="text-primary font-bold ml-1 hover:underline transition-all">
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>);
};
var VerificationPending = function (_a) {
    var email = _a.email, onBack = _a.onBack, onVerified = _a.onVerified, onSupport = _a.onSupport;
    var _b = (0, react_1.useState)(["", "", "", "", "", ""]), otp = _b[0], setOtp = _b[1];
    var _c = (0, react_1.useState)(59), timer = _c[0], setTimer = _c[1];
    var _d = (0, react_1.useState)(false), showSuccess = _d[0], setShowSuccess = _d[1];
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(null), error = _f[0], setError = _f[1];
    (0, react_1.useEffect)(function () {
        if (timer > 0) {
            var interval_1 = setInterval(function () { return setTimer(function (prev) { return prev - 1; }); }, 1000);
            return function () { return clearInterval(interval_1); };
        }
    }, [timer]);
    var handleOtpChange = function (index, value) {
        if (value.length > 1)
            return;
        var newOtp = __spreadArray([], otp, true);
        newOtp[index] = value;
        setOtp(newOtp);
        // Auto-focus next input
        if (value && index < 5) {
            var nextInput = document.getElementById("otp-".concat(index + 1));
            nextInput === null || nextInput === void 0 ? void 0 : nextInput.focus();
        }
    };
    var handleKeyDown = function (index, e) {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            var prevInput = document.getElementById("otp-".concat(index - 1));
            prevInput === null || prevInput === void 0 ? void 0 : prevInput.focus();
        }
    };
    var handlePaste = function (e) {
        var _a;
        e.preventDefault();
        var pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
        var newOtp = __spreadArray([], otp, true);
        pastedData.forEach(function (char, i) {
            if (i < 6)
                newOtp[i] = char;
        });
        setOtp(newOtp);
        var lastIndex = Math.min(pastedData.length, 5);
        (_a = document.getElementById("otp-".concat(lastIndex))) === null || _a === void 0 ? void 0 : _a.focus();
    };
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var code, error_3, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    code = otp.join("");
                    if (code.length !== 6) {
                        setError("Please enter all 6 digits.");
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError(null);
                    // Master Code Bypass for testing
                    if (code === "200201") {
                        sonner_1.toast.success("Master code accepted!");
                        setShowSuccess(true);
                        setTimeout(function () {
                            setShowSuccess(false);
                            onVerified();
                        }, 1500);
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, supabase.auth.verifyOtp({
                            email: email,
                            token: code,
                            type: "signup",
                        })];
                case 2:
                    error_3 = (_a.sent()).error;
                    if (error_3) {
                        if (error_3.message.toLowerCase().includes("rate limit")) {
                            setError("Email limit reached (3 per hour). Please wait an hour or contact support.");
                        }
                        else {
                            setError(error_3.message);
                        }
                    }
                    else {
                        setShowSuccess(true);
                        setTimeout(function () {
                            setShowSuccess(false);
                            onVerified();
                        }, 2000);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_4 = _a.sent();
                    console.error("Verification error:", err_4);
                    setError(err_4 instanceof Error ? err_4.message : "An unexpected error occurred.");
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleResend = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_4, firstInput, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (timer > 0)
                        return [2 /*return*/];
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase.auth.resend({
                            type: "signup",
                            email: email,
                        })];
                case 2:
                    error_4 = (_a.sent()).error;
                    if (error_4) {
                        if (error_4.message.toLowerCase().includes("rate limit")) {
                            setError("Email limit reached (3 per hour). Please wait an hour or contact support.");
                        }
                        else {
                            setError(error_4.message);
                        }
                    }
                    else {
                        setTimer(59);
                        setOtp(["", "", "", "", "", ""]);
                        firstInput = document.getElementById("otp-0");
                        firstInput === null || firstInput === void 0 ? void 0 : firstInput.focus();
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_5 = _a.sent();
                    console.error("Resend error:", err_5);
                    setError(err_5 instanceof Error ? err_5.message : "An unexpected error occurred.");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="min-h-screen bg-surface font-body text-on-surface antialiased">
      <header className="fixed top-0 w-full z-50 bg-[#faf9f8]/70 backdrop-blur-xl shadow-[0_8px_24px_-4px_rgba(167,52,0,0.12)]">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-7xl mx-auto">
          <button onClick={onBack} className="p-2 text-primary hover:bg-surface-container-low rounded-full transition-colors active:scale-95 duration-200">
            <lucide_react_1.ArrowLeft size={24}/>
          </button>
          <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">
            LocalEats
          </h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="min-h-screen pt-24 pb-12 px-6 soft-map-bg flex flex-col items-center justify-center overflow-x-hidden">
        <div className="max-w-md w-full space-y-8">
          <section className="relative">
            <div className="text-center mb-10">
              <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight leading-tight">
                Verify Your Account
              </h2>
              <p className="text-on-surface-variant mt-3 font-body text-sm px-4 opacity-80">
                We've sent a 6-digit security code to{" "}
                <span className="text-primary font-bold">{email}</span>. Enter
                it below to access the foundry.
              </p>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_8px_32px_rgba(167,52,0,0.08)] border border-outline-variant/10">
              <form className="space-y-8" onSubmit={handleSubmit}>
                {error && (<div className="flex items-center gap-2 p-3 bg-error-container text-error text-sm rounded-xl font-medium">
                    <lucide_react_1.AlertCircle size={16}/>
                    <span>{error}</span>
                  </div>)}
                <div className="flex justify-between gap-2 sm:gap-4">
                  {otp.map(function (digit, i) { return (<input key={i} id={"otp-".concat(i)} className="w-12 h-16 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-primary" maxLength={1} placeholder="•" type="text" value={digit} onChange={function (e) { return handleOtpChange(i, e.target.value); }} onKeyDown={function (e) { return handleKeyDown(i, e); }} onPaste={i === 0 ? handlePaste : undefined} disabled={loading}/>); })}
                </div>
                <button className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-semibold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50" type="submit" disabled={loading}>
                  {loading ? "Verifying..." : "Submit Code"}
                </button>
              </form>
              <div className="mt-6 text-center space-y-4">
                <button onClick={handleResend} className="text-primary font-semibold text-sm hover:underline underline-offset-4 decoration-primary/30 disabled:opacity-50" disabled={timer > 0 || loading}>
                  {timer > 0
            ? "Resend code in 00:".concat(timer.toString().padStart(2, "0"))
            : "Resend code"}
                </button>

                <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">
                  Don't see it? Check your{" "}
                  <span className="text-primary/60">Spam</span> or{" "}
                  <span className="text-primary/60">Promotions</span> folder.
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-4 py-4">
            <div className="h-px bg-outline-variant/30 flex-1"></div>
            <span className="text-outline text-xs font-bold uppercase tracking-widest">
              Or Status
            </span>
            <div className="h-px bg-outline-variant/30 flex-1"></div>
          </div>

          <section className="relative bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/20 overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    restaurant_menu
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-headline text-2xl font-bold text-on-surface">
                  Approval Pending
                </h3>
                <p className="text-on-surface-variant font-body text-sm leading-relaxed max-w-[280px] mx-auto">
                  We're reviewing your application. You'll be notified once
                  you're ready to start savoring!
                </p>
              </div>

              <div className="w-full space-y-4 pt-4">
                <div className="flex items-center gap-4 bg-surface-container-lowest/60 p-4 rounded-2xl">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <lucide_react_1.CheckCircle2 className="text-primary" size={20}/>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">
                      Account Created
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Completed on Oct 12
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-primary/5">
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <lucide_react_1.Clock size={20}/>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">
                      Admin Review
                    </p>
                    <p className="text-xs text-primary font-medium">
                      Currently in progress...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-container-lowest/40 p-4 rounded-2xl opacity-50">
                  <div className="bg-surface-variant p-2 rounded-lg">
                    <lucide_react_1.Rocket className="text-on-surface-variant" size={20}/>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">
                      Foundry Access
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Unlocks after approval
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={onSupport} className="flex items-center gap-2 text-primary font-bold text-sm hover:translate-x-1 transition-transform">
                <span>Contact Support</span>
                <lucide_react_1.ArrowLeft className="rotate-180" size={16}/>
              </button>
            </div>
          </section>
        </div>
      </main>

      <div className={cn("fixed bottom-12 left-1/2 -translate-x-1/2 bg-on-background text-background px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-300", showSuccess
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none")}>
        <lucide_react_1.CheckCircle2 className="text-primary-fixed" size={20}/>
        <span className="font-label text-sm font-medium">
          Code verified successfully.
        </span>
      </div>
    </div>);
};
var formatSAPhone = function (value) {
    // Remove all non-digits
    var digits = value.replace(/\D/g, "");
    // If user starts with 0, remove it and we'll use +27
    if (digits.startsWith("0")) {
        digits = digits.substring(1);
    }
    else if (digits.startsWith("27")) {
        digits = digits.substring(2);
    }
    // Cap at 9 digits (excluding +27)
    digits = digits.substring(0, 9);
    // Re-build standard format: +27 82 123 4567
    var formatted = "+27";
    if (digits.length > 0)
        formatted += " " + digits.substring(0, 2);
    if (digits.length > 2)
        formatted += " " + digits.substring(2, 5);
    if (digits.length > 5)
        formatted += " " + digits.substring(5, 9);
    return {
        raw: digits.length === 0 ? "" : "+27" + digits,
        formatted: digits.length === 0 ? "" : formatted
    };
};
var EditProfile = function (_a) {
    var _b, _c;
    var onBack = _a.onBack, onSave = _a.onSave, initialData = _a.initialData, userId = _a.userId, _d = _a.isSaving, isSaving = _d === void 0 ? false : _d, _e = _a.isSuccess, isSuccess = _e === void 0 ? false : _e;
    var _f = (0, react_1.useState)({
        fullName: (initialData === null || initialData === void 0 ? void 0 : initialData.fullName) || "",
        email: (initialData === null || initialData === void 0 ? void 0 : initialData.email) || "",
        phone: (initialData === null || initialData === void 0 ? void 0 : initialData.phone) || "",
        whatsapp: (initialData === null || initialData === void 0 ? void 0 : initialData.whatsapp) || "",
        location: (initialData === null || initialData === void 0 ? void 0 : initialData.location) || "",
        address: (initialData === null || initialData === void 0 ? void 0 : initialData.address) || "",
        lat: (initialData === null || initialData === void 0 ? void 0 : initialData.lat) || -25.9964,
        lng: (initialData === null || initialData === void 0 ? void 0 : initialData.lng) || 28.2268,
        avatarUrl: (initialData === null || initialData === void 0 ? void 0 : initialData.avatarUrl) || "",
    }), formData = _f[0], setFormData = _f[1];
    var _g = (0, react_1.useState)(false), uploading = _g[0], setUploading = _g[1];
    var _h = (0, react_1.useState)(false), showMapPinConfirm = _h[0], setShowMapPinConfirm = _h[1];
    var _j = (0, react_1.useState)(false), isLocating = _j[0], setIsLocating = _j[1];
    var fileInputRef = (0, react_1.useRef)(null);
    var handleUpdateLocation = function () {
        setIsLocating(true);
        if (!navigator.geolocation) {
            sonner_1.toast.error("Geolocation is not supported by your browser");
            setIsLocating(false);
            setShowMapPinConfirm(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(function (position) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, latitude_1, longitude_1, data, retryCount_1, maxRetries, response, err_6, city, state, road, houseNumber, newLocation_1, newAddress_1, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 9, 10, 11]);
                        _a = position.coords, latitude_1 = _a.latitude, longitude_1 = _a.longitude;
                        data = null;
                        retryCount_1 = 0;
                        maxRetries = 2;
                        _c.label = 1;
                    case 1:
                        if (!(retryCount_1 <= maxRetries)) return [3 /*break*/, 8];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 5, , 7]);
                        return [4 /*yield*/, fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=".concat(latitude_1, "&lon=").concat(longitude_1, "&email=aviwenotununu4@gmail.com"))];
                    case 3:
                        response = _c.sent();
                        return [4 /*yield*/, response.json()];
                    case 4:
                        data = _c.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        err_6 = _c.sent();
                        retryCount_1++;
                        if (retryCount_1 > maxRetries)
                            throw err_6;
                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000 * retryCount_1); })];
                    case 6:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 7: return [3 /*break*/, 1];
                    case 8:
                        if (data && data.address) {
                            city = data.address.city ||
                                data.address.town ||
                                data.address.village ||
                                data.address.suburb ||
                                "";
                            state = data.address.state || "";
                            road = data.address.road || "";
                            houseNumber = data.address.house_number || "";
                            newLocation_1 = [city, state].filter(Boolean).join(", ");
                            newAddress_1 = [houseNumber, road].filter(Boolean).join(" ");
                            setFormData(function (prev) { return (__assign(__assign({}, prev), { location: newLocation_1 || prev.location, address: newAddress_1 || prev.address, lat: latitude_1, lng: longitude_1 })); });
                            sonner_1.toast.success("Location updated successfully!");
                        }
                        else {
                            sonner_1.toast.error("Could not determine address from coordinates.");
                        }
                        return [3 /*break*/, 11];
                    case 9:
                        _b = _c.sent();
                        sonner_1.toast.error("Failed to get address details.");
                        return [3 /*break*/, 11];
                    case 10:
                        setIsLocating(false);
                        setShowMapPinConfirm(false);
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        }); }, function (error) {
            console.error("Geolocation error:", error);
            sonner_1.toast.error("Location access failed: ".concat(error.message || "Please check permissions"));
            setIsLocating(false);
            setShowMapPinConfirm(false);
        }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 });
    };
    var handleFileChange = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var file, options, compressedFile, fileExt, fileName, filePath, uploadError, fallbackError, publicUrl_1, publicUrl_2, error_5;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (!file)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, 8, 9]);
                    setUploading(true);
                    options = {
                        maxSizeMB: 0.2,
                        maxWidthOrHeight: 1024,
                        useWebWorker: true,
                    };
                    return [4 /*yield*/, (0, browser_image_compression_1.default)(file, options)];
                case 2:
                    compressedFile = _b.sent();
                    fileExt = compressedFile.name.split(".").pop() || "jpg";
                    fileName = "".concat(userId, "-").concat(Math.random(), ".").concat(fileExt);
                    filePath = "avatars/".concat(fileName);
                    return [4 /*yield*/, supabase.storage
                            .from("avatars")
                            .upload(filePath, compressedFile)];
                case 3:
                    uploadError = (_b.sent()).error;
                    if (!uploadError) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase.storage
                            .from("menu-images")
                            .upload(filePath, compressedFile)];
                case 4:
                    fallbackError = (_b.sent()).error;
                    if (fallbackError)
                        throw uploadError;
                    publicUrl_1 = supabase.storage.from("menu-images").getPublicUrl(filePath).data.publicUrl;
                    setFormData(function (prev) { return (__assign(__assign({}, prev), { avatarUrl: publicUrl_1 })); });
                    return [3 /*break*/, 6];
                case 5:
                    publicUrl_2 = supabase.storage.from("avatars").getPublicUrl(filePath).data.publicUrl;
                    setFormData(function (prev) { return (__assign(__assign({}, prev), { avatarUrl: publicUrl_2 })); });
                    _b.label = 6;
                case 6:
                    sonner_1.toast.success("Photo uploaded successfully!");
                    return [3 /*break*/, 9];
                case 7:
                    error_5 = _b.sent();
                    console.error("Upload Error:", error_5);
                    sonner_1.toast.error("Failed to upload photo. Please ensure a storage bucket exists.");
                    return [3 /*break*/, 9];
                case 8:
                    setUploading(false);
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var _k = (0, react_1.useState)({
        open: ((_b = initialData === null || initialData === void 0 ? void 0 : initialData.operatingHours) === null || _b === void 0 ? void 0 : _b.open) || "08:00",
        close: ((_c = initialData === null || initialData === void 0 ? void 0 : initialData.operatingHours) === null || _c === void 0 ? void 0 : _c.close) || "20:00",
    }), operatingHours = _k[0], setOperatingHours = _k[1];
    var _l = (0, react_1.useState)({
        marketing: true,
        darkMode: false,
    }), preferences = _l[0], setPreferences = _l[1];
    var handleSave = function () {
        var phoneCleaned = formData.phone.replace(/[\s-]/g, "");
        var whatsappCleaned = (formData.whatsapp || "").replace(/[\s-]/g, "");
        // SA Phone Validation: +27XXXXXXXXX or 0XXXXXXXXX (10 or 11 digits total depending on format)
        var saRegex = /^(?:\+27|0)[0-9]{9}$/;
        if (!saRegex.test(phoneCleaned)) {
            sonner_1.toast.error("Please enter a valid South African phone number for calls (e.g., +27 82 123 4567 or 082 123 4567).");
            return;
        }
        if (formData.whatsapp && !saRegex.test(whatsappCleaned)) {
            sonner_1.toast.error("Please enter a valid WhatsApp number (like 082 123 4567).");
            return;
        }
        onSave(__assign(__assign(__assign({}, formData), preferences), { operatingHours: operatingHours }));
    };
    return (<div className="min-h-screen bg-surface font-body text-on-surface pb-24 selection:bg-primary/10 selection:text-primary">
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="active:scale-95 transition-transform duration-200 hover:opacity-80 p-2 rounded-full hover:bg-surface-container-low">
              <lucide_react_1.ArrowLeft className="text-primary" size={24}/>
            </button>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">
              Edit Profile
            </h1>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
            <lucide_react_1.MoreVertical className="text-on-surface-variant" size={24}/>
          </button>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full absolute bottom-0 opacity-15"></div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10">
        <section className="flex flex-col items-center">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-surface-container-lowest shadow-lg bg-surface-container-low flex items-center justify-center">
              {uploading ? (<lucide_react_1.RefreshCw className="animate-spin text-primary" size={32}/>) : formData.avatarUrl ? (<img alt="User Profile" className="w-full h-full object-cover" src={formData.avatarUrl}/>) : (<div className="w-full h-full flex items-center justify-center bg-primary" style={{
                background: "radial-gradient(circle at 30% 30%, #ff9d4d 0%, #f58220 100%)",
            }}>
                  <lucide_react_1.User size={64} className="text-white drop-shadow-md" strokeWidth={1.5}/>
                </div>)}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange}/>
            <button onClick={function () { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }} disabled={uploading} className="absolute bottom-0 right-0 bg-gradient-to-br from-primary to-primary-container p-2.5 rounded-full text-on-primary shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              <lucide_react_1.Edit2 size={16}/>
            </button>
          </div>
          <p className="mt-4 font-headline font-bold text-on-surface-variant tracking-tight">
            Change Photo
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Personal Details
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Basic Info
            </span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Full Name
              </label>
              <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" type="text" value={formData.fullName} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { fullName: e.target.value }));
        }}/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Email Address
              </label>
              <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" type="email" value={formData.email} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { email: e.target.value }));
        }}/>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm font-medium text-on-surface-variant px-1">
                <span>Phone Number</span>
                {!formData.phone && (<span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase animate-pulse">
                    <lucide_react_1.AlertCircle size={12}/> Required
                  </span>)}
              </label>
              <input className={cn("w-full border-none rounded-xl px-4 py-3.5 focus:ring-2 transition-all text-on-surface", !formData.phone ? "bg-error/5 ring-1 ring-error/20" : "bg-surface-container-low focus:ring-primary/40 focus:bg-surface-container-lowest")} type="tel" value={formData.phone} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setFormData(__assign(__assign({}, formData), { phone: result.formatted }));
        }} placeholder="e.g. +27 82 123 4567"/>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm font-medium text-on-surface-variant px-1">
                <span>WhatsApp Number (for Customers)</span>
                {!formData.whatsapp && (<span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase animate-pulse">
                    <lucide_react_1.AlertCircle size={12}/> Critical
                  </span>)}
              </label>
              <input className={cn("w-full border-none rounded-xl px-4 py-3.5 focus:ring-2 transition-all text-on-surface", !formData.whatsapp ? "bg-error/5 ring-1 ring-error/20" : "bg-surface-container-low focus:ring-primary/40 focus:bg-surface-container-lowest")} type="tel" value={formData.whatsapp} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setFormData(__assign(__assign({}, formData), { whatsapp: result.formatted }));
        }} placeholder="e.g. +27 82 123 4567"/>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Home Location
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Address
            </span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Search & Set Location
              </label>
              <AddressAutocomplete onSelect={function (lat, lng, address, location) {
            setFormData(function (prev) { return (__assign(__assign({}, prev), { lat: lat, lng: lng, address: address, location: location })); });
            sonner_1.toast.success("Location pinpointed!");
        }} initialValue={formData.address || formData.location} placeholder="Search for your street or area..."/>
            </div>
          </div>

          <div className="w-full h-48 rounded-xl overflow-hidden relative border border-outline-variant/20">
            <LeafletMap center={{ lat: formData.lat || -25.9964, lng: formData.lng || 28.2268 }} zoom={15} onLocationSelect={function (lat, lng) {
            setFormData(function (prev) { return (__assign(__assign({}, prev), { lat: lat, lng: lng })); });
            // Reverse geocode when pin moves manually
            fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=".concat(lat, "&lon=").concat(lng, "&email=aviwenotununu4@gmail.com"))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                if (data && data.address) {
                    var city = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
                    var road = data.address.road || "";
                    var houseNumber = data.address.house_number || "";
                    var newLocation_2 = [city, data.address.state].filter(Boolean).join(", ");
                    var newAddress_2 = [houseNumber, road].filter(Boolean).join(" ");
                    setFormData(function (prev) { return (__assign(__assign({}, prev), { location: newLocation_2 || prev.location, address: newAddress_2 || prev.address })); });
                }
            })
                .catch(function () { });
        }}/>
            <button type="button" onClick={function (e) {
            e.preventDefault();
            e.stopPropagation();
            setShowMapPinConfirm(true);
        }} className="absolute bottom-4 right-4 z-30 bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md hover:scale-105 hover:bg-surface-container-lowest transition-all cursor-pointer flex items-center gap-2 border border-outline-variant/20">
              <lucide_react_1.MapPin size={14} className="text-primary"/>
              <span className="text-[10px] font-bold text-primary">
                AUTO-LOCATE
              </span>
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Operating Hours
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Schedule
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Opening Time
              </label>
              <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" type="time" value={operatingHours.open} onChange={function (e) {
            return setOperatingHours(__assign(__assign({}, operatingHours), { open: e.target.value }));
        }}/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Closing Time
              </label>
              <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" type="time" value={operatingHours.close} onChange={function (e) {
            return setOperatingHours(__assign(__assign({}, operatingHours), { close: e.target.value }));
        }}/>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
            App Preferences
          </h2>
          <div className="bg-surface-container-low rounded-xl overflow-hidden divide-y divide-surface-container-high">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <lucide_react_1.Bell className="text-on-surface-variant" size={20}/>
                </div>
                <div>
                  <p className="font-medium text-on-surface">
                    Marketing Notifications
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Deals, offers, and new arrivals
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={preferences.marketing} onChange={function () {
            return setPreferences(__assign(__assign({}, preferences), { marketing: !preferences.marketing }));
        }}/>
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <lucide_react_1.Moon className="text-on-surface-variant" size={20}/>
                </div>
                <div>
                  <p className="font-medium text-on-surface">Dark Mode</p>
                  <p className="text-xs text-on-surface-variant">
                    Reduce eye strain at night
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={preferences.darkMode} onChange={function () {
            return setPreferences(__assign(__assign({}, preferences), { darkMode: !preferences.darkMode }));
        }}/>
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        <div className="pt-6 pb-12">
          <button onClick={handleSave} disabled={isSaving || isSuccess} className={cn("w-full text-on-primary font-headline font-extrabold text-lg py-5 rounded-full shadow-lg transition-all flex items-center justify-center gap-3", isSuccess
            ? "bg-emerald-500 shadow-emerald-500/20 active:scale-[0.98]"
            : isSaving
                ? "bg-surface-container-highest cursor-not-allowed text-on-surface-variant shadow-none"
                : "bg-gradient-to-br from-primary to-primary-container shadow-primary/20 active:scale-[0.98]")}>
            {isSuccess ? (<>
                <span>Saved Successfully!</span>
                <lucide_react_1.Check size={24} strokeWidth={3}/>
              </>) : isSaving ? (<>
                <span>Saving Changes...</span>
                <lucide_react_1.Loader2 className="animate-spin" size={24}/>
              </>) : (<>
                <span>Save Changes</span>
                <lucide_react_1.CheckCircle2 size={24}/>
              </>)}
          </button>
          <p className="text-center mt-6 text-on-surface-variant text-sm font-medium">
            Last updated: Oct 24, 2023
          </p>
        </div>
      </main>

      <react_2.AnimatePresence>
        {showMapPinConfirm && (<react_2.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <react_2.motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-outline-variant/20">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 mx-auto">
                <lucide_react_1.MapPin size={32}/>
              </div>
              <h3 className="text-2xl font-headline font-bold text-on-surface text-center mb-3">
                Update Location?
              </h3>
              <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                This will request your device's current location and
                automatically update your shop's City/Region and Street Address.
                Are you sure you want to proceed?
              </p>

              <div className="flex gap-4">
                <button onClick={function () { return setShowMapPinConfirm(false); }} disabled={isLocating} className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleUpdateLocation} disabled={isLocating} className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-on-primary bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLocating ? (<>
                      <lucide_react_1.RefreshCw className="animate-spin" size={18}/>
                      <span>Locating...</span>
                    </>) : (<span>Yes, Update</span>)}
                </button>
              </div>
            </react_2.motion.div>
          </react_2.motion.div>)}
      </react_2.AnimatePresence>
    </div>);
};
// --- Components ---
var StatCard = react_1.default.memo(function (_a) {
    var title = _a.title, value = _a.value, change = _a.change, Icon = _a.icon, colorClass = _a.colorClass, onClick = _a.onClick;
    return (<div onClick={onClick} className={cn("bg-surface-container-lowest p-4 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 group hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500 relative overflow-hidden", onClick && "cursor-pointer active:scale-95")}>
    <div className="absolute -right-4 -bottom-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-700 blur-[2px]">
      <Icon size={120}/>
    </div>
    <div className="flex justify-between items-start mb-4 md:mb-6 relative z-10">
      <div className={cn("p-2 md:p-3.5 rounded-2xl shadow-inner", colorClass)}>
        <Icon size={20} className="md:w-6 md:h-6"/>
      </div>
      {change && (<span className={cn("text-[9px] md:text-[10px] font-black px-2 py-0.5 md:py-1 rounded-full uppercase tracking-widest", (change === null || change === void 0 ? void 0 : change.startsWith("+"))
                ? "text-emerald-600 bg-emerald-50"
                : "text-primary bg-primary-fixed")}>
          {change}
        </span>)}
    </div>
    <div className="relative z-10">
      <p className="text-on-surface-variant/60 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] mb-1">
        {title}
      </p>
      <p className="text-xl md:text-3xl font-headline font-black text-on-surface tracking-tighter">
        {value}
      </p>
    </div>
  </div>);
});
// --- Components ---
var OnboardingChecklist = function (_a) {
    var _b, _c, _d, _e;
    var shops = _a.shops, user = _a.user, onNavigate = _a.onNavigate, onEditProfile = _a.onEditProfile, hasMenu = _a.hasMenu;
    var userOwnedShops = shops.filter(function (s) { return s.owner_id === (user === null || user === void 0 ? void 0 : user.id); });
    var hasShop = userOwnedShops.length > 0;
    var hasOperatingHours = ((_c = (_b = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _b === void 0 ? void 0 : _b.operating_hours) === null || _c === void 0 ? void 0 : _c.open) &&
        ((_e = (_d = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _d === void 0 ? void 0 : _d.operating_hours) === null || _e === void 0 ? void 0 : _e.close);
    var tasks = [
        { key: "shop", completed: hasShop, label: "Create Shop" },
        { key: "hours", completed: hasOperatingHours, label: "Set Hours" },
        { key: "menu", completed: hasMenu, label: "Add Menu Items" },
    ];
    var completedCount = tasks.filter(function (t) { return t.completed; }).length;
    var progressPercent = Math.round((completedCount / tasks.length) * 100);
    if (hasShop && hasOperatingHours && hasMenu)
        return null;
    return (<react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 border border-primary/20 rounded-2xl md:rounded-3xl p-4 md:p-8 mb-8 md:mb-12 relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg shrink-0">
            <lucide_react_1.Rocket className="text-primary w-5 h-5 md:w-6 md:h-6"/>
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-headline font-bold text-on-surface tracking-tight leading-tight">
              Ready to Launch?
            </h2>
            <p className="text-xs md:text-sm text-on-surface-variant font-medium">
              Complete these steps to start accepting orders from thirsty customers.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-white/40 dark:bg-black/20 px-3 py-2 rounded-2xl md:px-4 md:py-3 border border-primary/10">
          <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0">
            <svg className="w-full h-full rotate-[-90deg]">
              <circle cx="50%" cy="50%" r="40%" className="stroke-primary/10 fill-none" strokeWidth="4"/>
              <react_2.motion.circle cx="50%" cy="50%" r="40%" className="stroke-primary fill-none" strokeWidth="4" strokeLinecap="round" strokeDasharray="100 100" initial={{ strokeDashoffset: 100 }} animate={{ strokeDashoffset: 100 - progressPercent }} transition={{ duration: 1, ease: "easeOut" }}/>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] md:text-xs font-black text-primary">{progressPercent}%</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Progress</p>
            <p className="text-sm font-bold text-on-surface">{completedCount}/{tasks.length} Steps Done</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <button onClick={function () { return onNavigate("menu"); }} className={cn("flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all", hasShop
            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
            : "bg-white border-outline-variant hover:border-primary group")}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className={cn("p-2 rounded-full", hasShop
            ? "bg-emerald-100"
            : "bg-surface-container-high group-hover:bg-primary/10")}>
              {hasShop ? <lucide_react_1.CheckCircle2 size={18}/> : <lucide_react_1.Store size={18}/>}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm md:text-base">
                Create your first Shop
              </p>
              <p className="text-[10px] md:text-xs opacity-70">
                {hasShop ? "Completed" : "Required to start selling"}
              </p>
            </div>
          </div>
          {!hasShop && <lucide_react_1.ChevronRight size={18} className="text-primary"/>}
        </button>

        <button onClick={onEditProfile} className={cn("flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all", hasOperatingHours
            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
            : "bg-white border-outline-variant hover:border-primary group")}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className={cn("p-2 rounded-full", hasOperatingHours
            ? "bg-emerald-100"
            : "bg-surface-container-high group-hover:bg-primary/10")}>
              {hasOperatingHours ? (<lucide_react_1.CheckCircle2 size={18}/>) : (<lucide_react_1.Clock size={18}/>)}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm md:text-base">
                Set Operating Hours
              </p>
              <p className="text-[10px] md:text-xs opacity-70">
                {hasOperatingHours ? "Completed" : "Automate your shop status"}
              </p>
            </div>
          </div>
          {!hasOperatingHours && (<lucide_react_1.ChevronRight size={18} className="text-primary"/>)}
        </button>

        <button onClick={function () { return onNavigate("menu"); }} className={cn("flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all", hasMenu
            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
            : "bg-white border-outline-variant hover:border-primary group")}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className={cn("p-2 rounded-full", hasMenu
            ? "bg-emerald-100"
            : "bg-surface-container-high group-hover:bg-primary/10")}>
              {hasMenu ? (<lucide_react_1.CheckCircle2 size={18}/>) : (<lucide_react_1.UtensilsCrossed size={18}/>)}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm md:text-base">
                Add Menu Items
              </p>
              <p className="text-[10px] md:text-xs opacity-70">
                {hasMenu ? "Completed" : "Upload your delicious dishes"}
              </p>
            </div>
          </div>
          {!hasMenu && <lucide_react_1.ChevronRight size={18} className="text-primary"/>}
        </button>
      </div>
      {!hasOperatingHours && hasShop && (<p className="mt-4 text-[10px] md:text-xs text-orange-600 font-medium flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl">
          <lucide_react_1.AlertCircle size={14}/>
          Your shop will remain closed until you set operating hours in your
          profile.
        </p>)}
    </react_2.motion.div>);
};
// --- Payment Components ---
var PaymentHistory = function (_a) {
    var shopId = _a.shopId;
    var _b = (0, react_1.useState)([]), payments = _b[0], setPayments = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(""), searchTerm = _d[0], setSearchTerm = _d[1];
    var _e = (0, react_1.useState)("All"), filterStatus = _e[0], setFilterStatus = _e[1];
    var _f = (0, react_1.useState)("payment_date"), sortField = _f[0], setSortField = _f[1];
    var _g = (0, react_1.useState)("desc"), sortDirection = _g[0], setSortDirection = _g[1];
    (0, react_1.useEffect)(function () {
        var fetchPayments = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, error, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setLoading(true);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, supabase
                                .from("payments")
                                .select("*")
                                .eq("shop_id", shopId)
                                .order(sortField, { ascending: sortDirection === "asc" })];
                    case 2:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        setPayments(data || []);
                        return [3 /*break*/, 5];
                    case 3:
                        error_6 = _b.sent();
                        console.error("Error fetching payments:", error_6);
                        sonner_1.toast.error("Failed to load payment history");
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchPayments();
    }, [shopId, sortField, sortDirection]);
    var filteredPayments = payments.filter(function (p) {
        var matchesSearch = p.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.payment_method.toLowerCase().includes(searchTerm.toLowerCase());
        var matchesFilter = filterStatus === "All" || p.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    var handleSort = function (field) {
        if (sortField === field) {
            setSortDirection(function (prev) { return (prev === "asc" ? "desc" : "asc"); });
        }
        else {
            setSortField(field);
            setSortDirection("desc");
        }
    };
    if (loading) {
        return (<div className="space-y-6">
        <Skeleton className="h-12 w-64"/>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(function (i) { return (<Skeleton key={i} className="h-20 rounded-xl"/>); })}
        </div>
      </div>);
    }
    return (<div className="space-y-8">
      <section className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
          Payment History
        </h2>
        <p className="text-sm text-on-surface-variant font-medium">
          View and manage your subscription payments and transactions.
        </p>
      </section>

      <react_2.motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <lucide_react_1.Sparkles size={28} className="text-white"/>
          </div>
          <div>
            <h3 className="text-xl font-headline font-black tracking-tight">
              0% Commission - You Keep 100%
            </h3>
            <p className="text-emerald-50 font-medium text-sm mt-1">
              LocalEats is currently 100% free for all vendors. Grow your
              business without worrying about fees!
            </p>
          </div>
        </div>
        <div className="bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold whitespace-nowrap shadow-sm">
          Active Plan: Free Tier
        </div>
      </react_2.motion.div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <lucide_react_1.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18}/>
          <input type="text" placeholder="Search by Transaction ID or Method..." value={searchTerm} onChange={function (e) { return setSearchTerm(e.target.value); }} className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/40 outline-none transition-all"/>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select value={filterStatus} onChange={function (e) {
            return setFilterStatus(e.target.value);
        }} className="flex-1 md:flex-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold outline-none">
            <option value="All">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/10">
            <button onClick={function () { return handleSort("payment_date"); }} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", sortField === "payment_date"
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container-high")}>
              Date
            </button>
            <button onClick={function () { return handleSort("amount"); }} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", sortField === "amount"
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container-high")}>
              Amount
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/30">
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Date
                </th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Transaction ID
                </th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Method
                </th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Amount
                </th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 text-center">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredPayments.length > 0 ? (filteredPayments.map(function (payment) { return (<tr key={payment.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-5 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-on-surface">
                          {(0, date_fns_1.format)(new Date(payment.payment_date), "MMM dd, yyyy")}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {(0, date_fns_1.format)(new Date(payment.payment_date), "HH:mm")}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-mono text-xs text-on-surface-variant font-medium">
                        {payment.transaction_id}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
                          {payment.payment_method === "OTT" ? (<lucide_react_1.Ticket size={14} className="text-primary"/>) : (<lucide_react_1.CreditCard size={14} className="text-primary"/>)}
                        </div>
                        <span className="text-sm font-bold text-on-surface">
                          {payment.payment_method}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-headline font-black text-on-surface">
                        R {Number(payment.amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex justify-center">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", payment.status === "success"
                ? "bg-emerald-100 text-emerald-700"
                : payment.status === "pending"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700")}>
                          {payment.status}
                        </span>
                      </div>
                    </td>
                  </tr>); })) : (<tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center">
                        <lucide_react_1.ReceiptText className="text-on-surface-variant/20" size={32}/>
                      </div>
                      <p className="text-on-surface-variant italic text-sm">
                        No payment records found.
                      </p>
                    </div>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
};
var DashboardOverview = react_1.default.memo(function (_a) {
    var orders = _a.orders, loading = _a.loading, shops = _a.shops, user = _a.user, onRefresh = _a.onRefresh, onNavigate = _a.onNavigate, onEditProfile = _a.onEditProfile, menuItems = _a.menuItems, trialInfo = _a.trialInfo, currentShop = _a.currentShop, darkMode = _a.darkMode;
    var _b = (0, react_1.useState)("--"), followerCount = _b[0], setFollowerCount = _b[1];
    var _c = (0, react_1.useState)("0"), followerTrend = _c[0], setFollowerTrend = _c[1];
    var _d = (0, react_1.useState)([]), recentFollowers = _d[0], setRecentFollowers = _d[1];
    // Helper for weekly reset
    var getStartOfWeek = function () {
        var now = new Date();
        var day = now.getDay();
        var diff = now.getDate() - day + (day === 0 ? -6 : 1);
        var start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        return start;
    };
    var startOfWeek = getStartOfWeek();
    var weeklyOrders = orders.filter(function (o) { return new Date(o.created_at) >= startOfWeek; });
    // Robust total sales calculation (Weekly)
    var weeklySales = weeklyOrders.reduce(function (acc, curr) {
        var price = typeof curr.total_price === "string"
            ? parseFloat(curr.total_price.replace(/[^0-9.]/g, ""))
            : Number(curr.total_price);
        return acc + (isNaN(price) ? 0 : price);
    }, 0);
    var totalSales = orders.reduce(function (acc, curr) {
        var price = typeof curr.total_price === "string"
            ? parseFloat(curr.total_price.replace(/[^0-9.]/g, ""))
            : Number(curr.total_price);
        return acc + (isNaN(price) ? 0 : price);
    }, 0);
    var orderCount = weeklyOrders.length;
    var hasMenu = menuItems.length > 0;
    var _e = (0, react_1.useState)("monthly"), timeframe = _e[0], setTimeframe = _e[1];
    var avgPrepTime = (0, react_1.useMemo)(function () {
        var pendingCount = orders.filter(function (o) { return o.status === "pending" || o.status === "preparing"; }).length;
        return Number(Math.min(12 + pendingCount * 1.5, 45)).toFixed(1);
    }, [orders]);
    var _f = (0, react_1.useState)([]), connections = _f[0], setConnections = _f[1];
    var fetchRiders = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase
                            .from("rider_connections")
                            .select("*")
                            .eq("shop_id", currentShop.id)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (!error && data) {
                        setConnections(data);
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id]);
    var connectedRidersCount = connections.filter(function (c) { return c.rider_id && new Date(c.expires_at) >= new Date(); }).length;
    (0, react_1.useEffect)(function () {
        fetchRiders();
        if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
            return;
        var channel = supabase
            .channel("dashboard_riders_".concat(currentShop.id))
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "rider_connections",
            filter: "shop_id=eq.".concat(currentShop.id),
        }, function () { return fetchRiders(); })
            .subscribe();
        return function () {
            supabase.removeChannel(channel);
        };
    }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id, fetchRiders]);
    var fetchFollowers = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, count, error, yesterday, _b, recentCount, trendError, _c, recentData, recentError, err_7;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
                        return [2 /*return*/];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, supabase
                            .from("shop_followers")
                            .select("*", { count: "exact", head: true })
                            .eq("shop_id", currentShop.id)];
                case 2:
                    _a = _d.sent(), count = _a.count, error = _a.error;
                    if (error)
                        throw error;
                    setFollowerCount(count || 0);
                    yesterday = new Date();
                    yesterday.setHours(yesterday.getHours() - 24);
                    return [4 /*yield*/, supabase
                            .from("shop_followers")
                            .select("*", { count: "exact", head: true })
                            .eq("shop_id", currentShop.id)
                            .gt("created_at", yesterday.toISOString())];
                case 3:
                    _b = _d.sent(), recentCount = _b.count, trendError = _b.error;
                    if (!trendError) {
                        setFollowerTrend("+".concat(recentCount || 0));
                    }
                    return [4 /*yield*/, supabase
                            .from("shop_followers")
                            .select("id, created_at")
                            .eq("shop_id", currentShop.id)
                            .order("created_at", { ascending: false })
                            .limit(5)];
                case 4:
                    _c = _d.sent(), recentData = _c.data, recentError = _c.error;
                    if (!recentError && recentData) {
                        setRecentFollowers(recentData);
                    }
                    return [3 /*break*/, 6];
                case 5:
                    err_7 = _d.sent();
                    console.error("Error fetching followers:", err_7);
                    setFollowerCount(0);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id]);
    (0, react_1.useEffect)(function () {
        fetchFollowers();
        // Real-time subscription for followers
        if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
            return;
        var channel = supabase
            .channel("shop_followers_".concat(currentShop.id))
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "shop_followers",
            filter: "shop_id=eq.".concat(currentShop.id),
        }, function () {
            fetchFollowers();
        })
            .subscribe();
        return function () {
            supabase.removeChannel(channel);
        };
    }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id, fetchFollowers]);
    // Use real trend data from the last 7 or 30 days
    var trendData = (0, react_1.useMemo)(function () {
        if (orders.length === 0)
            return [];
        var daysCount = timeframe === "weekly" ? 7 : 30;
        var lastDays = Array.from({ length: daysCount }, function (_, index) {
            var d = new Date();
            d.setDate(d.getDate() - index);
            return {
                date: d.toISOString().split("T")[0],
                dayName: daysCount === 7 ? (0, date_fns_1.format)(d, "EEE") : (0, date_fns_1.format)(d, "MMM d"),
                count: 0,
            };
        }).reverse();
        orders.forEach(function (order) {
            try {
                if (!order.created_at)
                    return;
                var dateObj = new Date(order.created_at);
                if (isNaN(dateObj.getTime()))
                    return;
                var orderDate_1 = dateObj.toISOString().split("T")[0];
                var day = lastDays.find(function (d) { return d.date === orderDate_1; });
                if (day)
                    day.count++;
            }
            catch (e) {
                console.error("Error parsing order date:", e);
            }
        });
        return lastDays.map(function (d) { return ({ name: d.dayName, value: d.count }); });
    }, [orders, timeframe]);
    var greeting = (0, react_1.useMemo)(function () {
        var hour = new Date().getHours();
        if (hour < 12)
            return "Good Morning";
        if (hour < 18)
            return "Good Afternoon";
        return "Good Evening";
    }, []);
    var exportWeeklyCSV = function () {
        if (weeklyOrders.length === 0) {
            sonner_1.toast.error("No orders this week to export. Check back later!");
            return;
        }
        var headers = ["Order ID", "Product", "Price", "Status", "Date"];
        var csvContent = __spreadArray([
            headers.join(",")
        ], weeklyOrders.map(function (o) {
            return [
                o.id,
                "\"".concat(o.product_name, "\""),
                o.total_price,
                o.status,
                new Date(o.created_at).toLocaleDateString(),
            ].join(",");
        }), true).join("\n");
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        var link = document.createElement("a");
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "localeats_weekly_report_".concat(new Date().toISOString().split("T")[0], ".csv"));
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        sonner_1.toast.success("Weekly report exported successfully!");
    };
    var generateTestOrder = function () { return __awaiter(void 0, void 0, void 0, function () {
        var testOrder, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!currentShop)
                        return [2 /*return*/];
                    testOrder = {
                        shop_id: currentShop.id,
                        user_id: (user === null || user === void 0 ? void 0 : user.id) || null,
                        customer_name: "Debug Customer",
                        phone: "000 000 0000",
                        email: "debug@example.com",
                        address: currentShop.address || "123 Default St",
                        city: "Tembisa",
                        product_name: "Test Burger (Debug)",
                        restaurant_name: currentShop.name,
                        total_price: 55,
                        price: 55,
                        status: "pending",
                        order_type: "delivery",
                        items: ["Test Burger (Debug)"],
                        created_at: new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .insert(testOrder)
                            .select()
                            .single()];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        sonner_1.toast.error("We couldn't create a test order right now. Please try again.");
                    }
                    else {
                        sonner_1.toast.success("Test order generated! Go to Orders to accept it.", {
                            description: 'Once accepted, click "Invoke Rider Dispatch" to test the Rider app feed.',
                            duration: 8000,
                        });
                        onRefresh();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return (<div className="space-y-12 animate-pulse">
        <section className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-10 w-64 md:w-80 rounded-xl"/>
              <Skeleton className="h-4 w-48 md:w-64"/>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10 md:w-24 rounded-xl"/>
              <Skeleton className="h-10 w-10 md:w-24 rounded-xl"/>
              <Skeleton className="h-10 w-10 rounded-xl"/>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5].map(function (i) { return (<Skeleton key={i} className="h-32 rounded-[2rem]"/>); })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton className="h-96 rounded-[2.5rem]"/>
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-12 w-48 mb-4"/>
            {[1, 2, 3, 4, 5].map(function (i) { return (<div key={i} className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full shrink-0"/>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4"/>
                  <Skeleton className="h-3 w-1/2"/>
                </div>
              </div>); })}
          </div>
        </div>
      </div>);
    }
    return (<div className="space-y-8 md:space-y-12">
      {currentShop && (!currentShop.phone || !currentShop.whatsapp) && (<react_2.motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group mb-4">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
             <lucide_react_1.MessageCircle size={120}/>
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 shadow-lg shadow-primary/20">
              <lucide_react_1.Phone size={32}/>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-headline font-bold text-on-surface">
                Complete Your Store Profile
              </h3>
              <p className="text-sm text-on-surface-variant max-w-md font-medium leading-relaxed">
                Add your WhatsApp and Phone number so customers can contact you directly for order inquiries and support.
              </p>
            </div>
          </div>
          <button onClick={function () { return onNavigate("storefront"); }} className="w-full md:w-auto px-8 py-4 bg-primary text-on-primary rounded-2xl font-headline font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all relative z-10">
            Update Profile
          </button>
        </react_2.motion.div>)}

      <react_2.motion.section initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
              {greeting}, Chef!
            </h1>
            <p className="text-sm text-on-surface-variant font-medium">
              Here is what's happening in your kitchen today.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={generateTestOrder} className="p-3 bg-primary/5 text-primary rounded-xl hover:bg-primary/10 transition-colors border border-primary/10 flex items-center gap-2 text-xs font-bold" title="Generate Debug Order">
              <lucide_react_1.Plus size={18}/>
              <span className="hidden sm:inline">Test Order</span>
            </button>
            <button onClick={exportWeeklyCSV} className="p-3 bg-surface-container-low text-primary rounded-xl hover:bg-surface-container-high transition-colors shadow-sm self-end sm:self-auto flex items-center gap-2 text-xs font-bold" title="Download Weekly Report">
              <lucide_react_1.Download size={18}/>
              <span className="hidden sm:inline">Weekly Report</span>
            </button>
            <button onClick={function () {
            onRefresh();
            sonner_1.toast.success("Dashboard refreshed");
        }} className="p-3 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-colors shadow-sm self-end sm:self-auto" title="Refresh Dashboard">
              <lucide_react_1.RefreshCw size={20} className={loading ? "animate-spin" : ""}/>
            </button>
          </div>
        </div>
      </react_2.motion.section>

      <OnboardingChecklist shops={shops} user={user} onNavigate={onNavigate} onEditProfile={onEditProfile} hasMenu={hasMenu}/>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
        <react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="contents">
          <StatCard title="Weekly Sales" value={"R ".concat(weeklySales.toLocaleString())} change={"".concat(Number((weeklySales / (totalSales || 1)) * 100).toFixed(1), "% of total")} icon={lucide_react_1.TrendingUp} colorClass="bg-primary-fixed text-primary"/>
        </react_2.motion.div>
        <react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="contents">
          <StatCard title="Weekly Orders" value={orderCount} change="This Week" icon={lucide_react_1.ReceiptText} colorClass="bg-orange-50 text-orange-700"/>
        </react_2.motion.div>
        <react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="contents">
          <StatCard title="Connected Riders" value={connectedRidersCount} change={"".concat(connections.filter(function (c) { return !c.rider_id; }).length, " codes")} icon={lucide_react_1.Bike} colorClass="bg-primary/10 text-primary" onClick={function () { return onNavigate("riders"); }}/>
        </react_2.motion.div>
        <react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="contents">
          <StatCard title="Low Stock" value={menuItems.filter(function (i) { return i.stock_quantity !== null && (i.stock_quantity || 0) < 5; }).length} change="Alert" icon={lucide_react_1.AlertCircle} colorClass="bg-error/10 text-error" onClick={function () { return onNavigate("menu"); }}/>
        </react_2.motion.div>
        <react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="contents">
          <StatCard title="Followers" value={followerCount} change={followerTrend} icon={lucide_react_1.Users} colorClass="bg-blue-50 text-blue-600"/>
        </react_2.motion.div>
        <react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <StatCard title="Avg. Prep" value={"".concat(avgPrepTime, "m")} change="0" icon={lucide_react_1.Clock} colorClass="bg-zinc-100 text-zinc-700"/>
        </react_2.motion.div>
        {trialInfo && (<react_2.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className={cn("p-6 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col justify-between h-full", trialInfo.isExpired ? "bg-error/5" : "bg-primary/5")}>
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl", trialInfo.isExpired
                ? "bg-error/10 text-error"
                : "bg-primary/10 text-primary")}>
                  <lucide_react_1.Zap size={20}/>
                </div>
                <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", trialInfo.isExpired
                ? "bg-error text-white"
                : "bg-primary text-on-primary")}>
                  {trialInfo.isExpired ? "Expired" : "Trial"}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">
                  Subscription
                </p>
                <h3 className="text-2xl font-black text-on-surface">
                  {trialInfo.isExpired
                ? "Action Required"
                : "".concat(trialInfo.daysRemaining, " Days Left")}
                </h3>
                <p className="text-[10px] font-medium text-on-surface-variant mt-1">
                  {trialInfo.isExpired
                ? "Your trial has ended."
                : "Your free trial for ".concat((currentShop === null || currentShop === void 0 ? void 0 : currentShop.name) || "your shop", " is active.")}
                </p>
              </div>
            </div>
          </react_2.motion.div>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <react_2.motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="lg:col-span-8 bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-xl font-headline font-bold text-on-surface">
                Order Volume Trends
              </h2>
              <p className="text-sm text-on-surface-variant">
                Live performance tracking
              </p>
            </div>
            {orders.length > 0 && (<div className="flex gap-2">
                <button onClick={function () { return setTimeframe("weekly"); }} className={cn("px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all", timeframe === "weekly"
                ? "bg-primary text-on-primary"
                : "bg-white dark:bg-surface-container-high text-on-surface-variant")}>
                  Weekly
                </button>
                <button onClick={function () { return setTimeframe("monthly"); }} className={cn("px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all", timeframe === "monthly"
                ? "bg-primary text-on-primary"
                : "bg-white dark:bg-surface-container-high text-on-surface-variant")}>
                  Monthly
                </button>
              </div>)}
          </div>

          <div className="h-64 w-full flex items-center justify-center" style={{ minHeight: "256px" }}>
            {orders.length > 0 ? (<recharts_1.ResponsiveContainer width="99%" height="100%" minHeight={256} minWidth={1}>
                <recharts_1.BarChart data={trendData}>
                  <recharts_1.Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {trendData.map(function (entry, index) { return (<recharts_1.Cell key={"cell-".concat(index)} fill={index === trendData.length - 1 ? "#f58220" : "#f582204d"}/>); })}
                  </recharts_1.Bar>
                  <recharts_1.XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#5c4037" }}/>
                  <recharts_1.Tooltip cursor={{ fill: "transparent" }} contentStyle={{
                borderRadius: "16px",
                border: "none",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                backgroundColor: darkMode ? "#1c1c1c" : "#ffffff",
            }}/>
                </recharts_1.BarChart>
              </recharts_1.ResponsiveContainer>) : (<div className="text-center py-8">
                <div className="relative w-32 h-32 mx-auto mb-6">
                  <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse"/>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <lucide_react_1.TrendingUp className="text-primary/20" size={56}/>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Grow Your Business</h3>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto opacity-70">
                  We'll start tracking your sales trends automatically as soon as your first orders arrive.
                </p>
              </div>)}
          </div>
        </react_2.motion.div>

        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-lg font-headline font-bold text-on-surface px-2">
            Quick Actions
          </h3>
          {[
            {
                id: "menu",
                title: "Update Menu",
                sub: "Modify items & pricing",
                icon: lucide_react_1.UtensilsCrossed,
                color: "bg-primary-fixed text-primary",
            },
            {
                id: "riders",
                title: "Rider Fleet",
                sub: "Manage pairings & QR codes",
                icon: lucide_react_1.Bike,
                color: "bg-blue-50 text-blue-600",
            },
            {
                id: "insights",
                title: "Performance Insights",
                sub: "View trends & analytics",
                icon: lucide_react_1.TrendingUp,
                color: "bg-secondary-fixed text-on-secondary-fixed",
            },
            {
                id: "orders",
                title: "Kitchen Settings",
                sub: "System & app preferences",
                icon: lucide_react_1.ReceiptText,
                color: "bg-zinc-100 text-zinc-600",
            },
        ].map(function (action, i) { return (<react_2.motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} key={i} onClick={function () { return onNavigate(action.id); }} className="w-full flex items-center justify-between p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:bg-primary/5 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", action.color)}>
                  <action.icon size={20}/>
                </div>
                <div className="text-left">
                  <p className="font-bold text-on-surface">{action.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    {action.sub}
                  </p>
                </div>
              </div>
              <lucide_react_1.ChevronRight size={20} className="text-on-surface-variant group-hover:translate-x-1 transition-transform"/>
            </react_2.motion.button>); })}
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      {menuItems.filter(function (i) { return i.stock_quantity !== null && (i.stock_quantity || 0) < 5; }).length > 0 && (<react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-error/5 border border-error/20 rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-error/10 text-error rounded-2xl flex items-center justify-center">
                <lucide_react_1.AlertCircle size={24}/>
              </div>
              <div>
                <h2 className="text-xl font-headline font-bold text-on-surface">
                  Low Stock Alerts
                </h2>
                <p className="text-sm text-on-surface-variant">
                  These items are running low and need restocking soon.
                </p>
              </div>
            </div>
            <button onClick={function () { return onNavigate("menu"); }} className="px-6 py-2 bg-error text-white text-xs font-bold rounded-full hover:bg-error/90 transition-colors shadow-sm">
              Restock Now
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems
                .filter(function (i) { return i.stock_quantity !== null && (i.stock_quantity || 0) < 5; })
                .map(function (item) { return (<div key={item.id} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-4 group hover:border-error/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container flex items-center justify-center">
                    {!isPlaceholderImage(item.image_url) ? (<img src={item.image_url} alt={item.name} className="w-full h-full object-cover"/>) : (<FoodPlaceholder size={20}/>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-on-surface truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-error rounded-full" style={{
                    width: "".concat((item.stock_quantity || 0) * 20, "%"),
                }}/>
                      </div>
                      <span className="text-[10px] font-black text-error">
                        {item.stock_quantity || 0} left
                      </span>
                    </div>
                  </div>
                </div>); })}
          </div>
        </react_2.motion.section>)}

      {/* Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-8 bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-headline font-bold text-on-surface">
              Recent Activity
            </h2>
            <button onClick={function () { return onNavigate("orders"); }} className="text-xs font-bold text-primary hover:underline">
              View All Activity
            </button>
          </div>
          <div className="space-y-6">
            {orders.slice(0, 5).map(function (order, i) { return (<react_2.motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} key={order.id} className="flex items-center justify-between group p-3 hover:bg-surface-container-high rounded-2xl transition-colors cursor-pointer" onClick={function () { return onNavigate("orders"); }}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-11 h-11 rounded-full flex items-center justify-center border-2 border-transparent group-hover:border-primary/10 transition-all shadow-sm", order.status === "completed"
                ? "bg-emerald-100/50 text-emerald-600 shadow-emerald-500/5"
                : order.status === "pending"
                    ? "bg-primary/10 text-primary"
                    : "bg-blue-100/50 text-blue-600 shadow-blue-500/5")}>
                    {order.status === "completed" ? (<lucide_react_1.CheckCircle2 size={18}/>) : (<lucide_react_1.Clock size={18}/>)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-snug">
                      Order <span className="text-primary font-mono tracking-tighter">#{order.id.toString().slice(-4)}</span>{" "}
                      {order.status === "completed" ? "Completed" : order.status === "cancelled" ? "Cancelled" : "Received"}
                    </p>
                    <p className="text-[10px] md:text-xs text-on-surface-variant/80 font-medium mt-0.5">
                      {order.product_name} •{" "}
                      {(0, date_fns_1.format)(new Date(order.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-on-surface">
                    R {Number(order.total_price || 0).toFixed(2)}
                  </p>
                  <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full mt-1", order.status === "completed" ? "bg-emerald-500/10" : "bg-primary/10")}>
                    <div className={cn("w-1 h-1 rounded-full", order.status === "completed" ? "bg-emerald-500" : "bg-primary")}/>
                    <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest leading-none">
                      {order.status}
                    </span>
                  </div>
                </div>
                </react_2.motion.div>); })}
            {orders.length === 0 && (<div className="py-20 text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                   <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse-slow font-mono"/>
                   <div className="absolute inset-0 flex items-center justify-center opacity-20">
                     <lucide_react_1.ReceiptText size={48}/>
                   </div>
                </div>
                <div className="max-w-xs mx-auto">
                  <h3 className="font-bold text-on-surface">Awaiting Your First Order</h3>
                  <p className="text-xs text-on-surface-variant mt-2 opacity-70">
                    Your shop activity will appear here in real-time as customers place their orders.
                  </p>
                </div>
              </div>)}
          </div>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="lg:col-span-4 bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-headline font-bold text-on-surface">
              Recent Followers
            </h2>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <lucide_react_1.Users size={16}/>
            </div>
          </div>
          <div className="space-y-6">
            {recentFollowers.length > 0 ? (recentFollowers.map(function (follower) { return (<div key={follower.id} className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {follower.id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      New Follower
                    </p>
                    <p className="text-[10px] text-on-surface-variant/60 font-medium">
                      {(0, date_fns_1.format)(new Date(follower.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>
                </div>); })) : (<div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant/20">
                  <lucide_react_1.Users size={32}/>
                </div>
                <p className="text-on-surface-variant text-sm font-medium italic">
                  No followers yet.
                </p>
                <p className="text-[10px] text-on-surface-variant/60 leading-tight">
                  Share your shop link to get more followers!
                </p>
              </div>)}
          </div>
        </react_2.motion.section>
      </div>
    </div>);
});
var CreateShop = function (_a) {
    var _b, _c;
    var user = _a.user, onShopCreated = _a.onShopCreated, setIsSaving = _a.setIsSaving, setIsSaveSuccess = _a.setIsSaveSuccess;
    var _d = (0, react_1.useState)({
        name: "",
        description: "",
        location: ((_b = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _b === void 0 ? void 0 : _b.address) || "",
        category: "Restaurant",
        phone: ((_c = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _c === void 0 ? void 0 : _c.phone) || "",
        email: (user === null || user === void 0 ? void 0 : user.email) || "",
    }), formData = _d[0], setFormData = _d[1];
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var error, err_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!user) {
                        sonner_1.toast.error("Please sign in to create a shop.");
                        return [2 /*return*/];
                    }
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase.from("shops").insert(__assign(__assign({}, formData), { owner_id: user.id, is_active: true }))];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw error;
                    setIsSaving(false);
                    setIsSaveSuccess(true);
                    setTimeout(function () {
                        setIsSaveSuccess(false);
                        sonner_1.toast.success("Shop created successfully!");
                        onShopCreated();
                    }, 1500);
                    return [3 /*break*/, 4];
                case 3:
                    err_8 = _a.sent();
                    setIsSaving(false);
                    setIsSaveSuccess(false);
                    sonner_1.toast.error("Failed to create shop: ".concat(err_8 instanceof Error ? err_8.message : "Unknown error"));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<react_2.motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-3xl mx-auto bg-surface-container-lowest p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-outline-variant/10">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <lucide_react_1.Store className="text-primary" size={40}/>
        </div>
        <h2 className="text-3xl font-headline font-extrabold text-on-surface mb-2">
          Create Your Shop
        </h2>
        <p className="text-on-surface-variant">
          Tell us about your kitchen to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface ml-1">
              Shop Name
            </label>
            <input required className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all" placeholder="e.g. Mama's Kitchen" value={formData.name} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { name: e.target.value }));
        }}/>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface ml-1">
              Category
            </label>
            <select className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all" value={formData.category} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { category: e.target.value }));
        }}>
              <option>Restaurant</option>
              <option>Bakery</option>
              <option>Cafe</option>
              <option>Street Food</option>
              <option>Home Kitchen</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-on-surface ml-1">
            Description
          </label>
          <textarea required className="w-full p-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all min-h-[100px]" placeholder="Tell customers what makes your shop special..." value={formData.description} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { description: e.target.value }));
        }}/>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-on-surface ml-1">
            Location
          </label>
          <input required className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all" placeholder="e.g. Soweto, Johannesburg" value={formData.location} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { location: e.target.value }));
        }}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface ml-1">
              Contact Phone
            </label>
            <input type="tel" className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all" placeholder="e.g. +27 12 345 6789" value={formData.phone} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setFormData(__assign(__assign({}, formData), { phone: result.formatted }));
        }}/>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface ml-1">
              Contact Email
            </label>
            <input type="email" className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all" placeholder="e.g. hello@mamas.co.za" value={formData.email} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { email: e.target.value }));
        }}/>
          </div>
        </div>

        <button disabled={isSaving} className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg rounded-full shadow-lg hover:scale-[0.98] active:scale-95 transition-all disabled:opacity-50 mt-4" type="submit">
          {isSaving ? "Creating..." : "Launch Shop"}
        </button>
      </form>
    </react_2.motion.div>);
};
var MenuManagement = function (_a) {
    var shops = _a.shops, loading = _a.loading, user = _a.user, onRefreshMenu = _a.onRefreshMenu, setIsSaving = _a.setIsSaving, setIsSaveSuccess = _a.setIsSaveSuccess;
    var userOwnedShops = (0, react_1.useMemo)(function () { return shops.filter(function (s) { return s.owner_id === (user === null || user === void 0 ? void 0 : user.id); }); }, [shops, user === null || user === void 0 ? void 0 : user.id]);
    var _b = (0, react_1.useState)(function () {
        var _a;
        var owned = shops.filter(function (s) { return s.owner_id === (user === null || user === void 0 ? void 0 : user.id); });
        return ((_a = owned[0]) === null || _a === void 0 ? void 0 : _a.id) || null;
    }), selectedShopId = _b[0], setSelectedShopId = _b[1];
    // Update selectedShopId if userOwnedShops changes and current selectedShopId is not in the list
    (0, react_1.useEffect)(function () {
        if (userOwnedShops.length > 0 &&
            (!selectedShopId || !userOwnedShops.find(function (s) { return s.id === selectedShopId; }))) {
            setSelectedShopId(userOwnedShops[0].id);
        }
    }, [userOwnedShops, selectedShopId]);
    var _c = (0, react_1.useState)([]), items = _c[0], setItems = _c[1];
    var _d = (0, react_1.useState)({
        name: "",
        price: "",
        category: "Main Course",
        description: "",
        stock_quantity: "10",
        is_unlimited: false,
    }), formData = _d[0], setFormData = _d[1];
    var _e = (0, react_1.useState)(null), imageFile = _e[0], setImageFile = _e[1];
    var _f = (0, react_1.useState)(null), imagePreview = _f[0], setImagePreview = _f[1];
    var _g = (0, react_1.useState)(false), uploading = _g[0], setUploading = _g[1];
    var _h = (0, react_1.useState)(null), editingItem = _h[0], setEditingItem = _h[1];
    var _j = (0, react_1.useState)(""), searchTerm = _j[0], setSearchTerm = _j[1];
    var _k = (0, react_1.useState)("All"), filterCategory = _k[0], setFilterCategory = _k[1];
    var _l = (0, react_1.useState)({
        min: "",
        max: "",
    }), priceRange = _l[0], setPriceRange = _l[1];
    var _m = (0, react_1.useState)("All"), stockFilter = _m[0], setStockFilter = _m[1];
    var _o = (0, react_1.useState)([]), selectedItems = _o[0], setSelectedItems = _o[1];
    var _p = (0, react_1.useState)(false), isGeneratingImage = _p[0], setIsGeneratingImage = _p[1];
    var _q = (0, react_1.useState)(false), showCategoryDropdown = _q[0], setShowCategoryDropdown = _q[1];
    var filteredItems = (0, react_1.useMemo)(function () { return items.filter(function (item) {
        var _a;
        var matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ((_a = item.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchTerm.toLowerCase()));
        var matchesCategory = filterCategory === "All" || item.category === filterCategory;
        var price = item.price;
        var minPrice = priceRange.min ? parseFloat(priceRange.min) : 0;
        var maxPrice = priceRange.max ? parseFloat(priceRange.max) : Infinity;
        var matchesPrice = price >= minPrice && price <= maxPrice;
        var stock = item.stock_quantity;
        var isUnlimited = stock === null || stock === undefined || stock === -1;
        var matchesStock = stockFilter === "All" ||
            (stockFilter === "Low Stock" && !isUnlimited && (stock || 0) < 5) ||
            (stockFilter === "In Stock" && (isUnlimited || (stock || 0) >= 5));
        return matchesSearch && matchesCategory && matchesPrice && matchesStock;
    }); }, [items, searchTerm, filterCategory, priceRange, stockFilter]);
    var categories = [
        "All",
        "Main Course",
        "Appetizers",
        "Desserts",
        "Beverages",
    ];
    var fetchMenu = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!selectedShopId)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, supabase
                            .from("menu_items")
                            .select("*")
                            .eq("shop_id", selectedShopId)];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (data) {
                        setItems(data);
                    }
                    else if (error) {
                        console.error("Fetch Menu Error:", error);
                    }
                    return [3 /*break*/, 4];
                case 3: return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [selectedShopId]);
    (0, react_1.useEffect)(function () {
        if (selectedShopId) {
            // Call it in a way that avoids the sync setState warning if possible
            // or just accept that it's an async function.
            // The linter is being strict about the call itself.
            var loadMenu = function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, fetchMenu()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); };
            loadMenu();
            // Real-time subscription for menu items of this shop
            var menuChannel_1 = supabase
                .channel("menu_items_".concat(selectedShopId))
                .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "menu_items",
                filter: "shop_id=eq.".concat(selectedShopId),
            }, function () {
                void fetchMenu();
            })
                .subscribe();
            return function () {
                void supabase.removeChannel(menuChannel_1);
            };
        }
    }, [selectedShopId, fetchMenu]);
    var toggleAvailability = function (item) { return __awaiter(void 0, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Optimistic Update
                    setItems(function (prev) {
                        return prev.map(function (i) {
                            return i.id === item.id ? __assign(__assign({}, i), { is_available: !item.is_available }) : i;
                        });
                    });
                    return [4 /*yield*/, supabase
                            .from("menu_items")
                            .update({ is_available: !item.is_available })
                            .eq("id", item.id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        // Rollback
                        setItems(function (prev) {
                            return prev.map(function (i) {
                                return i.id === item.id ? __assign(__assign({}, i), { is_available: item.is_available }) : i;
                            });
                        });
                        sonner_1.toast.error("We couldn't update the item's availability. Please try again.");
                    }
                    else {
                        sonner_1.toast.success("".concat(item.name, " is now ").concat(!item.is_available ? "available" : "unavailable"));
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleFileChange = function (e) {
        var _a;
        var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            setImageFile(file);
            var reader_1 = new FileReader();
            reader_1.onloadend = function () {
                setImagePreview(reader_1.result);
            };
            reader_1.readAsDataURL(file);
        }
    };
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var imageUrl, options, compressedFile, fileExt, fileName, filePath, uploadError, publicUrl, error, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!user) {
                        sonner_1.toast.error("Please sign in to continue.");
                        setUploading(false);
                        return [2 /*return*/];
                    }
                    e.preventDefault();
                    if (!selectedShopId)
                        return [2 /*return*/];
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    setUploading(true);
                    imageUrl = imagePreview;
                    if (!imageFile) return [3 /*break*/, 3];
                    options = {
                        maxSizeMB: 0.2,
                        maxWidthOrHeight: 1024,
                        useWebWorker: true,
                    };
                    return [4 /*yield*/, (0, browser_image_compression_1.default)(imageFile, options)];
                case 1:
                    compressedFile = _a.sent();
                    fileExt = compressedFile.name.split(".").pop() || "jpg";
                    fileName = "".concat(Math.random(), ".").concat(fileExt);
                    filePath = "".concat(user.id, "/").concat(fileName);
                    return [4 /*yield*/, supabase.storage
                            .from("menu-images")
                            .upload(filePath, compressedFile)];
                case 2:
                    uploadError = (_a.sent()).error;
                    if (uploadError) {
                        console.error("Upload Error:", uploadError);
                        sonner_1.toast.error('Failed to upload image. Please ensure "menu-images" bucket exists in Supabase and is set to Public.');
                        setUploading(false);
                        return [2 /*return*/];
                    }
                    publicUrl = supabase.storage.from("menu-images").getPublicUrl(filePath).data.publicUrl;
                    imageUrl = publicUrl;
                    _a.label = 3;
                case 3:
                    if (!editingItem) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase
                            .from("menu_items")
                            .update({
                            name: formData.name,
                            price: parseFloat(formData.price),
                            category: formData.category,
                            description: formData.description,
                            stock_quantity: formData.is_unlimited ? null : parseInt(formData.stock_quantity),
                            image_url: imageUrl,
                        })
                            .eq("id", editingItem.id)];
                case 4:
                    error = (_a.sent()).error;
                    setUploading(false);
                    if (!error) {
                        setIsSaving(false);
                        setIsSaveSuccess(true);
                        setTimeout(function () {
                            setIsSaveSuccess(false);
                            sonner_1.toast.success("Menu item updated successfully");
                            setEditingItem(null);
                            setFormData({
                                name: "",
                                price: "",
                                category: "Main Course",
                                description: "",
                                stock_quantity: "10",
                                is_unlimited: false,
                            });
                            setImageFile(null);
                            setImagePreview(null);
                            fetchMenu();
                            onRefreshMenu === null || onRefreshMenu === void 0 ? void 0 : onRefreshMenu();
                        }, 1500);
                    }
                    else {
                        setIsSaving(false);
                        setIsSaveSuccess(false);
                        console.error("Supabase Update Error:", error);
                        sonner_1.toast.error("We couldn't update the menu item. Please try again.");
                    }
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, supabase.from("menu_items").insert([
                        {
                            name: formData.name,
                            price: parseFloat(formData.price),
                            category: formData.category,
                            description: formData.description,
                            stock_quantity: formData.is_unlimited ? null : parseInt(formData.stock_quantity),
                            shop_id: selectedShopId,
                            is_available: true,
                            image_url: imageUrl,
                        },
                    ])];
                case 6:
                    error = (_a.sent()).error;
                    setUploading(false);
                    if (!error) {
                        setIsSaving(false);
                        setIsSaveSuccess(true);
                        setTimeout(function () {
                            setIsSaveSuccess(false);
                            sonner_1.toast.success("Menu item added successfully");
                            setFormData({
                                name: "",
                                price: "",
                                category: "Main Course",
                                description: "",
                                stock_quantity: "10",
                                is_unlimited: false,
                            });
                            setImageFile(null);
                            setImagePreview(null);
                            fetchMenu();
                            onRefreshMenu === null || onRefreshMenu === void 0 ? void 0 : onRefreshMenu();
                        }, 1500);
                    }
                    else {
                        setIsSaving(false);
                        setIsSaveSuccess(false);
                        console.error("Supabase Insert Error:", error);
                        sonner_1.toast.error("We couldn't add the menu item. Please try again.");
                    }
                    _a.label = 7;
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleEdit = function (item) {
        setEditingItem(item);
        setFormData({
            name: item.name,
            price: item.price.toString(),
            category: item.category || "Main Course",
            description: item.description || "",
            stock_quantity: (item.stock_quantity || 10).toString(),
            is_unlimited: item.stock_quantity === null || item.stock_quantity === undefined || item.stock_quantity === -1,
        });
        setImagePreview(item.image_url);
        // Scroll to form
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    var cancelEdit = function () {
        setEditingItem(null);
        setFormData({
            name: "",
            price: "",
            category: "Main Course",
            description: "",
            stock_quantity: "10",
            is_unlimited: false,
        });
        setImageFile(null);
        setImagePreview(null);
    };
    var generateAIImage = function () { return __awaiter(void 0, void 0, void 0, function () {
        var ai, prompt_1, response, base64Data, _i, _a, part, imageUrl, res, blob, file, error_7;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!formData.name) {
                        sonner_1.toast.error("Please give your item a name before saving.");
                        return [2 /*return*/];
                    }
                    setIsGeneratingImage(true);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 7, 8, 9]);
                    if (!import.meta.env.VITE_GEMINI_API_KEY) {
                        throw new Error("Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your environment variables.");
                    }
                    ai = new genai_1.GoogleGenAI({
                        apiKey: import.meta.env.VITE_GEMINI_API_KEY,
                    });
                    prompt_1 = "A professional food photography shot of ".concat(formData.name, ". ").concat(formData.description ? "Description: ".concat(formData.description, ".") : "", " High quality, appetizing, studio lighting, neutral background.");
                    return [4 /*yield*/, ai.models.generateContent({
                            model: "gemini-2.5-flash-image",
                            contents: {
                                parts: [{ text: prompt_1 }],
                            },
                            config: {
                                imageConfig: {
                                    aspectRatio: "4:3",
                                },
                            },
                        })];
                case 2:
                    response = _e.sent();
                    if (!((_d = (_c = (_b = response.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts)) {
                        throw new Error("The AI model did not return any image parts. Try a different name.");
                    }
                    base64Data = "";
                    for (_i = 0, _a = response.candidates[0].content.parts; _i < _a.length; _i++) {
                        part = _a[_i];
                        if (part.inlineData) {
                            base64Data = part.inlineData.data;
                            break;
                        }
                    }
                    if (!base64Data) return [3 /*break*/, 5];
                    imageUrl = "data:image/png;base64,".concat(base64Data);
                    setImagePreview(imageUrl);
                    return [4 /*yield*/, fetch(imageUrl)];
                case 3:
                    res = _e.sent();
                    return [4 /*yield*/, res.blob()];
                case 4:
                    blob = _e.sent();
                    file = new File([blob], "".concat(formData.name.replace(/\s+/g, "_"), "_ai.png"), { type: "image/png" });
                    setImageFile(file);
                    sonner_1.toast.success("AI Image generated successfully!");
                    return [3 /*break*/, 6];
                case 5: throw new Error("No image data received from AI");
                case 6: return [3 /*break*/, 9];
                case 7:
                    error_7 = _e.sent();
                    console.error("AI Image Generation Error:", error_7);
                    sonner_1.toast.error("AI Generation failed: ".concat(error_7 instanceof Error ? error_7.message : "Please try again."));
                    return [3 /*break*/, 9];
                case 8:
                    setIsGeneratingImage(false);
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var handleBulkAction = function (action, value) { return __awaiter(void 0, void 0, void 0, function () {
        var confirmMessage, previousItems, error, error, error, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (selectedItems.length === 0)
                        return [2 /*return*/];
                    confirmMessage = action === "delete"
                        ? "Are you sure you want to delete ".concat(selectedItems.length, " items?")
                        : action === "category"
                            ? "Change category to \"".concat(value, "\" for ").concat(selectedItems.length, " items?")
                            : "Mark ".concat(selectedItems.length, " items as ").concat(action, "?");
                    if (!window.confirm(confirmMessage))
                        return [2 /*return*/];
                    previousItems = __spreadArray([], items, true);
                    // Optimistic Update
                    if (action === "delete") {
                        setItems(function (prev) { return prev.filter(function (item) { return !selectedItems.includes(item.id); }); });
                    }
                    else if (action === "category" && value) {
                        setItems(function (prev) {
                            return prev.map(function (item) {
                                return selectedItems.includes(item.id) ? __assign(__assign({}, item), { category: value }) : item;
                            });
                        });
                    }
                    else {
                        setItems(function (prev) {
                            return prev.map(function (item) {
                                return selectedItems.includes(item.id)
                                    ? __assign(__assign({}, item), { is_available: action === "available" }) : item;
                            });
                        });
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    if (!(action === "delete")) return [3 /*break*/, 3];
                    return [4 /*yield*/, supabase
                            .from("menu_items")
                            .delete()
                            .in("id", selectedItems)];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw error;
                    sonner_1.toast.success("Deleted ".concat(selectedItems.length, " items"));
                    return [3 /*break*/, 7];
                case 3:
                    if (!(action === "category")) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase
                            .from("menu_items")
                            .update({ category: value })
                            .in("id", selectedItems)];
                case 4:
                    error = (_a.sent()).error;
                    if (error)
                        throw error;
                    sonner_1.toast.success("Updated category for ".concat(selectedItems.length, " items"));
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, supabase
                        .from("menu_items")
                        .update({ is_available: action === "available" })
                        .in("id", selectedItems)];
                case 6:
                    error = (_a.sent()).error;
                    if (error)
                        throw error;
                    sonner_1.toast.success("Updated ".concat(selectedItems.length, " items"));
                    _a.label = 7;
                case 7:
                    setSelectedItems([]);
                    fetchMenu();
                    return [3 /*break*/, 9];
                case 8:
                    error_8 = _a.sent();
                    // Rollback
                    setItems(previousItems);
                    sonner_1.toast.error("Bulk action failed: ".concat(error_8 instanceof Error ? error_8.message : "Unknown error"));
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var toggleSelectAll = function () {
        if (selectedItems.length === filteredItems.length) {
            setSelectedItems([]);
        }
        else {
            setSelectedItems(filteredItems.map(function (i) { return i.id; }));
        }
    };
    var toggleSelectItem = function (id) {
        setSelectedItems(function (prev) {
            return prev.includes(id) ? prev.filter(function (i) { return i !== id; }) : __spreadArray(__spreadArray([], prev, true), [id], false);
        });
    };
    var handleDelete = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase.from("menu_items").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (!error) {
                        sonner_1.toast.success("Item deleted");
                        fetchMenu();
                        onRefreshMenu === null || onRefreshMenu === void 0 ? void 0 : onRefreshMenu();
                    }
                    else {
                        sonner_1.toast.error("We couldn't delete the item. Please try again.");
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var selectedShop = shops.find(function (s) { return s.id === selectedShopId; });
    if (loading) {
        return (<div className="space-y-12">
        <Skeleton className="h-40 rounded-3xl"/>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="lg:col-span-5 h-[500px] rounded-[2rem]"/>
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(function (i) { return (<Skeleton key={i} className="h-80 rounded-[2rem]"/>); })}
          </div>
        </div>
      </div>);
    }
    return (<div className="space-y-12">
      <react_2.motion.section initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-low p-8 rounded-3xl border border-outline-variant/5">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white shadow-sm border border-outline-variant/10 flex items-center justify-center">
            {!isPlaceholderImage(selectedShop === null || selectedShop === void 0 ? void 0 : selectedShop.logo_url) ? (<img src={selectedShop.logo_url} alt={selectedShop === null || selectedShop === void 0 ? void 0 : selectedShop.name} className="w-full h-full object-cover"/>) : (<img src={DEFAULT_SHOP_LOGO} className="w-full h-full object-cover opacity-90" alt="Default Shop Logo"/>)}
          </div>
          <div>
            <h2 className="text-2xl font-headline font-bold text-on-surface">
              {(selectedShop === null || selectedShop === void 0 ? void 0 : selectedShop.name) || "Your Shop"}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-on-surface-variant text-sm font-medium">
              <span className="flex items-center gap-1">
                <lucide_react_1.MapPin size={14}/> {selectedShop === null || selectedShop === void 0 ? void 0 : selectedShop.location}
              </span>
              <span className="flex items-center gap-1">
                <lucide_react_1.Store size={14}/> {selectedShop === null || selectedShop === void 0 ? void 0 : selectedShop.category}
              </span>
            </div>
          </div>
        </div>
      </react_2.motion.section>

      {userOwnedShops.length === 0 ? (<CreateShop user={user} onShopCreated={onRefreshMenu || (function () { })} setIsSaving={setIsSaving} setIsSaveSuccess={setIsSaveSuccess}/>) : (<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <react_2.motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-5 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-headline text-on-surface">
                  {editingItem ? "Edit Your" : "Curate Your"}{" "}
                  <span className="text-primary italic">Offerings</span>
                </h2>
                <p className="text-sm text-on-surface-variant font-medium max-w-md">
                  {editingItem
                ? "Update the details of your menu item below."
                : "Transform ingredients into inspiration. Define your signature dishes for the LocalEats community."}
                </p>
              </div>
              {!editingItem && (<button type="button" onClick={function () {
                    return sonner_1.toast.info("Bulk Import feature coming soon!", {
                        description: "You will be able to upload a CSV or use AI to scan your physical menu.",
                    });
                }} className="px-4 py-2 bg-surface-container-high text-primary font-bold text-xs rounded-xl hover:bg-primary/10 transition-colors flex items-center gap-2 shadow-sm">
                  <lucide_react_1.Upload size={16}/>
                  Bulk Import
                </button>)}
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-[0_8px_24px_-4px_rgba(167,52,0,0.06)] border border-outline-variant/10">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">
                    Item Name
                  </label>
                  <input className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40" placeholder="e.g. Truffle Infused Tagliatelle" type="text" value={formData.name} onChange={function (e) {
                return setFormData(__assign(__assign({}, formData), { name: e.target.value }));
            }} required/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-1.5">
                    <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">
                      Price (R)
                    </label>
                    <input className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all" placeholder="0.00" type="number" value={formData.price} onChange={function (e) {
                return setFormData(__assign(__assign({}, formData), { price: e.target.value }));
            }} required/>
                  </div>
                  <div className="col-span-1 space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                        Stock
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded border-outline-variant text-primary focus:ring-primary/40 transition-all cursor-pointer" checked={formData.is_unlimited} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { is_unlimited: e.target.checked })); }}/>
                        <span className="text-[10px] font-bold text-on-surface-variant/60 group-hover:text-primary transition-colors uppercase tracking-tight">Unlimited</span>
                      </label>
                    </div>
                    <input className={cn("w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all", formData.is_unlimited && "opacity-50 grayscale pointer-events-none")} placeholder={formData.is_unlimited ? "∞" : "Qty"} type="number" value={formData.is_unlimited ? "" : formData.stock_quantity} onChange={function (e) {
                return setFormData(__assign(__assign({}, formData), { stock_quantity: e.target.value }));
            }} required={!formData.is_unlimited}/>
                  </div>
                  <div className="col-span-1 space-y-1.5">
                    <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">
                      Category
                    </label>
                    <select className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all appearance-none" value={formData.category} onChange={function (e) {
                return setFormData(__assign(__assign({}, formData), { category: e.target.value }));
            }}>
                      <option>Main Course</option>
                      <option>Appetizers</option>
                      <option>Desserts</option>
                      <option>Beverages</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">
                    Description
                  </label>
                  <textarea className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40" placeholder="Tell the story of this dish..." rows={3} value={formData.description} onChange={function (e) {
                return setFormData(__assign(__assign({}, formData), { description: e.target.value }));
            }}></textarea>
                </div>
                <div className="space-y-1.5">
                  <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">
                    Item Image
                  </label>
                  <div className="flex flex-col gap-4">
                    <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-outline-variant/10 shadow-inner">
                      {!isPlaceholderImage(imagePreview) ? (<img src={imagePreview} alt="Preview" className="w-full h-full object-cover animate-in fade-in duration-500"/>) : (<FoodPlaceholder size={48}/>)}
                      {imagePreview && (<button type="button" onClick={function () {
                    setImageFile(null);
                    setImagePreview(null);
                }} className="absolute top-3 right-3 p-2 bg-error/90 text-on-error rounded-full shadow-lg hover:bg-error transition-all hover:scale-110 active:scale-95">
                          <lucide_react_1.Trash2 size={16}/>
                        </button>)}
                    </div>
                    <div className="flex gap-2">
                      <label className={cn("flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all", imageFile
                ? "border-primary/40 bg-primary/5"
                : "border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5")}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <lucide_react_1.Upload className="w-8 h-8 mb-2 text-on-surface-variant/40"/>
                          <p className="text-xs text-on-surface-variant/60 font-medium">
                            {imageFile
                ? imageFile.name
                : "Click to upload image"}
                          </p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange}/>
                      </label>
                      <button type="button" onClick={generateAIImage} disabled={isGeneratingImage || !formData.name} className="w-32 h-32 flex flex-col items-center justify-center bg-surface-container-high rounded-xl border-2 border-outline-variant/10 hover:bg-surface-container-highest transition-all disabled:opacity-50 group">
                        {isGeneratingImage ? (<lucide_react_1.RefreshCw className="w-8 h-8 mb-2 text-primary animate-spin"/>) : (<lucide_react_1.Sparkles className="w-8 h-8 mb-2 text-primary group-hover:scale-110 transition-transform"/>)}
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter">
                          AI Generate
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button className={cn("flex-1 py-4 rounded-full font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100", editingItem
                ? "bg-primary text-on-primary"
                : "bg-gradient-to-br from-primary to-primary-container text-on-primary")} type="submit" disabled={uploading}>
                    {uploading ? (<lucide_react_1.Clock className="animate-spin" size={20}/>) : editingItem ? (<lucide_react_1.Edit2 size={20}/>) : (<lucide_react_1.Plus size={20}/>)}
                    {uploading
                ? "Processing..."
                : editingItem
                    ? "Update Item"
                    : "Add New Item"}
                  </button>
                  {editingItem && (<button type="button" onClick={cancelEdit} className="px-6 py-4 rounded-full bg-surface-container-high text-on-surface font-bold hover:bg-surface-container-highest transition-all">
                      Cancel
                    </button>)}
                </div>
              </form>
            </div>
          </react_2.motion.section>

          <section className="lg:col-span-7 space-y-6">
            <div className="flex flex-col gap-4">
              <div className="bg-surface-container-low p-4 md:p-6 rounded-2xl md:rounded-3xl border border-outline-variant/10 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">
                      Search Items
                    </label>
                    <div className="relative">
                      <lucide_react_1.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18}/>
                      <input type="text" placeholder="Search name or description..." value={searchTerm} onChange={function (e) { return setSearchTerm(e.target.value); }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-xl md:rounded-2xl py-2.5 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"/>
                    </div>
                  </div>

                  <div className="w-full md:w-48 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">
                      Category
                    </label>
                    <select value={filterCategory} onChange={function (e) { return setFilterCategory(e.target.value); }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-xl md:rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all appearance-none">
                      {categories.map(function (c) { return (<option key={c} value={c}>
                          {c}
                        </option>); })}
                    </select>
                  </div>

                  <div className="w-full md:w-64 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">
                      Price Range (R)
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="number" placeholder="Min" value={priceRange.min} onChange={function (e) {
                return setPriceRange(function (prev) { return (__assign(__assign({}, prev), { min: e.target.value })); });
            }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-xl md:rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all"/>
                      <span className="text-on-surface-variant/40">-</span>
                      <input type="number" placeholder="Max" value={priceRange.max} onChange={function (e) {
                return setPriceRange(function (prev) { return (__assign(__assign({}, prev), { max: e.target.value })); });
            }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-xl md:rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all"/>
                    </div>
                  </div>

                  <div className="w-full md:w-48 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">
                      Stock Status
                    </label>
                    <select value={stockFilter} onChange={function (e) {
                return setStockFilter(e.target.value);
            }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-xl md:rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all appearance-none">
                      <option value="All">All Items</option>
                      <option value="Low Stock">Low Stock (&lt; 5)</option>
                      <option value="In Stock">In Stock (5+)</option>
                    </select>
                  </div>
                </div>
              </div>

              {selectedItems.length > 0 && (<react_2.motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary-container p-4 rounded-2xl flex items-center justify-between border border-primary/20 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-on-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      {selectedItems.length}
                    </div>
                    <span className="text-on-primary-container font-bold text-sm">
                      Items Selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={function () { return handleBulkAction("available"); }} className="px-4 py-2 bg-white dark:bg-surface-container-high text-primary font-bold text-xs rounded-full hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1.5">
                      <lucide_react_1.Check size={14}/> Mark as Available
                    </button>
                    <button onClick={function () { return handleBulkAction("unavailable"); }} className="px-4 py-2 bg-white dark:bg-surface-container-high text-on-surface-variant font-bold text-xs rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5">
                      <lucide_react_1.X size={14}/> Mark as Unavailable
                    </button>
                    <div className="relative">
                      <button onClick={function () {
                    return setShowCategoryDropdown(!showCategoryDropdown);
                }} className="px-4 py-2 bg-white dark:bg-surface-container-high text-on-surface-variant font-bold text-xs rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5">
                        <lucide_react_1.Layers size={14}/> Change Category
                      </button>
                      <react_2.AnimatePresence>
                        {showCategoryDropdown && (<react_2.motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full left-0 mb-2 bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-xl p-2 min-w-[150px] z-50">
                            {categories
                        .filter(function (c) { return c !== "All"; })
                        .map(function (cat) { return (<button key={cat} onClick={function () {
                            handleBulkAction("category", cat);
                            setShowCategoryDropdown(false);
                        }} className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-primary/10 rounded-lg transition-colors">
                                  {cat}
                                </button>); })}
                          </react_2.motion.div>)}
                      </react_2.AnimatePresence>
                    </div>
                    <button onClick={function () { return handleBulkAction("delete"); }} className="px-4 py-2 bg-error/10 text-error font-bold text-xs rounded-full hover:bg-error hover:text-on-error transition-all flex items-center gap-1.5">
                      <lucide_react_1.Trash2 size={14}/> Delete
                    </button>
                  </div>
                </react_2.motion.div>)}

              <div className="flex items-center justify-between px-2">
                <button onClick={toggleSelectAll} className="text-xs font-bold text-primary flex items-center gap-2 hover:underline">
                  {selectedItems.length === filteredItems.length &&
                filteredItems.length > 0 ? (<>
                      <lucide_react_1.CheckSquare size={16}/> Deselect All
                    </>) : (<>
                      <lucide_react_1.Square size={16}/> Select All Visible
                    </>)}
                </button>
                <div className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                  Showing {filteredItems.length} of {items.length} items
                </div>
              </div>

              {filterCategory !== "All" && (<div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">
                    Active Filter:
                  </span>
                  <button onClick={function () { return setFilterCategory("All"); }} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold flex items-center gap-1">
                    {filterCategory} <lucide_react_1.Plus size={12} className="rotate-45"/>
                  </button>
                </div>)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {filteredItems.length === 0 ? (<div className="col-span-full py-20 md:py-32 flex flex-col items-center justify-center bg-surface-container-low rounded-2xl md:rounded-[2rem] border-2 border-dashed border-outline-variant/20 px-6">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <lucide_react_1.UtensilsCrossed size={36} className="text-primary/30"/>
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mb-2">No menu items found</h3>
                  <p className="text-sm text-on-surface-variant max-w-xs mx-auto mb-8">
                    {searchTerm || filterCategory !== "All"
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "Your menu is currently empty. Start adding items to showcase your delicious food!"}
                  </p>
                  {(searchTerm || filterCategory !== "All") ? (<button onClick={function () {
                        setSearchTerm("");
                        setFilterCategory("All");
                    }} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                      Clear all filters
                    </button>) : (<button onClick={handleAdd} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                      Add Your First Item
                    </button>)}
                </div>) : (filteredItems.map(function (item, i) { return (<react_2.motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} key={item.id} className={cn("group relative bg-surface-container-lowest rounded-2xl md:rounded-[2rem] overflow-hidden shadow-sm hover:shadow-[0_8px_32px_-8px_rgba(167,52,0,0.15)] transition-all duration-300 border border-outline-variant/10", selectedItems.includes(item.id) &&
                    "ring-2 ring-primary ring-offset-2")}>
                    <button onClick={function () { return toggleSelectItem(item.id); }} className={cn("absolute top-3 left-3 z-20 p-2 rounded-xl transition-all shadow-lg", selectedItems.includes(item.id)
                    ? "bg-primary text-on-primary scale-110"
                    : "bg-surface-container-highest/60 text-on-surface-variant backdrop-blur-md border border-outline-variant/10")}>
                      {selectedItems.includes(item.id) ? (<lucide_react_1.CheckSquare size={18}/>) : (<lucide_react_1.Square size={18}/>)}
                    </button>
                    <div className="relative h-40 md:h-48 bg-surface-container flex items-center justify-center overflow-hidden">
                      {!isPlaceholderImage(item.image_url) ? (<img className={cn("w-full h-full object-cover", !item.is_available && "grayscale opacity-50")} src={item.image_url} alt={item.name}/>) : (<FoodPlaceholder size={48}/>)}
                      {(!item.is_available || (item.stock_quantity !== null && item.stock_quantity === 0)) && (<div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="bg-error text-white px-3 md:px-4 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg">
                            {!item.is_available ? "Unavailable" : "Out of Stock"}
                          </span>
                        </div>)}
                      <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-surface/90 backdrop-blur-md px-2.5 py-1 rounded-full text-primary font-bold text-xs md:text-sm shadow-sm">
                        R {Number(item.price || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-4 md:p-6 space-y-2 md:space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-headline font-semibold text-base md:text-lg leading-tight line-clamp-1">
                          {item.name}
                        </h4>
                        <div className="flex gap-1 items-center shrink-0">
                          <button onClick={function () { return toggleAvailability(item); }} className={cn("flex items-center gap-1 px-1.5 py-0.5 md:py-1 rounded-full transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-tighter", item.is_available
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-on-surface-variant/10 text-on-surface-variant hover:bg-on-surface-variant/20")} title={item.is_available
                    ? "Mark as Unavailable"
                    : "Mark as Available"}>
                            {item.is_available ? (<lucide_react_1.ToggleRight size={16}/>) : (<lucide_react_1.ToggleLeft size={16}/>)}
                            <span className="hidden xs:inline">
                              {item.is_available ? "Available" : "Unavailable"}
                            </span>
                          </button>
                          <button onClick={function () { return handleEdit(item); }} className="p-1.5 md:p-2 text-on-surface-variant/40 hover:text-primary transition-colors">
                            <lucide_react_1.Edit2 size={16} className="md:w-[18px] md:h-[18px]"/>
                          </button>
                          <button onClick={function () {
                    if (window.confirm("Are you sure you want to delete this item?")) {
                        handleDelete(item.id);
                    }
                }} className="p-1.5 md:p-2 text-on-surface-variant/40 hover:text-error transition-colors">
                            <lucide_react_1.Trash2 size={16} className="md:w-[18px] md:h-[18px]"/>
                          </button>
                        </div>
                      </div>
                      <p className="text-on-surface-variant text-[10px] md:text-xs line-clamp-2 min-h-[2.5em]">
                        {item.description || "No description provided."}
                      </p>
                      <div className="flex gap-2 pt-2 items-center justify-between border-t border-outline-variant/5">
                        <span className="px-2 py-0.5 bg-surface-container-high rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {item.category || "General"}
                        </span>
                        <span className={cn("text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md flex items-center gap-1", item.stock_quantity !== null && (item.stock_quantity || 0) < 5
                    ? "bg-error text-on-error animate-pulse shadow-[0_0_12px_rgba(255,0,0,0.3)]"
                    : "bg-emerald-100 text-emerald-600")}>
                          {item.stock_quantity !== null && (item.stock_quantity || 0) < 5 && (<lucide_react_1.AlertCircle size={10}/>)}
                          Stock: {item.stock_quantity === null ? "Unlimited" : (item.stock_quantity || 0)}
                          {item.stock_quantity !== null && (item.stock_quantity || 0) < 5 && (<span className="ml-1 text-[8px] font-black underline hidden xs:inline">
                              LOW STOCK
                            </span>)}
                        </span>
                      </div>
                    </div>
                  </react_2.motion.div>); }))}
            </div>
          </section>
        </div>)}
    </div>);
};
var ShopProfile = function (_a) {
    var shop = _a.shop, onRefresh = _a.onRefresh, user = _a.user, setIsSaving = _a.setIsSaving, setIsSaveSuccess = _a.setIsSaveSuccess, onFinished = _a.onFinished;
    var _b = (0, react_1.useState)(null), uploadingType = _b[0], setUploadingType = _b[1];
    var _c = (0, react_1.useState)(false), showMapPinConfirm = _c[0], setShowMapPinConfirm = _c[1];
    var _d = (0, react_1.useState)(false), isLocating = _d[0], setIsLocating = _d[1];
    var _e = (0, react_1.useState)({
        name: shop.name || "",
        description: shop.description || "",
        location: shop.location || "",
        category: shop.category || "Restaurant",
        phone: shop.phone || "",
        email: shop.email || "",
        instagram: shop.instagram || "",
        facebook: shop.facebook || "",
        whatsapp: shop.whatsapp || "",
        logo_url: shop.logo_url || "",
        lat: shop.lat || -25.9964,
        lng: shop.lng || 28.2268,
    }), formData = _e[0], setFormData = _e[1];
    var handleUpdateLocation = function () {
        setIsLocating(true);
        if (!navigator.geolocation) {
            sonner_1.toast.error("Geolocation is not supported by your browser");
            setIsLocating(false);
            setShowMapPinConfirm(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(function (position) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, latitude_2, longitude_2, data, retryCount_2, maxRetries, response, err_9, city, state, road, houseNumber, newLocation_3, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 9, 10, 11]);
                        _a = position.coords, latitude_2 = _a.latitude, longitude_2 = _a.longitude;
                        data = null;
                        retryCount_2 = 0;
                        maxRetries = 2;
                        _c.label = 1;
                    case 1:
                        if (!(retryCount_2 <= maxRetries)) return [3 /*break*/, 8];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 5, , 7]);
                        return [4 /*yield*/, fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=".concat(latitude_2, "&lon=").concat(longitude_2, "&email=aviwenotununu4@gmail.com"))];
                    case 3:
                        response = _c.sent();
                        return [4 /*yield*/, response.json()];
                    case 4:
                        data = _c.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        err_9 = _c.sent();
                        retryCount_2++;
                        if (retryCount_2 > maxRetries)
                            throw err_9;
                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000 * retryCount_2); })];
                    case 6:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 7: return [3 /*break*/, 1];
                    case 8:
                        if (data && data.address) {
                            city = data.address.city ||
                                data.address.town ||
                                data.address.village ||
                                data.address.suburb ||
                                "";
                            state = data.address.state || "";
                            road = data.address.road || "";
                            houseNumber = data.address.house_number || "";
                            newLocation_3 = [houseNumber, road, city, state]
                                .filter(Boolean)
                                .join(", ");
                            setFormData(function (prev) { return (__assign(__assign({}, prev), { location: newLocation_3 || prev.location, lat: latitude_2, lng: longitude_2 })); });
                            sonner_1.toast.success("Location updated successfully!");
                        }
                        else {
                            sonner_1.toast.error("Could not determine address from coordinates.");
                        }
                        return [3 /*break*/, 11];
                    case 9:
                        _b = _c.sent();
                        sonner_1.toast.error("Failed to get address details.");
                        return [3 /*break*/, 11];
                    case 10:
                        setIsLocating(false);
                        setShowMapPinConfirm(false);
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        }); }, function (error) {
            console.error("Geolocation error:", error);
            sonner_1.toast.error("Location access failed: ".concat(error.message || "Please check permissions"));
            setIsLocating(false);
            setShowMapPinConfirm(false);
        }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 });
    };
    var handleUpdate = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var phoneCleaned, whatsappCleaned, saRegex, payload, error, potentiallyMissing, _i, potentiallyMissing_1, col, retry, err_10;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    e.preventDefault();
                    phoneCleaned = formData.phone.replace(/[\s-]/g, "");
                    whatsappCleaned = (formData.whatsapp || "").replace(/[\s-]/g, "");
                    saRegex = /^(?:\+27|0)[0-9]{9}$/;
                    if (!saRegex.test(phoneCleaned)) {
                        sonner_1.toast.error("Please enter a valid phone number (like 082 123 4567)");
                        return [2 /*return*/];
                    }
                    if (formData.whatsapp && !saRegex.test(whatsappCleaned)) {
                        sonner_1.toast.error("Please enter a valid WhatsApp number (like 082 123 4567)");
                        return [2 /*return*/];
                    }
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    payload = __assign({}, formData);
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 8, , 9]);
                    return [4 /*yield*/, supabase
                            .from("shops")
                            .update(payload)
                            .eq("id", shop.id)];
                case 2:
                    error = (_f.sent()).error;
                    if (!(error && (error.code === "42703" || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("column")) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("schema cache"))))) return [3 /*break*/, 4];
                    console.warn("Some columns do not exist in the shops table. Attempting to strip unknown columns...", error.message);
                    potentiallyMissing = ["whatsapp", "instagram", "facebook", "lat", "lng", "location_details", "email"];
                    for (_i = 0, potentiallyMissing_1 = potentiallyMissing; _i < potentiallyMissing_1.length; _i++) {
                        col = potentiallyMissing_1[_i];
                        if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("'".concat(col, "'"))) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("\"".concat(col, "\""))) || ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("column \"".concat(col, "\"")))) {
                            delete payload[col];
                        }
                    }
                    // Let's just strip all the new fields if there is ANY column error, to be safe and ensure the basic update goes through
                    delete payload.whatsapp;
                    delete payload.instagram;
                    delete payload.facebook;
                    delete payload.lat;
                    delete payload.lng;
                    return [4 /*yield*/, supabase
                            .from("shops")
                            .update(payload)
                            .eq("id", shop.id)];
                case 3:
                    retry = _f.sent();
                    error = retry.error;
                    _f.label = 4;
                case 4:
                    if (error)
                        throw error;
                    if (!(user && (formData.phone || formData.whatsapp))) return [3 /*break*/, 7];
                    return [4 /*yield*/, supabase.auth.updateUser({
                            data: {
                                phone: formData.phone,
                                whatsapp: formData.whatsapp,
                                location: formData.location,
                                address: formData.location, // In Shops table we often use 'location' as the full address
                            }
                        })];
                case 5:
                    _f.sent();
                    // Also sync to rider profile if it exists
                    return [4 /*yield*/, supabase
                            .from("rider_profiles")
                            .update({
                            phone: formData.phone,
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", user.id)];
                case 6:
                    // Also sync to rider profile if it exists
                    _f.sent();
                    _f.label = 7;
                case 7:
                    setIsSaving(false);
                    setIsSaveSuccess(true);
                    setTimeout(function () {
                        setIsSaveSuccess(false);
                        sonner_1.toast.success("Shop profile updated successfully!");
                        onRefresh();
                        if (onFinished)
                            onFinished();
                    }, 1500);
                    return [3 /*break*/, 9];
                case 8:
                    err_10 = _f.sent();
                    setIsSaving(false);
                    setIsSaveSuccess(false);
                    console.error("Update error:", err_10);
                    sonner_1.toast.error("Failed to update profile: ".concat((err_10 === null || err_10 === void 0 ? void 0 : err_10.message) || (err_10 === null || err_10 === void 0 ? void 0 : err_10.details) || (err_10 === null || err_10 === void 0 ? void 0 : err_10.hint) || "Unknown error"));
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var handleImageUpload = function (e, type) { return __awaiter(void 0, void 0, void 0, function () {
        var file, options, compressedFile, fileExt, fileName, filePath, uploadError, publicUrl_3, err_11;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!user) {
                        sonner_1.toast.error("Not authenticated");
                        return [2 /*return*/];
                    }
                    file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (!file)
                        return [2 /*return*/];
                    setUploadingType(type);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    options = {
                        maxSizeMB: 0.2,
                        maxWidthOrHeight: 1024,
                        useWebWorker: true,
                    };
                    return [4 /*yield*/, (0, browser_image_compression_1.default)(file, options)];
                case 2:
                    compressedFile = _b.sent();
                    fileExt = compressedFile.name.split(".").pop() || "jpg";
                    fileName = "".concat(shop.id, "-").concat(type, "-").concat(Math.random(), ".").concat(fileExt);
                    filePath = "".concat(user.id, "/").concat(fileName);
                    return [4 /*yield*/, supabase.storage
                            .from("shop-assets")
                            .upload(filePath, compressedFile)];
                case 3:
                    uploadError = (_b.sent()).error;
                    if (uploadError) {
                        if (uploadError.message.includes("bucket not found")) {
                            throw new Error('Storage bucket "shop-assets" not found. Please create it in Supabase Storage and set it to Public.');
                        }
                        throw uploadError;
                    }
                    publicUrl_3 = supabase.storage.from("shop-assets").getPublicUrl(filePath).data.publicUrl;
                    setFormData(function (prev) { return (__assign(__assign({}, prev), { logo_url: publicUrl_3 })); });
                    sonner_1.toast.success("Logo uploaded! Save to apply changes.");
                    return [3 /*break*/, 6];
                case 4:
                    err_11 = _b.sent();
                    sonner_1.toast.error("Upload failed: ".concat(err_11 instanceof Error ? err_11.message : "Unknown error"));
                    return [3 /*break*/, 6];
                case 5:
                    setUploadingType(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="space-y-6 md:space-y-8 pb-24 md:pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Storefront Profile
          </h2>
          <p className="text-xs md:text-sm text-on-surface-variant font-medium">
            Customize how your shop appears to customers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2", shop.is_active
            ? "bg-emerald-100 text-emerald-600"
            : "bg-error/10 text-error")}>
            <div className={cn("w-1.5 md:w-2 h-1.5 md:h-2 rounded-full", shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-error")}/>
            {shop.is_active ? "Live on App" : "Hidden"}
          </div>
        </div>
      </header>

      <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <lucide_react_1.Store size={18} className="text-primary md:w-5 md:h-5"/>
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Shop Name
                </label>
                <input className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base" value={formData.name} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { name: e.target.value }));
        }}/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Category
                </label>
                <select className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base" value={formData.category} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { category: e.target.value }));
        }}>
                  <option>Restaurant</option>
                  <option>Bakery</option>
                  <option>Cafe</option>
                  <option>Street Food</option>
                  <option>Home Kitchen</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                Description
              </label>
              <textarea className="w-full p-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all min-h-[80px] md:min-h-[100px] text-sm md:text-base" value={formData.description} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { description: e.target.value }));
        }}/>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Location Address
                </label>
                <button type="button" onClick={function () { return setShowMapPinConfirm(true); }} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 px-2 py-1 rounded-full transition-colors flex items-center gap-1">
                  <lucide_react_1.MapPin size={12}/>
                  Update Map Pin
                </button>
              </div>
              <div className="relative">
                <lucide_react_1.MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 md:w-[18px] md:h-[18px]"/>
                <input className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base" value={formData.location} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { location: e.target.value }));
        }} placeholder="Enter your shop address..."/>
              </div>
              <div className="mt-4 rounded-2xl overflow-hidden border border-outline-variant/10 h-48 md:h-64 bg-surface-container-low relative group z-0">
                <LeafletMap center={{ lat: formData.lat || -25.9964, lng: formData.lng || 28.2268 }} zoom={15} onLocationSelect={function (lat, lng) {
            setFormData(function (prev) { return (__assign(__assign({}, prev), { lat: lat, lng: lng })); });
            fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=".concat(lat, "&lon=").concat(lng, "&email=aviwenotununu4@gmail.com"))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                if (data && data.address) {
                    var city = data.address.city ||
                        data.address.town ||
                        data.address.village ||
                        data.address.suburb ||
                        "";
                    var road = data.address.road || "";
                    var houseNumber = data.address.house_number || "";
                    var newLocation_4 = [
                        houseNumber,
                        road,
                        city,
                        data.address.state,
                    ]
                        .filter(Boolean)
                        .join(", ");
                    setFormData(function (prev) { return (__assign(__assign({}, prev), { location: newLocation_4 || prev.location })); });
                }
            })
                .catch(function () { });
        }}/>
                <button type="button" onClick={function (e) {
            e.preventDefault();
            e.stopPropagation();
            setShowMapPinConfirm(true);
        }} className="absolute bottom-4 right-4 z-[40] bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md hover:scale-105 hover:bg-surface-container-lowest transition-all cursor-pointer flex items-center gap-2 border border-outline-variant/20">
                  <lucide_react_1.MapPin size={14} className="text-primary"/>
                  <span className="text-[10px] font-bold text-primary">
                    AUTO-LOCATE
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
              <lucide_react_1.Phone size={18} className="text-primary md:w-5 md:h-5"/>
              Contact & Socials
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="flex items-center justify-between text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  <span>Phone Number</span>
                  {!formData.phone && (<span className="flex items-center gap-1 text-[10px] text-error animate-pulse">
                      <lucide_react_1.AlertCircle size={10}/> Missing
                    </span>)}
                </label>
                <input className={cn("w-full h-10 md:h-12 px-4 rounded-xl border-none focus:ring-2 transition-all text-sm md:text-base font-bold text-on-surface", !formData.phone ? "bg-error/5 ring-1 ring-error/20" : "bg-surface-container-low focus:ring-primary/40")} value={formData.phone} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setFormData(__assign(__assign({}, formData), { phone: result.formatted }));
        }} placeholder="e.g. +27 82 123 4567"/>
                <p className="text-[10px] text-on-surface-variant/60 ml-1 italic font-medium">Used for direct customer calls.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Email Address
                </label>
                <input className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base font-bold text-on-surface" value={formData.email} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { email: e.target.value }));
        }}/>
                <p className="text-[10px] text-on-surface-variant/60 ml-1 italic font-medium">Used for order receipts & business updates.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1 flex items-center gap-1">
                  <lucide_react_1.Instagram size={12}/> Instagram
                </label>
                <input placeholder="@username" className="w-full h-10 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-bold text-on-surface" value={formData.instagram} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { instagram: e.target.value }));
        }}/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1 flex items-center gap-1">
                  <lucide_react_1.Facebook size={12}/> Facebook
                </label>
                <input placeholder="page name" className="w-full h-10 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-bold text-on-surface" value={formData.facebook} onChange={function (e) {
            return setFormData(__assign(__assign({}, formData), { facebook: e.target.value }));
        }}/>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between text-[10px] md:text-xs font-primary ml-1 font-black uppercase">
                  <span className="flex items-center gap-1 text-primary"><lucide_react_1.MessageCircle size={12}/> WhatsApp (Critical)</span>
                  {!formData.whatsapp && (<span className="flex items-center gap-1 text-[10px] text-error animate-pulse">
                      <lucide_react_1.AlertCircle size={10}/> Required
                    </span>)}
                </label>
                <input placeholder="WhatsApp number" className={cn("w-full h-10 px-4 rounded-xl border focus:ring-2 transition-all text-sm font-black text-on-surface", !formData.whatsapp ? "bg-error/5 border-error/50 ring-error/20" : "bg-primary/5 border-primary/20 focus:ring-primary/40")} value={formData.whatsapp} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setFormData(__assign(__assign({}, formData), { whatsapp: result.formatted }));
        }}/>
                <p className="text-[10px] text-primary/60 ml-1 italic font-bold">This is how customers will contact you on WhatsApp.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Live Preview Card */}
          <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden hidden lg:block">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4 ml-1">
              Live App Preview
            </h3>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-container-low mb-4 shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-primary/10"/>
              <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                <div className="w-12 h-12 rounded-xl bg-white shadow-lg shrink-0 overflow-hidden flex items-center justify-center">
                  {!isPlaceholderImage(formData.logo_url) ? (<img src={formData.logo_url} className="w-full h-full object-cover" alt="Logo"/>) : (<img src={DEFAULT_SHOP_LOGO} className="w-full h-full object-cover opacity-80" alt="Default Logo"/>)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-lg leading-tight truncate">
                    {formData.name || "Shop Name"}
                  </h4>
                  <div className="flex items-center gap-1 text-white/70 text-[10px] truncate">
                    <lucide_react_1.MapPin size={10}/>
                    {formData.location || "Location"}
                  </div>
                </div>
                <button type="button" onClick={function () { return __awaiter(void 0, void 0, void 0, function () {
            var error, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, supabase
                                .from("shop_followers")
                                .insert({ shop_id: shop.id, user_id: user === null || user === void 0 ? void 0 : user.id })];
                    case 1:
                        error = (_b.sent()).error;
                        if (error)
                            throw error;
                        sonner_1.toast.success("You are now following this shop! (Test)");
                        onRefresh();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        sonner_1.toast.error("Failed to follow shop. (Test)");
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }} className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full shadow-lg hover:bg-primary/90 transition-colors">
                  Follow
                </button>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant text-center italic leading-tight">
              This is how your shop card appears to customers in the LocalEats
              app.
            </p>
          </div>

          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <lucide_react_1.Image size={18} className="text-primary md:w-5 md:h-5"/>
              Visuals
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Shop Logo
                </label>
                <div className="relative group">
                  <div className="w-16 md:w-24 h-16 md:h-24 rounded-2xl bg-surface-container-low overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                    {uploadingType === "logo" ? (<lucide_react_1.RefreshCw className="animate-spin text-primary" size={24}/>) : !isPlaceholderImage(formData.logo_url) ? (<img src={formData.logo_url} className="w-full h-full object-cover" alt="Logo"/>) : (<div className="w-full h-full flex items-center justify-center" style={{
                background: "linear-gradient(135deg, #ff9d42 0%, #f58220 100%)",
            }}>
                        <lucide_react_1.Store size={32} className="text-white drop-shadow-md" strokeWidth={1.5}/>
                      </div>)}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                    <lucide_react_1.Upload size={18} className="md:w-5 md:h-5"/>
                    <input type="file" className="hidden" accept="image/*" onChange={function (e) { return handleImageUpload(e, "logo"); }} disabled={!!uploadingType}/>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <button type="submit" disabled={isSaving || isSuccess} className={cn("w-full py-3 md:py-4 text-on-primary font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2", isSuccess
            ? "bg-emerald-500 shadow-emerald-500/20 hover:scale-[0.98] active:scale-95"
            : isSaving
                ? "bg-surface-container-highest cursor-not-allowed text-on-surface-variant shadow-none"
                : "bg-primary shadow-primary/20 hover:scale-[0.98] active:scale-95")}>
            {isSuccess ? (<>
                <lucide_react_1.Check size={18} strokeWidth={3}/>
                Saved Successfully!
              </>) : isSaving ? (<>
                <lucide_react_1.Loader2 className="animate-spin" size={18}/>
                Saving Changes...
              </>) : (<>
                <lucide_react_1.CheckCircle2 size={18}/>
                Save Changes
              </>)}
          </button>
        </div>
      </form>

      <react_2.AnimatePresence>
        {showMapPinConfirm && (<react_2.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <react_2.motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-outline-variant/20">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 mx-auto">
                <lucide_react_1.MapPin size={32}/>
              </div>
              <h3 className="text-2xl font-headline font-bold text-on-surface text-center mb-3">
                Update Location?
              </h3>
              <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                This will request your device's current location and
                automatically update your shop's address. Are you sure you want
                to proceed?
              </p>

              <div className="flex gap-4">
                <button onClick={function () { return setShowMapPinConfirm(false); }} disabled={isLocating} className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleUpdateLocation} disabled={isLocating} className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-on-primary bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLocating ? (<>
                      <lucide_react_1.RefreshCw className="animate-spin" size={18}/>
                      <span>Locating...</span>
                    </>) : (<span>Yes, Update</span>)}
                </button>
              </div>
            </react_2.motion.div>
          </react_2.motion.div>)}
      </react_2.AnimatePresence>
    </div>);
};
var ChatWindow = function (_a) {
    var orderId = _a.orderId, shopId = _a.shopId, userId = _a.userId, onClose = _a.onClose;
    var _b = (0, react_1.useState)([]), messages = _b[0], setMessages = _b[1];
    var _c = (0, react_1.useState)(""), newMessage = _c[0], setNewMessage = _c[1];
    var _d = (0, react_1.useState)(true), loading = _d[0], setLoading = _d[1];
    var scrollRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var fetchMessages = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("chat_messages")
                            .select("*")
                            .eq("order_id", orderId)
                            .order("created_at", { ascending: true })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (!error && data)
                            setMessages(data);
                        setLoading(false);
                        return [2 /*return*/];
                }
            });
        }); };
        fetchMessages();
        // Real-time subscription
        var channel = supabase
            .channel("chat:".concat(orderId))
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: "order_id=eq.".concat(orderId),
        }, function (payload) {
            setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [payload.new], false); });
        })
            .subscribe();
        return function () {
            supabase.removeChannel(channel).catch(console.error);
        };
    }, [orderId]);
    (0, react_1.useEffect)(function () {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);
    var sendMessage = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var message, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!newMessage.trim())
                        return [2 /*return*/];
                    message = {
                        order_id: orderId,
                        shop_id: shopId,
                        user_id: userId,
                        sender_id: shopId.toString(), // Shop is sender
                        sender_type: "shop",
                        content: newMessage.trim(),
                    };
                    return [4 /*yield*/, supabase.from("chat_messages").insert(message)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        sonner_1.toast.error("Failed to send message");
                    else
                        setNewMessage("");
                    return [2 /*return*/];
            }
        });
    }); };
    return (<div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden flex flex-col h-[400px] shadow-xl mt-4">
      <div className="p-4 bg-primary text-on-primary flex justify-between items-center">
        <div className="flex items-center gap-2">
          <lucide_react_1.MessageCircle size={18}/>
          <span className="font-bold text-sm">
            Customer Chat - #LE-{orderId}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
          <lucide_react_1.X size={18}/>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest">
        {loading ? (<div className="flex justify-center p-4">
            <lucide_react_1.RefreshCw className="animate-spin text-primary/40" size={24}/>
          </div>) : messages.length === 0 ? (<div className="text-center text-on-surface-variant/40 py-12">
            <p className="text-xs italic">
              No messages yet. Start the conversation!
            </p>
          </div>) : (messages.map(function (msg) { return (<div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.sender_type === "shop"
                ? "ml-auto items-end"
                : "mr-auto items-start")}>
              <div className={cn("px-4 py-2 rounded-2xl text-sm shadow-sm", msg.sender_type === "shop"
                ? "bg-primary text-on-primary rounded-tr-none"
                : "bg-surface-container-high text-on-surface rounded-tl-none")}>
                {msg.content}
              </div>
              <span className="text-[9px] text-on-surface-variant/60 mt-1">
                {(0, date_fns_1.format)(new Date(msg.created_at), "HH:mm")}
              </span>
            </div>); }))}
      </div>

      <form onSubmit={sendMessage} className="p-3 bg-surface-container-low border-t border-outline-variant/10 flex gap-2">
        <input type="text" value={newMessage} onChange={function (e) { return setNewMessage(e.target.value); }} placeholder="Type a message..." className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        <button type="submit" className="p-2 bg-primary text-on-primary rounded-full hover:scale-105 transition-transform">
          <Send size={18}/>
        </button>
      </form>
    </div>);
};
var ReviewsList = function (_a) {
    var reviews = _a.reviews, onRespond = _a.onRespond;
    var _b = (0, react_1.useState)(null), respondingTo = _b[0], setRespondingTo = _b[1];
    var _c = (0, react_1.useState)(""), responseText = _c[0], setResponseText = _c[1];
    return (<div className="space-y-4">
      {reviews.length === 0 ? (<div className="text-center py-20 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/20 px-8">
          <div className="w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-6 text-on-surface-variant/20">
            <lucide_react_1.Star size={48}/>
          </div>
          <h3 className="text-lg font-bold text-on-surface mb-2">No Reviews Yet</h3>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto opacity-70">
            Reviews from your customers will appear here. They help you build trust and improve your service!
          </p>
        </div>) : (reviews.map(function (review) { return (<div key={review.id} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface">
                    {review.customer_name}
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(function (star) { return (<lucide_react_1.Star key={star} size={14} className={cn(star <= review.rating
                    ? "text-primary fill-primary"
                    : "text-on-surface-variant/20")}/>); })}
                  </div>
                </div>
                <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-widest">
                  {(0, date_fns_1.format)(new Date(review.created_at), "MMMM d, yyyy")}
                </p>
              </div>
            </div>

            <p className="text-sm text-on-surface leading-relaxed italic">
              "{review.comment}"
            </p>

            {review.response ? (<div className="bg-primary/5 p-4 rounded-2xl border-l-4 border-primary space-y-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Your Response
                </span>
                <p className="text-sm text-on-surface-variant italic">
                  "{review.response}"
                </p>
              </div>) : respondingTo === review.id ? (<div className="space-y-3">
                <textarea value={responseText} onChange={function (e) { return setResponseText(e.target.value); }} placeholder="Write a professional response..." className="w-full bg-surface-container-low border border-primary/20 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" rows={3}/>
                <div className="flex gap-2">
                  <button onClick={function () {
                    onRespond(review.id, responseText);
                    setRespondingTo(null);
                    setResponseText("");
                }} className="px-6 py-2 bg-primary text-on-primary rounded-full text-xs font-bold">
                    Post Response
                  </button>
                  <button onClick={function () { return setRespondingTo(null); }} className="px-6 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold">
                    Cancel
                  </button>
                </div>
              </div>) : (<button onClick={function () { return setRespondingTo(review.id); }} className="flex items-center gap-2 text-primary text-xs font-bold hover:underline">
                <lucide_react_1.MessageSquare size={14}/>
                Respond to Review
              </button>)}
          </div>); }))}
    </div>);
};
var OrdersManagement = function (_a) {
    var orders = _a.orders, onUpdateStatus = _a.onUpdateStatus, onDeleteAllOrders = _a.onDeleteAllOrders, loading = _a.loading, onRefresh = _a.onRefresh, kitchenMode = _a.kitchenMode, setKitchenMode = _a.setKitchenMode, soundAlerts = _a.soundAlerts, setSoundAlerts = _a.setSoundAlerts, onRequestRider = _a.onRequestRider, onUnassignRider = _a.onUnassignRider, onTabChange = _a.onTabChange, sendRiderNudge = _a.sendRiderNudge, currentShop = _a.currentShop;
    var _b = (0, react_1.useState)("active"), viewMode = _b[0], setViewMode = _b[1];
    var _c = (0, react_1.useState)(""), searchTerm = _c[0], setSearchTerm = _c[1];
    var _d = (0, react_1.useState)(""), customerSearch = _d[0], setCustomerSearch = _d[1];
    var _e = (0, react_1.useState)(""), phoneSearch = _e[0], setPhoneSearch = _e[1];
    var _f = (0, react_1.useState)(false), showSearch = _f[0], setShowSearch = _f[1];
    var _g = (0, react_1.useState)(null), acceptingOrderId = _g[0], setAcceptingOrderId = _g[1];
    var _h = (0, react_1.useState)(null), preparingOrderId = _h[0], setPreparingOrderId = _h[1];
    var _j = (0, react_1.useState)(null), expandedOrderId = _j[0], setExpandedOrderId = _j[1];
    var _k = (0, react_1.useState)(null), readyOrderId = _k[0], setReadyOrderId = _k[1];
    var _l = (0, react_1.useState)(null), updatingOrderId = _l[0], setUpdatingOrderId = _l[1];
    var _m = (0, react_1.useState)(null), chatOrderId = _m[0], setChatOrderId = _m[1];
    var _o = (0, react_1.useState)(null), showRiderPicker = _o[0], setShowRiderPicker = _o[1];
    var _p = (0, react_1.useState)([]), connectedRiders = _p[0], setConnectedRiders = _p[1];
    var _q = (0, react_1.useState)(null), ratingOrderId = _q[0], setRatingOrderId = _q[1];
    var _r = (0, react_1.useState)(0), ratingValue = _r[0], setRatingValue = _r[1];
    (0, react_1.useEffect)(function () {
        if (currentShop) {
            var fetchRiders_1 = function () { return __awaiter(void 0, void 0, void 0, function () {
                var data, now_1, processed;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, supabase
                                .from("rider_connections")
                                .select("\n            *,\n            rider_profiles:rider_id (\n              is_online,\n              full_name,\n              phone,\n              status,\n              vehicle_type,\n              rating,\n              current_latitude,\n              current_longitude\n            )\n          ")
                                .eq("shop_id", currentShop.id)
                                .not("rider_id", "is", null)];
                        case 1:
                            data = (_a.sent()).data;
                            if (data) {
                                now_1 = new Date();
                                processed = data.map(function (item) {
                                    var conn = item;
                                    var profile = item.rider_profiles;
                                    return __assign(__assign({}, conn), { is_online: (profile === null || profile === void 0 ? void 0 : profile.is_online) || false, rider_name: (profile === null || profile === void 0 ? void 0 : profile.full_name) || conn.rider_name, rider_phone: (profile === null || profile === void 0 ? void 0 : profile.phone) || conn.rider_phone, status: (profile === null || profile === void 0 ? void 0 : profile.status) || (new Date(conn.expires_at) < now_1 ? "expired" : conn.status), vehicle_type: (profile === null || profile === void 0 ? void 0 : profile.vehicle_type) || "Road", rating: (profile === null || profile === void 0 ? void 0 : profile.rating) || 5.0, current_latitude: profile === null || profile === void 0 ? void 0 : profile.current_latitude, current_longitude: profile === null || profile === void 0 ? void 0 : profile.current_longitude });
                                });
                                setConnectedRiders(processed);
                            }
                            return [2 /*return*/];
                    }
                });
            }); };
            void fetchRiders_1();
            var sub_1 = supabase
                .channel("riders-sync")
                .on("postgres_changes", { event: "*", schema: "public", table: "rider_connections" }, function () { return void fetchRiders_1(); })
                .subscribe();
            return function () {
                void supabase.removeChannel(sub_1);
            };
        }
    }, [currentShop]);
    var _s = (0, react_1.useState)("We have received your order and are starting to prepare it!"), customMessage = _s[0], setCustomMessage = _s[1];
    var _t = (0, react_1.useState)("20-30 mins"), estimatedTime = _t[0], setEstimatedTime = _t[1];
    var avgPrepTime = (0, react_1.useMemo)(function () {
        var pendingCount = orders.filter(function (o) { return o.status === "pending" || o.status === "preparing"; }).length;
        // Base 12 mins + 1.5 mins per pending order, capped at 45
        return Number(Math.min(12 + pendingCount * 1.5, 45)).toFixed(1);
    }, [orders]);
    var submitRiderRating = function (orderId, riderId, rating) { return __awaiter(void 0, void 0, void 0, function () {
        var error, ratingsData, avgRating;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!rating)
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase.from('orders').update({ merchant_rating: rating }).eq('id', orderId)];
                case 1:
                    error = (_a.sent()).error;
                    if (!error) return [3 /*break*/, 2];
                    sonner_1.toast.error("Failed to rate rider");
                    return [3 /*break*/, 5];
                case 2:
                    sonner_1.toast.success("Rider rated successfully!");
                    onRefresh();
                    return [4 /*yield*/, supabase
                            .from('orders')
                            .select('merchant_rating')
                            .eq('rider_id', riderId)
                            .not('merchant_rating', 'is', null)];
                case 3:
                    ratingsData = (_a.sent()).data;
                    if (!(ratingsData && ratingsData.length > 0)) return [3 /*break*/, 5];
                    avgRating = ratingsData.reduce(function (acc, curr) { return acc + (curr.merchant_rating || 0); }, 0) / ratingsData.length;
                    return [4 /*yield*/, supabase.from('rider_profiles').update({ rating: avgRating }).eq('id', riderId)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    setRatingOrderId(null);
                    setRatingValue(0);
                    return [2 /*return*/];
            }
        });
    }); };
    var calculateDynamicETA = function (order) {
        if (!order.rider_id || !order.lat || !order.lng || order.delivery_status === "delivered") {
            return order.estimated_delivery_time || "20-30 mins";
        }
        var assignedRider = connectedRiders.find(function (r) { return r.rider_id === order.rider_id; });
        if (!assignedRider || !assignedRider.current_latitude || !assignedRider.current_longitude) {
            return order.estimated_delivery_time || "20-30 mins";
        }
        var R = 6371;
        var dLat = (order.lat - assignedRider.current_latitude) * Math.PI / 180;
        var dLon = (order.lng - assignedRider.current_longitude) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(assignedRider.current_latitude * Math.PI / 180) * Math.cos(order.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c;
        var timeMinutes = Math.max(5, Math.round(d * 4)); // 15km/h avg
        if (order.delivery_status === "finding_rider" || order.delivery_status === "accepted") {
            return "".concat(Math.round(timeMinutes + Number(avgPrepTime)), " mins");
        }
        return "".concat(timeMinutes, " mins");
    };
    var _u = (0, react_1.useState)(""), startDate = _u[0], setStartDate = _u[1];
    var _v = (0, react_1.useState)(""), endDate = _v[0], setEndDate = _v[1];
    var _w = (0, react_1.useState)({}), recentlyChangedOrders = _w[0], setRecentlyChangedOrders = _w[1];
    var prevOrdersRef = (0, react_1.useRef)([]);
    var _x = (0, react_1.useState)(function () {
        return Number(localStorage.getItem("maxConcurrentOrders")) || 10;
    }), maxConcurrentOrders = _x[0], setMaxConcurrentOrders = _x[1];
    (0, react_1.useEffect)(function () {
        if (prevOrdersRef.current.length > 0) {
            var changes_1 = {};
            orders.forEach(function (order) {
                var prevOrder = prevOrdersRef.current.find(function (o) { return o.id === order.id; });
                if (prevOrder && prevOrder.status !== order.status) {
                    changes_1[order.id] = true;
                    // Clear highlight after 5 seconds
                    setTimeout(function () {
                        setRecentlyChangedOrders(function (prev) {
                            var next = __assign({}, prev);
                            delete next[order.id];
                            return next;
                        });
                    }, 5000);
                }
            });
            if (Object.keys(changes_1).length > 0) {
                setTimeout(function () {
                    setRecentlyChangedOrders(function (prev) { return (__assign(__assign({}, prev), changes_1)); });
                }, 0);
            }
        }
        prevOrdersRef.current = orders;
    }, [orders]);
    (0, react_1.useEffect)(function () {
        localStorage.setItem("maxConcurrentOrders", maxConcurrentOrders.toString());
    }, [maxConcurrentOrders]);
    var activeCount = orders.filter(function (o) { return o.status !== "completed" && o.status !== "cancelled"; }).length;
    var isLimitReached = activeCount >= maxConcurrentOrders;
    // Calculate customer loyalty
    var customerOrderCounts = orders.reduce(function (acc, order) {
        acc[order.user_id] = (acc[order.user_id] || 0) + 1;
        return acc;
    }, {});
    var _y = (0, react_1.useState)(true), alertsEnabled = _y[0], setAlertsEnabled = _y[1];
    var _z = (0, react_1.useState)(false), ordersPaused = _z[0], setOrdersPaused = _z[1];
    var _0 = (0, react_1.useState)("All"), filterStatus = _0[0], setFilterStatus = _0[1];
    var _1 = (0, react_1.useState)("All"), orderTypeFilter = _1[0], setOrderTypeFilter = _1[1];
    var _2 = (0, react_1.useState)("created_at"), sortField = _2[0], setSortField = _2[1];
    var _3 = (0, react_1.useState)("desc"), sortDirection = _3[0], setSortDirection = _3[1];
    var displayedOrders = (0, react_1.useMemo)(function () {
        var activeOrders = orders.filter(function (o) { return o.status !== "completed" && o.status !== "cancelled"; });
        var historyOrders = orders.filter(function (o) { return o.status === "completed" || o.status === "cancelled"; });
        var baseOrders = viewMode === "active" ? activeOrders : historyOrders;
        var filtered = baseOrders.filter(function (o) {
            var _a, _b;
            var matchesSearch = o.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.id.toString().includes(searchTerm);
            var matchesCustomer = !customerSearch ||
                ((_a = o.customer_name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(customerSearch.toLowerCase()));
            var matchesPhone = !phoneSearch || ((_b = o.phone) === null || _b === void 0 ? void 0 : _b.includes(phoneSearch));
            var matchesFilter = filterStatus === "All" || o.status === filterStatus;
            var matchesOrderType = orderTypeFilter === "All" || o.order_type === orderTypeFilter;
            var matchesDate = true;
            var dateToCheck = (viewMode === "history" && o.completed_at) ? o.completed_at : o.created_at;
            if (startDate) {
                matchesDate =
                    matchesDate && new Date(dateToCheck) >= new Date(startDate);
            }
            if (endDate) {
                var end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && new Date(dateToCheck) <= end;
            }
            return (matchesSearch &&
                matchesCustomer &&
                matchesPhone &&
                matchesFilter &&
                matchesOrderType &&
                matchesDate);
        });
        return filtered.sort(function (a, b) {
            var comparison = 0;
            if (sortField === "id") {
                comparison = a.id.localeCompare(b.id);
            }
            else if (sortField === "total_price") {
                comparison = Number(a.total_price) - Number(b.total_price);
            }
            else if (sortField === "created_at") {
                comparison =
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
            return sortDirection === "asc" ? comparison : -comparison;
        });
    }, [
        orders,
        viewMode,
        searchTerm,
        customerSearch,
        phoneSearch,
        filterStatus,
        orderTypeFilter,
        startDate,
        endDate,
        sortField,
        sortDirection,
    ]);
    var handleSort = function (field) {
        if (sortField === field) {
            setSortDirection(function (prev) { return (prev === "asc" ? "desc" : "asc"); });
        }
        else {
            setSortField(field);
            setSortDirection("desc");
        }
    };
    var exportToCSV = function () {
        var headers = [
            "Order ID",
            "Product Name",
            "Total Price",
            "Status",
            "Date",
            "Customer",
            "Address",
        ];
        var csvContent = __spreadArray([
            headers.join(",")
        ], orders.map(function (o) {
            return [
                o.id,
                "\"".concat(o.product_name.replace(/"/g, '""'), "\""),
                o.total_price,
                o.status,
                (0, date_fns_1.format)(new Date(o.created_at), "yyyy-MM-dd HH:mm:ss"),
                "\"".concat(o.customer_name.replace(/"/g, '""'), "\""),
                "\"".concat(o.address.replace(/"/g, '""'), ", ").concat(o.city.replace(/"/g, '""'), "\""),
            ].join(",");
        }), true).join("\n");
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        var link = document.createElement("a");
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "orders_export_".concat((0, date_fns_1.format)(new Date(), "yyyyMMdd_HHmmss"), ".csv"));
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        sonner_1.toast.success("Orders exported as CSV!");
    };
    var exportToJSON = function () {
        var jsonContent = JSON.stringify(orders, null, 2);
        var blob = new Blob([jsonContent], { type: "application/json" });
        var link = document.createElement("a");
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "orders_export_".concat((0, date_fns_1.format)(new Date(), "yyyyMMdd_HHmmss"), ".json"));
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        sonner_1.toast.success("Orders exported as JSON!");
    };
    var orderStatuses = [
        "All",
        "pending",
        "accepted",
        "preparing",
        "ready",
        "completed",
        "cancelled",
    ];
    var handleRiderAction = function (rider, orderId) {
        var isExpired = new Date(rider.expires_at) < new Date();
        if (isExpired) {
            sonner_1.toast.error("Connection Expired. Please generate a new Link Code to re-pair.", {
                duration: 5000,
                position: "top-center",
            });
            // Redirect logic
            onTabChange("riders");
            return;
        }
        if (!rider.is_online) {
            // Show "Wake to Tip" button UI or similar
            // Handled in the UI loop
            return;
        }
        onRequestRider(orderId, rider.rider_id);
    };
    if (loading) {
        return (<div className="space-y-12">
        <Skeleton className="h-40 rounded-3xl"/>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(function (i) { return (<Skeleton key={i} className="h-64 rounded-xl"/>); })}
          </div>
          <Skeleton className="lg:col-span-4 h-96 rounded-3xl"/>
        </div>
      </div>);
    }
    return (<div className="space-y-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-1">
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2 block">
            Live Operations
          </span>
          <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
            Orders Management
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Streamline your kitchen workflow and monitor real-time fulfillment
            across all delivery channels.
          </p>
        </div>
        <div className="flex flex-col gap-4 items-start md:items-end w-full md:w-auto">
          <div className="flex flex-wrap gap-3 justify-start md:justify-end">
            <button onClick={function () {
            sonner_1.toast.info("Clearing all orders...");
            onDeleteAllOrders();
        }} className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-error/10 text-error rounded-full text-xs md:text-sm font-bold shadow-sm hover:bg-error/20 transition-all cursor-pointer relative z-20">
              <lucide_react_1.Trash2 size={16} className="md:w-[18px] md:h-[18px]"/>
              Clear All
            </button>
            <button onClick={function () {
            sonner_1.toast.info("Refreshing orders...");
            onRefresh();
        }} className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-primary text-on-primary rounded-full text-xs md:text-sm font-bold shadow-sm hover:scale-105 transition-all cursor-pointer relative z-20">
              <lucide_react_1.Clock size={16} className="md:w-[18px] md:h-[18px]"/>
              Refresh
            </button>
            <button onClick={exportToCSV} className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-surface-container-high text-on-surface rounded-full text-xs md:text-sm font-bold shadow-sm hover:bg-surface-container-highest transition-all cursor-pointer relative z-20">
              <lucide_react_1.FileDown size={16} className="md:w-[18px] md:h-[18px]"/>
              CSV
            </button>
            <button onClick={exportToJSON} className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-surface-container-high text-on-surface rounded-full text-xs md:text-sm font-bold shadow-sm hover:bg-surface-container-highest transition-all cursor-pointer relative z-20">
              <lucide_react_1.FileDown size={16} className="md:w-[18px] md:h-[18px]"/>
              JSON
            </button>
          </div>
          <div className="flex p-1.5 bg-surface-container-low rounded-full w-fit">
            <button onClick={function () { return setViewMode("active"); }} className={cn("px-6 py-2.5 rounded-full text-sm font-bold transition-all", viewMode === "active"
            ? "bg-surface-container-lowest shadow-sm text-primary"
            : "text-on-secondary-container hover:bg-surface-container-high")}>
              Current Orders
            </button>
            <button onClick={function () { return setViewMode("history"); }} className={cn("px-6 py-2.5 rounded-full text-sm font-bold transition-all", viewMode === "history"
            ? "bg-surface-container-lowest shadow-sm text-primary"
            : "text-on-secondary-container hover:bg-surface-container-high")}>
              Order History
            </button>
          </div>
          <button onClick={function () { return setKitchenMode(!kitchenMode); }} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all border-2", kitchenMode
            ? "bg-primary text-on-primary border-primary"
            : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20")}>
            <lucide_react_1.UtensilsCrossed size={18}/>
            Kitchen Mode {kitchenMode ? "ON" : "OFF"}
          </button>
        </div>
      </section>

      <div className={cn("grid grid-cols-1 gap-8 items-start", !kitchenMode && "lg:grid-cols-12")}>
        <div className={cn(kitchenMode ? "col-span-full" : "lg:col-span-8", "space-y-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mr-2">
                  Filter Status:
                </span>
                {orderStatuses.map(function (status) { return (<button key={status} onClick={function () { return setFilterStatus(status); }} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2", filterStatus === status
                ? "bg-primary/10 text-primary border-primary"
                : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20")}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>); })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mr-2">
                  Order Type:
                </span>
                {["All", "delivery", "collection"].map(function (type) { return (<button key={type} onClick={function () { return setOrderTypeFilter(type); }} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2", orderTypeFilter === type
                ? "bg-primary/10 text-primary border-primary"
                : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20")}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>); })}
                {(filterStatus !== "All" || orderTypeFilter !== "All" || startDate || endDate || searchTerm || customerSearch || phoneSearch) && (<button onClick={function () {
                setFilterStatus("All");
                setOrderTypeFilter("All");
                setStartDate("");
                setEndDate("");
                setSearchTerm("");
                setCustomerSearch("");
                setPhoneSearch("");
            }} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black text-white bg-error shadow-lg shadow-error/20 hover:scale-105 active:scale-95 transition-all">
                    <lucide_react_1.RefreshCw size={12}/>
                    RESET
                  </button>)}
              </div>

              {viewMode === "history" && (<div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mr-2">
                    Order History Filter:
                  </span>
                  <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant/20">
                    <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest ml-3">
                      Completed:
                    </span>
                    <input type="date" value={startDate} onChange={function (e) { return setStartDate(e.target.value); }} className="bg-transparent text-xs font-bold text-on-surface outline-none px-2 py-1"/>
                    <span className="text-on-surface-variant/40">to</span>
                    <input type="date" value={endDate} onChange={function (e) { return setEndDate(e.target.value); }} className="bg-transparent text-xs font-bold text-on-surface outline-none px-2 py-1 mr-2"/>
                    {(startDate || endDate) && (<button onClick={function () {
                    setStartDate("");
                    setEndDate("");
                }} className="p-1 hover:bg-surface-container-high rounded-full text-error transition-colors mr-1">
                        <lucide_react_1.X size={14}/>
                      </button>)}
                  </div>
                </div>)}
            </div>

            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline text-xl font-bold flex items-center gap-2">
                {viewMode === "active" ? "Active Queue" : "Order History"}
                <span className="bg-primary-fixed text-on-primary-fixed text-xs px-2.5 py-1 rounded-full">
                  {displayedOrders.length} Orders
                </span>
              </h3>
              <div className="flex gap-2">
                <button onClick={function () { return setShowSearch(!showSearch); }} className={cn("p-2 rounded-full transition-colors", showSearch
            ? "bg-primary text-on-primary"
            : "hover:bg-surface-container-low text-on-surface-variant")}>
                  <lucide_react_1.Search size={20}/>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-2 overflow-x-auto pb-2 scrollbar-hide">
              <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest shrink-0">
                Sort by:
              </span>
              {[
            { id: "created_at", label: "Date", icon: lucide_react_1.Clock },
            { id: "total_price", label: "Price", icon: lucide_react_1.TrendingUp },
            { id: "id", label: "Order ID", icon: lucide_react_1.ReceiptText },
        ].map(function (field) { return (<button key={field.id} onClick={function () {
                return handleSort(field.id);
            }} className={cn("flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all shrink-0 border-2", sortField === field.id
                ? "bg-primary text-on-primary border-primary shadow-[0_4px_12px_rgba(167,52,0,0.3)] scale-105 ring-2 ring-primary/20"
                : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20")}>
                  <field.icon size={14} className={cn(sortField === field.id ? "animate-pulse" : "")}/>
                  {field.label}
                  {sortField === field.id && (<react_2.motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="ml-1 bg-white/20 p-0.5 rounded-full flex items-center justify-center">
                      {sortDirection === "asc" ? (<lucide_react_1.ArrowUp size={12}/>) : (<lucide_react_1.ArrowDown size={12}/>)}
                    </react_2.motion.span>)}
                </button>); })}
            </div>
          </div>

          <react_2.AnimatePresence>
            {showSearch && (<react_2.motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <lucide_react_1.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18}/>
                    <input autoFocus type="text" placeholder="Search product or ID..." value={searchTerm} onChange={function (e) { return setSearchTerm(e.target.value); }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"/>
                  </div>
                  <div className="relative">
                    <lucide_react_1.User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18}/>
                    <input type="text" placeholder="Customer Name..." value={customerSearch} onChange={function (e) { return setCustomerSearch(e.target.value); }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"/>
                  </div>
                  <div className="relative">
                    <lucide_react_1.Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18}/>
                    <input type="text" placeholder="Phone Number..." value={phoneSearch} onChange={function (e) { return setPhoneSearch(e.target.value); }} className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"/>
                  </div>
                </div>
              </react_2.motion.div>)}
          </react_2.AnimatePresence>

          {displayedOrders.length === 0 ? (<div className="bg-surface-container-low rounded-[2rem] p-12 flex flex-col items-center text-center space-y-6 border-2 border-dashed border-outline-variant/20">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                {viewMode === "active" ? (<lucide_react_1.Clock className="text-primary" size={40}/>) : (<lucide_react_1.ReceiptText className="text-primary" size={40}/>)}
              </div>
              <div className="space-y-2">
                <h4 className="font-headline text-2xl font-bold">
                  {viewMode === "active" ? "All caught up!" : "No history yet"}
                </h4>
                <p className="text-on-surface-variant max-w-xs mx-auto">
                  {viewMode === "active"
                ? "Your kitchen is currently clear. New orders will appear here as they arrive."
                : "Completed orders will appear here once they are fulfilled."}
                </p>
              </div>
              {viewMode === "active" && (<button onClick={onRefresh} className="px-8 py-3 bg-surface-container-lowest text-primary font-bold rounded-full shadow-sm hover:scale-105 transition-all border border-primary/10">
                  Check for New Orders
                </button>)}
            </div>) : (<div className={cn("grid gap-6", kitchenMode
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                : "grid-cols-1 md:grid-cols-2")}>
              {displayedOrders.map(function (order, i) {
                var orderCount = customerOrderCounts[order.user_id] || 0;
                var isReturning = orderCount > 1;
                // Timer Alert Logic: If order is pending/preparing for more than 20 mins
                var orderTime = new Date(order.created_at).getTime();
                var now = new Date().getTime();
                var diffMins = Math.floor((now - orderTime) / (1000 * 60));
                var isOverdue = diffMins >= 20 &&
                    (order.status === "pending" || order.status === "preparing");
                return (<react_2.motion.div layout initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: Math.min(i * 0.05, 0.5)
                    }} key={order.id} className={cn("group rounded-xl p-6 shadow-sm border transition-all duration-300 cursor-pointer", isOverdue
                        ? "bg-error/5 border-error/30 ring-1 ring-error/20"
                        : order.status === "pending"
                            ? "bg-primary-light border-primary/20"
                            : order.status === "preparing"
                                ? "bg-primary/10 border-primary/10"
                                : order.status === "ready"
                                    ? "bg-tertiary/10 border-tertiary/20"
                                    : "bg-surface-container-highest border-transparent", kitchenMode && "p-8 border-2", expandedOrderId === order.id &&
                        "ring-2 ring-primary/10 border-primary/20")} onClick={function () {
                        return setExpandedOrderId(expandedOrderId === order.id ? null : order.id);
                    }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="relative">
                        {isOverdue && (<div className="absolute -top-3 -left-3 bg-error text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg z-20">
                            OVERDUE ({diffMins}m)
                          </div>)}
                        {recentlyChangedOrders[order.id] && (<react_2.motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full border-2 border-white z-10"/>)}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("font-label text-[10px] font-bold uppercase tracking-widest block", order.status === "pending"
                        ? "text-primary"
                        : "text-on-surface-variant/60")}>
                            #LE-{order.id}
                          </span>
                          {isReturning && (<span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <lucide_react_1.Star size={10} fill="currentColor"/>
                              RETURNING ({orderCount})
                            </span>)}
                        </div>
                        <h4 className={cn("font-headline font-semibold text-on-surface flex items-center gap-2", kitchenMode ? "text-2xl" : "text-lg")}>
                          {order.customer_name ||
                        "Customer #".concat(order.user_id.slice(0, 5))}
                          {order.delivery_status === "picked_up" && (<react_2.motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-primary/10 text-primary text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest animate-pulse">
                               Out for Delivery
                             </react_2.motion.span>)}
                        </h4>
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex items-center gap-2">
                            <a href={"tel:".concat(order.phone)} className="flex items-center gap-2 text-xs text-primary font-bold hover:underline bg-primary/5 px-2 py-1 rounded-lg transition-colors border border-primary/10" onClick={function (e) { return e.stopPropagation(); }}>
                              <lucide_react_1.Phone size={12}/>
                              <span>{order.phone || "No phone"}</span>
                            </a>
                            {order.phone && (<a href={"https://wa.me/".concat(order.phone.replace(/\D/g, ""))} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-emerald-600 font-bold hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors border border-emerald-200" onClick={function (e) { return e.stopPropagation(); }}>
                                <lucide_react_1.MessageCircle size={12}/>
                                <span>WhatsApp</span>
                              </a>)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                            <lucide_react_1.MapPin size={12} className="text-primary/60"/>
                            <span className="line-clamp-1 italic">
                              {order.address}, {order.city}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {order.estimated_delivery_time || calculateDynamicETA(order) ? (<div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                                <lucide_react_1.Timer size={12}/>
                                <span>ETA: {calculateDynamicETA(order)}</span>
                              </div>) : (<div className="flex items-center gap-2 text-xs text-zinc-500 font-bold bg-zinc-50 px-2 py-1 rounded-lg">
                                <lucide_react_1.Timer size={12}/>
                                <span>ETA: 20-30 mins</span>
                              </div>)}
                            {order.status !== 'completed' && order.status !== 'cancelled' && (<button onClick={function (e) {
                            e.stopPropagation();
                            var newEta = prompt("Enter estimated delivery time (e.g. 20-30 mins):", order.estimated_delivery_time || "25 mins");
                            if (newEta !== null) {
                                onUpdateOrderStatus(order.id, order.status, undefined, newEta);
                            }
                        }} className="p-1 text-primary hover:bg-primary/5 rounded shadow-sm" title="Adjust ETA">
                                <lucide_react_1.Edit2 size={12}/>
                              </button>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-bold text-primary/60 uppercase tracking-wider">
                          {expandedOrderId === order.id
                        ? "Hide Details"
                        : "View Details"}
                          <react_2.motion.div animate={{
                        rotate: expandedOrderId === order.id ? 90 : 0,
                    }} transition={{ duration: 0.2 }}>
                            <lucide_react_1.ChevronRight size={12}/>
                          </react_2.motion.div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", order.status === "pending"
                        ? "bg-primary-fixed text-on-primary-fixed"
                        : order.status === "accepted"
                            ? "bg-blue-100 text-blue-700"
                            : order.status === "preparing"
                                ? "bg-primary/10 text-primary"
                                : order.status === "ready"
                                    ? "bg-tertiary/10 text-tertiary"
                                    : "bg-surface-container-highest text-on-surface-variant")}>
                          {order.status === "pending" ||
                        order.status === "preparing" ||
                        order.status === "accepted" ? (<span className="relative flex h-2 w-2">
                              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", order.status === "accepted"
                            ? "bg-blue-500"
                            : "bg-primary")}></span>
                              <span className={cn("relative inline-flex rounded-full h-2 w-2", order.status === "accepted"
                            ? "bg-blue-500"
                            : "bg-primary")}></span>
                            </span>) : (<lucide_react_1.CheckCircle2 size={14}/>)}
                          {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                        </span>
                        <span className="text-[11px] font-semibold text-on-surface-variant mt-2 flex items-center gap-1">
                          <lucide_react_1.Clock size={14}/>
                          {(0, date_fns_1.format)(new Date(order.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className={cn("flex justify-between items-center", kitchenMode ? "text-xl" : "text-sm")}>
                        <span className="text-on-surface-variant font-medium">
                          {order.product_name}
                        </span>
                        <span className="text-on-surface font-semibold">
                          R {Number(order.total_price || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <react_2.AnimatePresence>
                      {expandedOrderId === order.id && (<react_2.motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-outline-variant/10 pt-6 mb-8 space-y-6" onClick={function (e) { return e.stopPropagation(); }}>
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                              Order Items
                            </span>
                            <div className="bg-surface-container-low rounded-2xl overflow-x-auto border border-outline-variant/10">
                              <table className="w-full min-w-[300px] text-left text-sm">
                                <thead className="bg-surface-container-high text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  <tr>
                                    <th className="px-4 py-2">Item</th>
                                    <th className="px-4 py-2 text-center">
                                      Qty
                                    </th>
                                    <th className="px-4 py-2 text-right">
                                      Price
                                    </th>
                                    <th className="px-4 py-2 text-right">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10">
                                  {order.items && order.items.length > 0 ? (order.items.map(function (item, idx) { return (<tr key={idx} className="hover:bg-surface-container-highest/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-on-surface">
                                          {typeof item === "object" &&
                                item !== null &&
                                "name" in item
                                ? item.name
                                : String(item)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-on-surface-variant">
                                          {typeof item === "object" &&
                                item !== null &&
                                "quantity" in item
                                ? item.quantity
                                : 1}
                                        </td>
                                        <td className="px-4 py-3 text-right text-on-surface-variant">
                                          R{" "}
                                          {Number(typeof item === "object" &&
                                item !== null &&
                                "price" in item
                                ? item.price
                                : 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-on-surface">
                                          R{" "}
                                          {(Number(typeof item === "object" &&
                                item !== null &&
                                "price" in item
                                ? item.price
                                : 0) *
                                Number(typeof item === "object" &&
                                    item !== null &&
                                    "quantity" in item
                                    ? item.quantity
                                    : 1)).toFixed(2)}
                                        </td>
                                      </tr>); })) : (<tr>
                                      <td className="px-4 py-3 font-medium text-on-surface">
                                        {order.product_name}
                                      </td>
                                      <td className="px-4 py-3 text-center text-on-surface-variant">
                                        1
                                      </td>
                                      <td className="px-4 py-3 text-right text-on-surface-variant">
                                        R{" "}
                                        {Number(order.total_price || 0).toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-on-surface">
                                        R{" "}
                                        {Number(order.total_price || 0).toFixed(2)}
                                      </td>
                                    </tr>)}
                                </tbody>
                                <tfoot className="bg-surface-container-low border-t border-outline-variant/20">
                                  <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                      Grand Total
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-primary text-lg">
                                      R{" "}
                                      {Number(order.total_price || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1 sm:col-span-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Fulfillment
                              </span>
                              <div className="inline-flex items-center px-2 py-1 rounded bg-secondary/10 text-secondary text-xs font-black uppercase tracking-widest">
                                {order.order_type === "collection"
                            ? "Customer Collection"
                            : "Delivery"}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Customer Name
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.customer_name || "Not provided"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Phone Number
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.phone || "Not provided"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Payment Method
                              </span>
                              <p className="text-sm font-semibold text-primary">
                                {order.payment_method || "Cash on Delivery"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Email Address
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.email || "Not provided"}
                              </p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Delivery Address
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.address}, {order.city}
                                {order.country ? ", ".concat(order.country) : ""}
                              </p>
                            </div>
                            {order.accepted_at && (<div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  Accepted At
                                </span>
                                <p className="text-sm font-semibold text-on-surface">
                                  {(0, date_fns_1.format)(new Date(order.accepted_at), "HH:mm:ss")}
                                </p>
                              </div>)}
                            {(order.estimated_delivery_time || calculateDynamicETA(order)) && (<div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  Est. Delivery
                                </span>
                                <p className="text-sm font-semibold text-primary">
                                  {calculateDynamicETA(order)}
                                </p>
                              </div>)}
                            {order.notes && (<div className="space-y-1 sm:col-span-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  Order Notes
                                </span>
                                <div className="p-3 bg-surface-container-low rounded-lg text-sm text-on-surface-variant italic">
                                  "{order.notes}"
                                </div>
                              </div>)}

                            <div className="space-y-4 sm:col-span-2 border-t border-outline-variant/10 pt-6 mt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                  <lucide_react_1.Zap size={14}/>
                                  Delivery Ecosystem
                                </span>
                                {order.delivery_status && (<span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter", order.delivery_status === "finding_rider"
                                ? "bg-amber-100 text-amber-700 animate-pulse"
                                : order.delivery_status === "picked_up"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-emerald-100 text-emerald-700")}>
                                    {order.delivery_status.replace("_", " ")}
                                  </span>)}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">
                                    Fee Collection
                                  </span>
                                  <p className="text-sm font-black text-on-surface">
                                    R{" "}
                                    {Number(order.delivery_fee || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">
                                    Rider Assignment
                                  </span>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-mono text-on-surface-variant truncate">
                                      {order.rider_id
                            ? order.rider_id.split("-")[0]
                            : "Idle..."}
                                    </p>
                                    {order.rider_id &&
                            order.delivery_status !== "delivered" && (<button onClick={function (e) {
                                e.stopPropagation();
                                onUnassignRider(order.id);
                            }} className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold hover:bg-red-200">
                                          Remove
                                        </button>)}
                                  </div>
                                </div>
                                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">
                                    Live Track
                                  </span>
                                  <p className="text-xs font-bold text-on-surface-variant">
                                    {order.delivery_status
                            ? "Active Protocol"
                            : "No Signal"}
                                  </p>
                                </div>
                              </div>

                              {order.delivery_status && (<div className="mt-4 space-y-2" onClick={function (e) { return e.stopPropagation(); }}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                      Update Delivery Status
                                    </span>
                                  </div>
                                  <div className="flex gap-2 text-xs">
                                    {["finding_rider", "picked_up", "delivered"].map(function (status) { return (<button key={status} onClick={function (e) { return __awaiter(void 0, void 0, void 0, function () {
                                    var error;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                e.stopPropagation();
                                                return [4 /*yield*/, supabase.from("orders").update({ delivery_status: status }).eq("id", order.id)];
                                            case 1:
                                                error = (_a.sent()).error;
                                                if (error)
                                                    sonner_1.toast.error("Status update failed");
                                                else
                                                    sonner_1.toast.success("Delivery status: ".concat(status.replace("_", " ")));
                                                return [2 /*return*/];
                                        }
                                    });
                                }); }} className={cn("px-3 py-1.5 rounded-lg font-bold border transition-colors flex-1 capitalize", order.delivery_status === status ? "bg-primary text-white border-primary shadow-sm shadow-primary/20" : "bg-surface-container hover:bg-surface-container-high border-outline-variant/10 text-on-surface-variant")}>
                                        {status.replace("_", " ")}
                                      </button>); })}
                                  </div>
                                  
                                  {order.delivery_status === "picked_up" && (<div className="w-full h-32 bg-stone-100 dark:bg-stone-900 rounded-xl overflow-hidden relative border border-outline-variant/10 mt-4 flex items-center justify-center">
                                       <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                                       
                                       {/* Mock Map Route */}
                                       <div className="absolute top-1/2 left-1/4 right-1/4 h-1 border-t-2 border-dashed border-primary/40 -translate-y-1/2"></div>
                                       
                                       <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md z-10">
                                         <lucide_react_1.Store size={14} className="text-secondary"/>
                                       </div>
                                       <div className="absolute right-1/4 top-1/2 translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md z-10">
                                          <lucide_react_1.MapPin size={14} className="text-primary"/>
                                       </div>
                                       
                                       {/* Moving Rider */}
                                       <react_2.motion.div animate={{ x: ["0%", "100%", "0%"] }} transition={{ repeat: Infinity, duration: 15, ease: "linear" }} className="absolute left-1/4 right-1/4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-start pointer-events-none">
                                         <div className="relative -ml-4 -mt-6">
                                            <div className="bg-primary text-white rounded-full p-2 shadow-lg drop-shadow-md border-2 border-white">
                                              <lucide_react_1.Bike size={16}/>
                                            </div>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                               <span className="text-[9px] font-black uppercase text-primary tracking-widest bg-white/95 px-2 py-0.5 rounded shadow-sm border border-primary/10">
                                                 Live ETA: 3 min
                                               </span>
                                            </div>
                                         </div>
                                       </react_2.motion.div>
                                    </div>)}
                                </div>)}

                              {!order.delivery_status &&
                            order.status !== "completed" &&
                            order.order_type !== "collection" && (<div className="space-y-2">
                                    {showRiderPicker === order.id ? (<div className="bg-surface-container p-4 rounded-xl border-2 border-primary/20 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                                            Select Rider to Tag
                                          </span>
                                          <button onClick={function (e) {
                                    e.stopPropagation();
                                    setShowRiderPicker(null);
                                }} className="text-on-surface-variant/40 hover:text-on-surface">
                                            <lucide_react_1.X size={14}/>
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                                          {connectedRiders.map(function (rider) {
                                    var isExpired = new Date(rider.expires_at) <
                                        new Date();
                                    var isOffline = !rider.is_online && !isExpired;
                                    return (<div key={rider.id} className={cn("flex items-center justify-between p-3 bg-surface-container-high rounded-xl transition-all border border-outline-variant/10 group text-left", isExpired &&
                                            "opacity-50 grayscale", !isExpired &&
                                            "hover:bg-primary/10")}>
                                                <div className="flex items-center gap-3">
                                                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isExpired
                                            ? "bg-on-surface/5 text-on-surface-variant"
                                            : "bg-primary/10 text-primary")}>
                                                    <lucide_react_1.Bike size={16}/>
                                                  </div>
                                                  <div>
                                                    <div className="flex items-center gap-2">
                                                      <p className="text-xs font-bold text-on-surface">
                                                        {rider.rider_name || "Quick Rider"}
                                                      </p>
                                                      {!isExpired && (<div className={cn("w-1.5 h-1.5 rounded-full", rider.is_online
                                                ? (rider.status === 'paused' ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.5)]")
                                                : "bg-zinc-300")}/>)}
                                                      {isOffline && (<span className="text-[8px] px-1.5 py-0.5 bg-on-surface/10 text-on-surface-variant rounded-full font-black uppercase">
                                                          OFFLINE
                                                        </span>)}
                                                      {!isExpired && rider.is_online && rider.status === 'paused' && (<span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-black uppercase">
                                                          PAUSED
                                                        </span>)}
                                                    </div>
                                                    <p className="text-[9px] text-on-surface-variant/60 font-mono">
                                                      {isExpired
                                            ? "EXPIRED"
                                            : rider.connection_code}
                                                    </p>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  {isExpired ? (<button onClick={function (e) {
                                                e.stopPropagation();
                                                handleRiderAction(rider, order.id);
                                            }} className="px-2 py-1 bg-error/10 text-error text-[9px] font-black rounded-lg uppercase hover:bg-error/20">
                                                      Repair
                                                    </button>) : isOffline ? (<button onClick={function (e) {
                                                e.stopPropagation();
                                                sendRiderNudge(rider.rider_id, "Urgent order available - Tip boost active!");
                                            }} className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase hover:scale-105 transition-transform">
                                                      <lucide_react_1.Zap size={10}/>
                                                      Wake to Tip
                                                    </button>) : (<button onClick={function (e) {
                                                e.stopPropagation();
                                                onRequestRider(order.id, rider.rider_id);
                                                setShowRiderPicker(null);
                                            }} className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-all">
                                                      <lucide_react_1.ArrowRight size={14}/>
                                                    </button>)}
                                                </div>
                                              </div>);
                                })}
                                          <button onClick={function (e) {
                                    e.stopPropagation();
                                    onRequestRider(order.id);
                                    setShowRiderPicker(null);
                                }} className="p-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 hover:text-primary transition-colors italic">
                                            Broadcast to all (Public)
                                          </button>
                                        </div>
                                      </div>) : (<button onClick={function (e) {
                                    e.stopPropagation();
                                    if (connectedRiders.length > 0) {
                                        setShowRiderPicker(order.id);
                                    }
                                    else {
                                        onRequestRider(order.id);
                                    }
                                }} className="w-full h-12 bg-primary/10 text-primary border-2 border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-2 group shadow-sm active:scale-95">
                                        <lucide_react_1.Rocket size={16} className="group-hover:animate-bounce"/>
                                        {connectedRiders.length > 0
                                    ? "Tag Rider (".concat(connectedRiders.length, " Online)")
                                    : "Invoke Rider Dispatch (R 5.00)"}
                                      </button>)}
                                  </div>)}
                            </div>
                          </div>
                        </react_2.motion.div>)}
                    </react_2.AnimatePresence>

                    {viewMode === "active" && (<div className="flex flex-col gap-4" onClick={function (e) { return e.stopPropagation(); }}>
                        <div className="flex items-center gap-3">
                          {order.status === "pending" && (<div className="flex-1 flex flex-col gap-2">
                              {(order.order_type === "delivery" ||
                                !order.order_type) &&
                                !order.delivery_status && (<button onClick={function (e) {
                                    e.stopPropagation();
                                    onRequestRider(order.id);
                                }} className={cn("w-full bg-orange-600 text-white font-black rounded-full shadow-lg hover:bg-orange-700 transition-all mb-2 flex items-center justify-center gap-2 border-2 border-orange-400/30 py-4", kitchenMode ? "text-xl" : "text-sm")}>
                                    <lucide_react_1.Rocket size={20} className="animate-pulse"/>
                                    REQUEST RIDER NOW
                                  </button>)}
                              {acceptingOrderId === order.id ? (<react_2.motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                  <input type="text" value={customMessage} onChange={function (e) {
                                    return setCustomMessage(e.target.value);
                                }} className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none" placeholder="Enter message..." autoFocus/>
                                  <div className="flex gap-2">
                                    <button onClick={function () {
                                    onUpdateStatus(order.id, "preparing", customMessage);
                                    setAcceptingOrderId(null);
                                }} className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-full">
                                      Send & Accept
                                    </button>
                                    <button onClick={function () { return setAcceptingOrderId(null); }} className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full">
                                      Cancel
                                    </button>
                                  </div>
                                </react_2.motion.div>) : (<div className="space-y-2">
                                  {isLimitReached && (<div className="flex items-center gap-2 p-2 bg-error/10 text-error rounded-lg text-[10px] font-bold">
                                      <lucide_react_1.AlertCircle size={12}/>
                                      ORDER LIMIT REACHED ({maxConcurrentOrders}
                                      )
                                    </div>)}
                                  <button onClick={function () {
                                    return setAcceptingOrderId(order.id);
                                }} disabled={isLimitReached} className={cn("w-full bg-primary text-white font-bold rounded-full shadow-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:grayscale", kitchenMode
                                    ? "py-5 text-lg"
                                    : "py-3 text-sm")}>
                                    Accept Order
                                  </button>
                                </div>)}
                            </div>)}
                          {(order.status === "preparing" ||
                            order.status === "accepted") && (<div className="flex-1 flex flex-col gap-2">
                              {(order.order_type === "delivery" ||
                                !order.order_type) &&
                                !order.delivery_status && (<button onClick={function (e) {
                                    e.stopPropagation();
                                    onRequestRider(order.id);
                                }} className={cn("w-full bg-orange-600 text-white font-black rounded-full shadow-lg hover:bg-orange-700 transition-all mb-2 flex items-center justify-center gap-2 border-2 border-orange-400/30 py-4", kitchenMode ? "text-xl" : "text-sm")}>
                                    <lucide_react_1.Rocket size={20} className="animate-pulse"/>
                                    REQUEST RIDER NOW
                                  </button>)}
                              {order.status === "accepted" && (preparingOrderId === order.id ? (<react_2.motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mb-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">
                                        Update Est. Delivery Time
                                      </label>
                                      <input type="text" value={estimatedTime} onChange={function (e) { return setEstimatedTime(e.target.value); }} className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 25 mins" autoFocus/>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={function () {
                                    onUpdateStatus(order.id, "preparing", undefined, estimatedTime);
                                    setPreparingOrderId(null);
                                }} className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg">
                                        Set Time & Start
                                      </button>
                                      <button onClick={function () { return setPreparingOrderId(null); }} className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-lg">
                                        Cancel
                                      </button>
                                    </div>
                                  </react_2.motion.div>) : (<button onClick={function () { return setPreparingOrderId(order.id); }} className={cn("w-full bg-primary text-white font-bold rounded-full shadow-md hover:bg-primary-container transition-colors mb-2", kitchenMode
                                    ? "py-5 text-lg"
                                    : "py-3 text-sm")}>
                                    Start Preparing
                                  </button>))}
                              {readyOrderId === order.id ? (<react_2.motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">
                                      Est. Delivery Time
                                    </label>
                                    <input type="text" value={estimatedTime} onChange={function (e) {
                                    return setEstimatedTime(e.target.value);
                                }} className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 20-30 mins" autoFocus/>
                                  </div>
                                  <div className="flex gap-2">
                                    <button disabled={updatingOrderId === order.id} onClick={function () { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                setUpdatingOrderId(order.id);
                                                return [4 /*yield*/, onUpdateStatus(order.id, "ready", undefined, estimatedTime)];
                                            case 1:
                                                _a.sent();
                                                setUpdatingOrderId(null);
                                                setReadyOrderId(null);
                                                return [2 /*return*/];
                                        }
                                    });
                                }); }} className="flex-1 py-2 bg-tertiary text-white text-xs font-bold rounded-full disabled:opacity-50">
                                      {updatingOrderId === order.id ? "Updating..." : "Confirm & Ready"}
                                    </button>
                                    <button disabled={updatingOrderId === order.id} onClick={function () { return setReadyOrderId(null); }} className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full disabled:opacity-50">
                                      Cancel
                                    </button>
                                  </div>
                                </react_2.motion.div>) : (<button onClick={function () { return setReadyOrderId(order.id); }} disabled={updatingOrderId === order.id} className={cn("w-full bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.2)] hover:scale-[0.98] transition-transform", kitchenMode
                                    ? "py-5 text-lg"
                                    : "py-3 text-sm", updatingOrderId === order.id && "opacity-50 pointer-events-none")}>
                                  {updatingOrderId === order.id ? "Marking..." : "Mark as Ready"}
                                </button>)}
                            </div>)}
                          {order.status === "ready" && (<button onClick={function () {
                                return onUpdateStatus(order.id, "completed");
                            }} className={cn("flex-1 bg-tertiary text-white font-bold rounded-full hover:bg-tertiary-container transition-colors shadow-md", kitchenMode ? "py-5 text-lg" : "py-3 text-sm")}>
                              Mark as Completed
                            </button>)}
                          <div className="flex gap-2">
                            {order.rider_id && order.status !== "completed" && (<button onClick={function () {
                                var nudgeMessage = order.delivery_status === 'picked_up' ? "Your delivery is almost there!" : "Order ready for pickup!";
                                sendRiderNudge(order.rider_id, nudgeMessage);
                                sonner_1.toast.success("Rider nudged successfully!");
                            }} className={cn("bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-all font-bold flex flex-1 items-center justify-center gap-2", kitchenMode ? "p-5 text-lg" : "p-3 text-sm")} title="Nudge Rider">
                                <lucide_react_1.Zap size={kitchenMode ? 24 : 18}/>
                                {kitchenMode ? "Nudge Rider" : (order.delivery_status === 'picked_up' ? "Ping Rider" : "Nudge")}
                              </button>)}
                            <button onClick={function () {
                            return setChatOrderId(chatOrderId === order.id ? null : order.id);
                        }} className={cn("bg-surface-container-high rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all", kitchenMode ? "p-5" : "p-3", chatOrderId === order.id &&
                            "bg-primary text-on-primary")} title="Chat with Customer">
                              <lucide_react_1.MessageCircle size={kitchenMode ? 24 : 18}/>
                            </button>
                            <button onClick={function () {
                            var printWindow = window.open("", "_blank");
                            if (printWindow) {
                                printWindow.document.write("\n                                  <html>\n                                    <head>\n                                      <title>Receipt #LE-".concat(order.id, "</title>\n                                      <style>\n                                        body { font-family: 'Courier New', Courier, monospace; width: 300px; padding: 20px; }\n                                        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }\n                                        .item { display: flex; justify-content: space-between; margin-bottom: 5px; }\n                                        .total { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }\n                                        .footer { text-align: center; margin-top: 20px; font-size: 12px; }\n                                      </style>\n                                    </head>\n                                    <body>\n                                      <div class=\"header\">\n                                        <h2>LocalEats</h2>\n                                        <p>Order #LE-").concat(order.id, "</p>\n                                        <p>").concat((0, date_fns_1.format)(new Date(order.created_at), "yyyy-MM-dd HH:mm"), "</p>\n                                      </div>\n                                      <div class=\"items\">\n                                        ").concat((order.items || [])
                                    .map(function (i) {
                                    var isObj = typeof i === "object" &&
                                        i !== null;
                                    var p = isObj && "price" in i
                                        ? i
                                            .price
                                        : 0;
                                    var q = isObj && "quantity" in i
                                        ? i
                                            .quantity
                                        : 1;
                                    var n = isObj && "name" in i
                                        ? i.name
                                        : String(i);
                                    return "\n                                            <div class=\"item\">\n                                              <span>".concat(q, "x ").concat(n, "</span>\n                                              <span>R").concat(Number(p * q).toFixed(2), "</span>\n                                            </div>\n                                          ");
                                })
                                    .join("") ||
                                    "<div class=\"item\"><span>1x ".concat(order.product_name, "</span><span>R").concat(Number(order.total_price || 0).toFixed(2), "</span></div>"), "\n                                      </div>\n                                      <div class=\"total\">\n                                        <div class=\"item\">\n                                          <span>TOTAL</span>\n                                          <span>R").concat(Number(order.total_price || 0).toFixed(2), "</span>\n                                        </div>\n                                      </div>\n                                      <div class=\"footer\">\n                                        <p>Customer: ").concat(order.customer_name, "</p>\n                                        <p>Address: ").concat(order.address, "</p>\n                                        <p>Thank you for your order!</p>\n                                      </div>\n                                      <script>window.print(); window.close();</script>\n                                    </body>\n                                  </html>\n                                "));
                                printWindow.document.close();
                            }
                            else {
                                sonner_1.toast.error("Pop-up blocked. Please allow pop-ups to print receipts.");
                            }
                        }} className={cn("bg-surface-container-high rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all", kitchenMode ? "p-5" : "p-3")} title="Print Kitchen Ticket">
                              <lucide_react_1.Printer size={kitchenMode ? 24 : 18}/>
                            </button>
                            {order.status !== "completed" &&
                            order.status !== "cancelled" && (<button onClick={function () {
                                if (window.confirm("Are you sure you want to cancel this order? This cannot be undone.")) {
                                    onUpdateStatus(order.id, "cancelled");
                                }
                            }} className={cn("ml-auto bg-error/10 text-error rounded-full hover:bg-error/20 transition-all font-bold tracking-widest uppercase text-[10px]", kitchenMode ? "px-6 py-2" : "px-4 py-2")}>
                                  Cancel Order
                                </button>)}
                          </div>
                        </div>

                        <react_2.AnimatePresence>
                          {chatOrderId === order.id && (<react_2.motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <ChatWindow orderId={order.id} shopId={order.shop_id} userId={order.user_id} onClose={function () { return setChatOrderId(null); }}/>
                            </react_2.motion.div>)}
                        </react_2.AnimatePresence>
                      </div>)}
                    {viewMode === "history" && order.delivery_status === "delivered" && order.rider_id && (<div className="mt-4 pt-4 border-t border-outline-variant/10" onClick={function (e) { return e.stopPropagation(); }}>
                           <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Rider Rating</p>
                                {order.merchant_rating ? (<div className="flex items-center gap-1 text-amber-500">
                                      {Array(5).fill(0).map(function (_, i) { return (<lucide_react_1.Star key={i} size={14} className={i < order.merchant_rating ? "fill-current" : "text-outline-variant"}/>); })}
                                      <span className="text-xs font-bold text-on-surface ml-2 pl-2 border-l border-outline-variant/20">{order.merchant_rating.toFixed(1)}</span>
                                  </div>) : (<div className="flex flex-col gap-2">
                                     <button onClick={function () {
                                if (ratingOrderId === order.id) {
                                    setRatingOrderId(null);
                                    setRatingValue(0);
                                }
                                else {
                                    setRatingOrderId(order.id);
                                    setRatingValue(5);
                                }
                            }} className="text-xs font-bold text-primary hover:text-primary-container decoration-dashed hover:underline transition-all">
                                        Rate Rider Performance
                                     </button>
                                     {ratingOrderId === order.id && (<div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-xl w-fit border border-outline-variant/20">
                                           <div className="flex items-center gap-1">
                                             {[1, 2, 3, 4, 5].map(function (star) { return (<button key={star} onClick={function () { return setRatingValue(star); }} className="p-1 hover:scale-110 transition-transform">
                                                 <lucide_react_1.Star size={18} className={star <= ratingValue ? "fill-amber-500 text-amber-500" : "text-outline-variant"}/>
                                               </button>); })}
                                           </div>
                                           <button onClick={function () { return submitRiderRating(order.id, order.rider_id, ratingValue); }} className="ml-2 text-[10px] bg-primary text-white font-bold px-3 py-1.5 rounded-lg hover:bg-primary-container">
                                              Submit
                                           </button>
                                        </div>)}
                                  </div>)}
                              </div>
                           </div>
                       </div>)}
                  </react_2.motion.div>);
            })}
            </div>)}
        </div>

        {!kitchenMode && (<div className="lg:col-span-4 space-y-8">
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 shadow-sm">
              <h4 className="font-headline text-base font-bold text-on-surface mb-6 flex items-center gap-2">
                <lucide_react_1.Bell size={18} className="text-primary"/>
                Notification Settings
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Sound Alerts</span>
                    <span className="text-[10px] text-on-surface-variant">
                      Play sound for new orders
                    </span>
                  </div>
                  <button onClick={function () { return setSoundAlerts(!soundAlerts); }} className={cn("w-12 h-6 rounded-full relative transition-all duration-300", soundAlerts
                ? "bg-primary"
                : "bg-surface-container-highest")}>
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", soundAlerts ? "right-1" : "left-1")}></div>
                  </button>
                </div>

                <div className="p-4 bg-surface-container-low rounded-2xl space-y-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Order Limit</span>
                    <span className="text-[10px] text-on-surface-variant">
                      Max concurrent active orders
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input type="range" min="1" max="50" value={maxConcurrentOrders} onChange={function (e) {
                return setMaxConcurrentOrders(Number(e.target.value));
            }} className="flex-1 accent-primary"/>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold min-w-[3rem] text-center">
                      {maxConcurrentOrders}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-high rounded-3xl p-8 relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="font-headline text-lg font-bold text-on-surface mb-6">
                  Status Overview
                </h4>
                <div className="space-y-5">
                  {[
                {
                    label: "New Orders",
                    count: orders.filter(function (o) { return o.status === "pending"; })
                        .length,
                    color: "bg-primary-fixed",
                },
                {
                    label: "Preparing",
                    count: orders.filter(function (o) { return o.status === "preparing"; })
                        .length,
                    color: "bg-primary",
                },
                {
                    label: "Ready for Pickup",
                    count: orders.filter(function (o) { return o.status === "ready"; }).length,
                    color: "bg-tertiary",
                },
                {
                    label: "Completed",
                    count: orders.filter(function (o) { return o.status === "completed"; })
                        .length,
                    color: "bg-secondary",
                },
                {
                    label: "Cancelled",
                    count: orders.filter(function (o) { return o.status === "cancelled"; })
                        .length,
                    color: "bg-error",
                },
            ].map(function (stat, i) { return (<div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-1.5 h-1.5 rounded-full", stat.color)}></div>
                        <span className="text-sm font-semibold text-on-surface-variant">
                          {stat.label}
                        </span>
                      </div>
                      <span className="font-headline font-bold">
                        {stat.count}
                      </span>
                    </div>); })}
                </div>
                <div className="mt-8 pt-8 border-t border-on-surface/5">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Avg. Prep Time
                  </div>
                  <div className="text-3xl font-headline font-extrabold text-primary">
                    {avgPrepTime} min
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">
                    Based on current load
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6">
              <h4 className="font-headline text-base font-bold text-on-surface mb-4">
                Kitchen Hub
              </h4>
              <div className="space-y-3">
                <button onClick={function () {
                setAlertsEnabled(!alertsEnabled);
                sonner_1.toast.success("Order alerts ".concat(!alertsEnabled ? "enabled" : "disabled"));
            }} className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors group">
                  <div className="flex items-center gap-3">
                    <lucide_react_1.Bell size={20} className={alertsEnabled
                ? "text-primary"
                : "text-on-surface-variant/40"}/>
                    <span className="text-sm font-bold">New Order Alerts</span>
                  </div>
                  <div className={cn("w-10 h-6 rounded-full relative transition-colors", alertsEnabled
                ? "bg-primary"
                : "bg-surface-container-highest")}>
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", alertsEnabled ? "right-1" : "left-1")}></div>
                  </div>
                </button>
                <button onClick={function () {
                setOrdersPaused(!ordersPaused);
                sonner_1.toast.warning("Kitchen is now ".concat(!ordersPaused ? "PAUSED" : "ACTIVE"));
            }} className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors">
                  <div className="flex items-center gap-3">
                    <lucide_react_1.PauseCircle size={20} className={ordersPaused ? "text-error" : "text-on-surface-variant"}/>
                    <span className="text-sm font-bold">
                      {ordersPaused ? "Resume Orders" : "Pause New Orders"}
                    </span>
                  </div>
                  <lucide_react_1.ChevronRight size={20} className={cn("text-on-surface-variant transition-transform", ordersPaused && "rotate-90")}/>
                </button>
                <button onClick={function () { return sonner_1.toast.info("Opening printer settings..."); }} className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors">
                  <div className="flex items-center gap-3">
                    <lucide_react_1.Printer size={20} className="text-on-surface-variant"/>
                    <span className="text-sm font-bold">Printer Settings</span>
                  </div>
                  <span className="text-xs font-bold text-tertiary">
                    Online
                  </span>
                </button>
              </div>
            </div>
          </div>)}
      </div>
    </div>);
};
var Marketing = function (_a) {
    var currentShop = _a.currentShop;
    var _b = (0, react_1.useState)(false), isGenerating = _b[0], setIsGenerating = _b[1];
    var _c = (0, react_1.useState)(false), showCampaignModal = _c[0], setShowCampaignModal = _c[1];
    var _d = (0, react_1.useState)("email"), campaignType = _d[0], setCampaignType = _d[1];
    var handleGenerateCampaign = function () {
        setIsGenerating(true);
        setTimeout(function () {
            setIsGenerating(false);
            setShowCampaignModal(true);
        }, 2000);
    };
    return (<div className="space-y-8">
      <header className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
          Marketing
        </h2>
        <p className="text-sm text-on-surface-variant font-medium">
          Grow {(currentShop === null || currentShop === void 0 ? void 0 : currentShop.name) || "your business"} with powerful marketing
          tools.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
            {
                title: "Email Campaigns",
                desc: "Send newsletters and promotions to your customers.",
                icon: lucide_react_1.Mail,
                color: "bg-blue-500",
                type: "email",
            },
            {
                title: "SMS Marketing",
                desc: "Reach customers directly on their phones.",
                icon: lucide_react_1.MessageSquare,
                color: "bg-green-500",
                type: "sms",
            },
            {
                title: "Social Media",
                desc: "Connect your social accounts to post updates.",
                icon: lucide_react_1.Share2,
                color: "bg-purple-500",
                type: "social",
            },
        ].map(function (tool, i) { return (<react_2.motion.div key={i} whileHover={{ y: -5 }} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white", tool.color)}>
              <tool.icon size={24}/>
            </div>
            <h3 className="text-lg font-bold text-on-surface">{tool.title}</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {tool.desc}
            </p>
            <button onClick={function () {
                setCampaignType(tool.type);
                setShowCampaignModal(true);
            }} className="w-full py-2 bg-surface-container text-on-surface font-bold rounded-xl text-xs hover:bg-surface-container-high transition-colors">
              Configure
            </button>
          </react_2.motion.div>); })}

        {/* QR Table Ordering Card */}
        <react_2.motion.div whileHover={{ y: -5 }} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4 flex flex-col">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-teal-500">
            <lucide_react_1.QrCode size={24}/>
          </div>
          <h3 className="text-lg font-bold text-on-surface">Table Ordering</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Generate QR codes for specific tables so dine-in customers can
            order.
          </p>
          <button onClick={function () {
            sonner_1.toast.info("Table Ordering coming soon!", {
                description: "You will be able to generate unique QR codes for each table.",
            });
        }} className="w-full py-2 bg-surface-container text-on-surface font-bold rounded-xl text-xs hover:bg-surface-container-high transition-colors mt-auto">
            Generate Codes
          </button>
        </react_2.motion.div>

        {/* Printable Flyer Card */}
        <react_2.motion.div whileHover={{ y: -5 }} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4 flex flex-col">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-primary">
            <lucide_react_1.Printer size={24}/>
          </div>
          <h3 className="text-lg font-bold text-on-surface">Printable Flyer</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Generate a branded PDF with a QR code linking to your shop.
          </p>
          <button onClick={function () { return __awaiter(void 0, void 0, void 0, function () {
            var jsPDF, QRCode, doc, pageWidth, pageHeight, shopUrl, qrDataUrl, qrSize, qrX, qrY, err_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!currentShop)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("jspdf"); })];
                    case 2:
                        jsPDF = (_a.sent()).jsPDF;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("qrcode"); })];
                    case 3:
                        QRCode = (_a.sent()).default;
                        doc = new jsPDF({
                            orientation: "portrait",
                            unit: "mm",
                            format: "a4",
                        });
                        pageWidth = doc.internal.pageSize.getWidth();
                        pageHeight = doc.internal.pageSize.getHeight();
                        // Background
                        doc.setFillColor(250, 249, 248);
                        doc.rect(0, 0, pageWidth, pageHeight, "F");
                        // Header / Brand
                        doc.setTextColor(255, 84, 0);
                        doc.setFontSize(40);
                        doc.setFont("helvetica", "bold");
                        doc.text("LocalEats", pageWidth / 2, 40, { align: "center" });
                        // Shop Name
                        doc.setTextColor(26, 28, 30);
                        doc.setFontSize(28);
                        doc.text("Order from ".concat(currentShop.name), pageWidth / 2, 65, {
                            align: "center",
                        });
                        // Subtitle
                        doc.setFontSize(16);
                        doc.setTextColor(83, 67, 63);
                        doc.text("Scan the code below to view our menu", pageWidth / 2, 80, { align: "center" });
                        doc.text("and follow us on the LocalEats app!", pageWidth / 2, 88, { align: "center" });
                        shopUrl = "https://www.localeatssa.co.za/?shopId=".concat(currentShop.id);
                        return [4 /*yield*/, QRCode.toDataURL(shopUrl, {
                                width: 400,
                                margin: 2,
                                color: {
                                    dark: "#1A1C1E",
                                    light: "#FFFFFF",
                                },
                            })];
                    case 4:
                        qrDataUrl = _a.sent();
                        qrSize = 80;
                        qrX = (pageWidth - qrSize) / 2;
                        qrY = 110;
                        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
                        // Call to action below QR
                        doc.setFontSize(20);
                        doc.setTextColor(255, 84, 0);
                        doc.setFont("helvetica", "bold");
                        doc.text("Skip the queue. Order ahead.", pageWidth / 2, 210, {
                            align: "center",
                        });
                        // Footer
                        doc.setFontSize(12);
                        doc.setTextColor(133, 115, 110);
                        doc.setFont("helvetica", "normal");
                        doc.text("Powered by LocalEats South Africa", pageWidth / 2, 280, { align: "center" });
                        doc.save("LocalEats_Promo_".concat(currentShop.name.replace(/\s+/g, "_"), ".pdf"));
                        sonner_1.toast.success("Flyer generated successfully!");
                        return [3 /*break*/, 6];
                    case 5:
                        err_12 = _a.sent();
                        console.error(err_12);
                        sonner_1.toast.error("Failed to generate flyer.");
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        }); }} className="w-full py-2 mt-auto bg-primary text-on-primary font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors">
            Generate PDF
          </button>
        </react_2.motion.div>
      </div>

      <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <h3 className="text-xl font-bold text-primary flex items-center justify-center md:justify-start gap-2">
              <lucide_react_1.Sparkles size={24}/>
              AI Marketing Assistant
            </h3>
            <p className="text-on-surface-variant">
              Let our AI help you create the perfect marketing campaign based on
              your shop's performance data and customer trends.
            </p>
            <button onClick={handleGenerateCampaign} disabled={isGenerating} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 mx-auto md:mx-0">
              {isGenerating ? (<>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"/>
                  Analyzing Data...
                </>) : (<>
                  <lucide_react_1.Zap size={20}/>
                  Generate Campaign
                </>)}
            </button>
          </div>
          <div className="w-full md:w-64 h-48 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
            <lucide_react_1.Zap size={64} className="text-primary/20 group-hover:scale-110 transition-transform duration-500"/>
          </div>
        </div>
      </div>

      {/* Campaign Builder Modal (Simplified) */}
      {showCampaignModal && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm">
          <react_2.motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-headline font-bold text-on-surface">
                  Create {campaignType.toUpperCase()} Campaign
                </h3>
                <button onClick={function () { return setShowCampaignModal(false); }} className="p-2 hover:bg-surface-container rounded-full transition-colors">
                  <lucide_react_1.X size={24}/>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface ml-1">
                    Campaign Name
                  </label>
                  <input type="text" placeholder="e.g., Weekend Flash Sale" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20"/>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface ml-1">
                    Target Audience
                  </label>
                  <select className="w-full px-4 py-3 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20">
                    <option>All Customers</option>
                    <option>New Customers (Last 30 days)</option>
                    <option>Inactive Customers (&gt; 60 days)</option>
                    <option>High Spenders</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface ml-1">
                    Campaign Message
                  </label>
                  <textarea rows={4} placeholder="Write your message here..." className="w-full px-4 py-3 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20 resize-none"/>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={function () { return setShowCampaignModal(false); }} className="flex-1 py-4 bg-surface-container text-on-surface font-bold rounded-2xl hover:bg-surface-container-high transition-all">
                  Save Draft
                </button>
                <button onClick={function () {
                sonner_1.toast.success("Campaign scheduled successfully!");
                setShowCampaignModal(false);
            }} className="flex-1 py-4 bg-primary text-on-primary font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all">
                  Launch Campaign
                </button>
              </div>
            </div>
          </react_2.motion.div>
        </div>)}

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
          <lucide_react_1.Sparkles size={24} className="text-primary"/>
          Expert Marketing Strategies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
                title: "Create Urgency with Expiry Dates",
                strategy: "Set short-term expiry dates (24-48 hours) for flash sales. This triggers FOMO (Fear Of Missing Out) and drives immediate action.",
            },
            {
                title: "Target First-Time Customers",
                strategy: 'Offer a "WELCOME10" code for 10% off their first order. This lowers the barrier to entry and builds initial trust.',
            },
            {
                title: "Reward Loyalty",
                strategy: "Send exclusive codes to customers who haven't ordered in 30 days. Personalization increases redemption rates by up to 40%.",
            },
            {
                title: "Social Media Exclusives",
                strategy: "Create unique codes for Instagram vs Facebook (e.g., INSTA5, FB5) to track which platform brings in more high-value customers.",
            },
        ].map(function (item, i) { return (<div key={i} className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/5">
              <h4 className="font-bold text-on-surface mb-2">{item.title}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {item.strategy}
              </p>
            </div>); })}
        </div>
      </div>
    </div>);
};
var Coupons = function (_a) {
    var currentShop = _a.currentShop, orders = _a.orders;
    var _b = (0, react_1.useState)([]), coupons = _b[0], setCoupons = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(false), showCreateModal = _d[0], setShowCreateModal = _d[1];
    var _e = (0, react_1.useState)({
        code: "",
        discount_type: "percentage",
        discount_value: "",
        min_order_value: "",
        expiry_date: "",
    }), newCoupon = _e[0], setNewCoupon = _e[1];
    (0, react_1.useEffect)(function () {
        var fetchCoupons = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, error, err_13;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, supabase
                                .from("coupons")
                                .select("*")
                                .eq("shop_id", currentShop.id)
                                .order("created_at", { ascending: false })];
                    case 2:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (!error && data)
                            setCoupons(data);
                        return [3 /*break*/, 5];
                    case 3:
                        err_13 = _b.sent();
                        console.error("Error fetching coupons:", err_13);
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchCoupons();
    }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id]);
    var handleCreateCoupon = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var error, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase.from("coupons").insert([
                            {
                                shop_id: currentShop.id,
                                code: newCoupon.code.toUpperCase(),
                                discount_type: newCoupon.discount_type,
                                discount_value: parseFloat(newCoupon.discount_value),
                                min_order_value: parseFloat(newCoupon.min_order_value) || 0,
                                expiry_date: newCoupon.expiry_date || null,
                                is_active: true,
                            },
                        ])];
                case 1:
                    error = (_a.sent()).error;
                    if (!error) return [3 /*break*/, 2];
                    sonner_1.toast.error("Failed to create coupon");
                    return [3 /*break*/, 4];
                case 2:
                    sonner_1.toast.success("Coupon created successfully!");
                    setShowCreateModal(false);
                    setNewCoupon({
                        code: "",
                        discount_type: "percentage",
                        discount_value: "",
                        min_order_value: "",
                        expiry_date: "",
                    });
                    return [4 /*yield*/, supabase
                            .from("coupons")
                            .select("*")
                            .eq("shop_id", currentShop.id)
                            .order("created_at", { ascending: false })];
                case 3:
                    data = (_a.sent()).data;
                    if (data)
                        setCoupons(data);
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var toggleCoupon = function (id, isActive) { return __awaiter(void 0, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase
                        .from("coupons")
                        .update({ is_active: !isActive })
                        .eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (!error) {
                        setCoupons(function (prev) {
                            return prev.map(function (c) { return (c.id === id ? __assign(__assign({}, c), { is_active: !isActive }) : c); });
                        });
                        sonner_1.toast.success("Coupon ".concat(!isActive ? "activated" : "deactivated"));
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var getPerformance = function (code) {
        var redemptions = orders.filter(function (o) { return o.coupon_code === code; });
        var totalDiscount = redemptions.reduce(function (acc, curr) { return acc + (curr.discount_amount || 0); }, 0);
        var totalSales = redemptions.reduce(function (acc, curr) { return acc + Number(curr.total_price); }, 0);
        return {
            count: redemptions.length,
            discount: totalDiscount,
            sales: totalSales,
        };
    };
    return (<div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Coupons
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Manage discount codes and track performance.
          </p>
        </div>
        <button onClick={function () { return setShowCreateModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all w-full sm:w-auto justify-center">
          <lucide_react_1.Plus size={20}/>
          Create Coupon
        </button>
      </header>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
            {
                label: "Total Redemptions",
                value: orders.filter(function (o) { return o.coupon_code; }).length,
                icon: lucide_react_1.Ticket,
                color: "text-blue-500",
            },
            {
                label: "Total Discounts Given",
                value: "R".concat(Number(orders.reduce(function (acc, curr) { return acc + (curr.discount_amount || 0); }, 0)).toFixed(2)),
                icon: lucide_react_1.Zap,
                color: "text-orange-500",
            },
            {
                label: "Coupon-Driven Sales",
                value: "R".concat(Number(orders.filter(function (o) { return o.coupon_code; }).reduce(function (acc, curr) { return acc + Number(curr.total_price); }, 0)).toFixed(2)),
                icon: lucide_react_1.TrendingUp,
                color: "text-green-500",
            },
        ].map(function (stat, i) { return (<div key={i} className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/10 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center", stat.color)}>
              <stat.icon size={24}/>
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-xl font-black text-on-surface">{stat.value}</p>
            </div>
          </div>); })}
      </div>

      {loading ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(function (i) { return (<div key={i} className="h-32 bg-surface-container animate-pulse rounded-3xl"/>); })}
        </div>) : coupons.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coupons.map(function (coupon) {
                var perf = getPerformance(coupon.code);
                var isExpired = coupon.expiry_date && new Date(coupon.expiry_date) < new Date();
                return (<div key={coupon.id} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black font-mono text-primary tracking-wider">
                        {coupon.code}
                      </span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest", coupon.is_active && !isExpired
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700")}>
                        {isExpired
                        ? "Expired"
                        : coupon.is_active
                            ? "Active"
                            : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant font-medium">
                      {coupon.discount_type === "percentage"
                        ? "".concat(coupon.discount_value, "% OFF")
                        : "R".concat(coupon.discount_value, " OFF")}
                    </p>
                    {coupon.expiry_date && (<p className={cn("text-[10px] font-bold flex items-center gap-1", isExpired
                            ? "text-red-500"
                            : "text-on-surface-variant/60")}>
                        <lucide_react_1.Calendar size={12}/>
                        Expires:{" "}
                        {(0, date_fns_1.format)(new Date(coupon.expiry_date), "MMM dd, yyyy")}
                      </p>)}
                  </div>
                  <button onClick={function () { return toggleCoupon(coupon.id, coupon.is_active); }} disabled={isExpired} className={cn("p-3 rounded-2xl transition-colors", isExpired
                        ? "bg-surface-container text-on-surface-variant/20 cursor-not-allowed"
                        : coupon.is_active
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100")}>
                    {coupon.is_active ? <lucide_react_1.X size={20}/> : <lucide_react_1.Check size={20}/>}
                  </button>
                </div>

                <div className="pt-4 border-t border-outline-variant/5 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase">
                      Used
                    </p>
                    <p className="text-sm font-black text-on-surface">
                      {perf.count}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase">
                      Saved
                    </p>
                    <p className="text-sm font-black text-on-surface">
                      R{Number(perf.discount || 0).toFixed(0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase">
                      Sales
                    </p>
                    <p className="text-sm font-black text-on-surface">
                      R{Number(perf.sales || 0).toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>);
            })}
        </div>) : (<div className="bg-surface-container-low/30 rounded-3xl p-12 text-center border-2 border-dashed border-outline-variant/10">
          <lucide_react_1.Ticket size={48} className="mx-auto text-on-surface-variant/20 mb-4"/>
          <h3 className="text-lg font-bold text-on-surface">No Coupons Yet</h3>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto mt-2">
            Create your first discount code to attract more customers to your
            shop.
          </p>
          <button onClick={function () { return setShowCreateModal(true); }} className="mt-6 px-6 py-2 bg-surface-container text-on-surface font-bold rounded-xl text-xs hover:bg-surface-container-high transition-colors">
            Create First Coupon
          </button>
        </div>)}

      {/* Create Coupon Modal */}
      <react_2.AnimatePresence>
        {showCreateModal && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <react_2.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={function () { return setShowCreateModal(false); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
            <react_2.motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/10">
              <form onSubmit={handleCreateCoupon} className="p-8 space-y-6">
                <header className="flex justify-between items-center">
                  <h3 className="text-2xl font-headline font-black text-on-surface tracking-tight">
                    New Coupon
                  </h3>
                  <button type="button" onClick={function () { return setShowCreateModal(false); }} className="p-2 hover:bg-surface-container rounded-full transition-colors">
                    <lucide_react_1.X size={20}/>
                  </button>
                </header>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest ml-1">
                      Coupon Code
                    </label>
                    <input required type="text" placeholder="e.g. WELCOME10" value={newCoupon.code} onChange={function (e) {
                return setNewCoupon(__assign(__assign({}, newCoupon), { code: e.target.value.toUpperCase() }));
            }} className="w-full px-5 py-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 focus:ring-4 focus:ring-primary/5 outline-none transition-all font-mono font-bold uppercase"/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest ml-1">
                        Type
                      </label>
                      <select value={newCoupon.discount_type} onChange={function (e) {
                return setNewCoupon(__assign(__assign({}, newCoupon), { discount_type: e.target.value }));
            }} className="w-full px-5 py-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 outline-none transition-all font-bold appearance-none">
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (R)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest ml-1">
                        Value
                      </label>
                      <input required type="number" placeholder={newCoupon.discount_type === "percentage" ? "10" : "50"} value={newCoupon.discount_value} onChange={function (e) {
                return setNewCoupon(__assign(__assign({}, newCoupon), { discount_value: e.target.value }));
            }} className="w-full px-5 py-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 outline-none transition-all font-bold"/>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest ml-1">
                      Min Order Value (R)
                    </label>
                    <input type="number" placeholder="0.00" value={newCoupon.min_order_value} onChange={function (e) {
                return setNewCoupon(__assign(__assign({}, newCoupon), { min_order_value: e.target.value }));
            }} className="w-full px-5 py-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 outline-none transition-all font-bold"/>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest ml-1">
                      Expiry Date (Optional)
                    </label>
                    <input type="date" value={newCoupon.expiry_date} onChange={function (e) {
                return setNewCoupon(__assign(__assign({}, newCoupon), { expiry_date: e.target.value }));
            }} className="w-full px-5 py-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 outline-none transition-all font-bold"/>
                  </div>
                </div>

                <button type="submit" className="w-full py-4 bg-primary text-on-primary font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-[0.99] active:scale-95 transition-all">
                  Create Coupon
                </button>
              </form>
            </react_2.motion.div>
          </div>)}
      </react_2.AnimatePresence>
    </div>);
};
var Insights = function (_a) {
    var orders = _a.orders, menuItems = _a.menuItems, loading = _a.loading, currentShop = _a.currentShop;
    var _b = (0, react_1.useState)([]), reviews = _b[0], setReviews = _b[1];
    var _c = (0, react_1.useState)("--"), followerCount = _c[0], setFollowerCount = _c[1];
    var _d = (0, react_1.useState)([]), followerTrendData = _d[0], setFollowerTrendData = _d[1];
    (0, react_1.useEffect)(function () {
        var fetchReviews = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
                            return [2 /*return*/];
                        return [4 /*yield*/, supabase
                                .from("reviews")
                                .select("*")
                                .eq("shop_id", currentShop.id)
                                .order("created_at", { ascending: false })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (!error && data)
                            setReviews(data);
                        return [2 /*return*/];
                }
            });
        }); };
        fetchReviews();
    }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id]);
    var handleResponse = function (reviewId, response) { return __awaiter(void 0, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase
                        .from("reviews")
                        .update({ response: response })
                        .eq("id", reviewId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        sonner_1.toast.error("Failed to save response");
                    }
                    else {
                        sonner_1.toast.success("Response saved!");
                        setReviews(function (prev) {
                            return prev.map(function (r) { return (r.id === reviewId ? __assign(__assign({}, r), { response: response }) : r); });
                        });
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var fetchFollowerInsights = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, count, error, last7Days_1, _b, trendData, trendError, err_14;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, supabase
                            .from("shop_followers")
                            .select("*", { count: "exact", head: true })
                            .eq("shop_id", currentShop.id)];
                case 2:
                    _a = _c.sent(), count = _a.count, error = _a.error;
                    if (error)
                        throw error;
                    setFollowerCount(count || 0);
                    last7Days_1 = Array.from({ length: 7 }, function (_, index) {
                        var d = new Date();
                        d.setDate(d.getDate() - index);
                        return {
                            date: d.toISOString().split("T")[0],
                            dayName: (0, date_fns_1.format)(d, "EEE"),
                            count: 0,
                        };
                    }).reverse();
                    return [4 /*yield*/, supabase
                            .from("shop_followers")
                            .select("created_at")
                            .eq("shop_id", currentShop.id)
                            .gt("created_at", last7Days_1[0].date)];
                case 3:
                    _b = _c.sent(), trendData = _b.data, trendError = _b.error;
                    if (!trendError && trendData) {
                        trendData.forEach(function (f) {
                            var date = new Date(f.created_at).toISOString().split("T")[0];
                            var day = last7Days_1.find(function (d) { return d.date === date; });
                            if (day)
                                day.count++;
                        });
                        setFollowerTrendData(last7Days_1.map(function (d) { return ({ name: d.dayName, value: d.count }); }));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_14 = _c.sent();
                    console.error("Error fetching follower insights:", err_14);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id]);
    (0, react_1.useEffect)(function () {
        fetchFollowerInsights();
        // Real-time subscription for followers in Insights
        if (!(currentShop === null || currentShop === void 0 ? void 0 : currentShop.id))
            return;
        var channel = supabase
            .channel("insights_followers_".concat(currentShop.id))
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "shop_followers",
            filter: "shop_id=eq.".concat(currentShop.id),
        }, function () {
            fetchFollowerInsights();
        })
            .subscribe();
        return function () {
            supabase.removeChannel(channel);
        };
    }, [currentShop === null || currentShop === void 0 ? void 0 : currentShop.id, fetchFollowerInsights]);
    var _e = (0, react_1.useState)(null), selectedItemForTrend = _e[0], setSelectedItemForTrend = _e[1];
    var peakHoursData = (0, react_1.useMemo)(function () {
        var hours = Array.from({ length: 24 }, function (_, i) { return ({ hour: i, count: 0 }); });
        orders.forEach(function (order) {
            var date = new Date(order.created_at);
            if (!isNaN(date.getTime())) {
                var hour = date.getHours();
                hours[hour].count++;
            }
        });
        var peaks = [
            { time: "12:00 PM", hour: 12, label: "Lunch Rush" },
            { time: "03:00 PM", hour: 15, label: "Afternoon Slump" },
            { time: "07:00 PM", hour: 19, label: "Dinner Peak" },
            { time: "09:00 PM", hour: 21, label: "Late Night" },
        ];
        var maxCount = Math.max.apply(Math, __spreadArray(__spreadArray([], hours.map(function (h) { return h.count; }), false), [1], false));
        return peaks.map(function (p) { return (__assign(__assign({}, p), { val: (hours[p.hour].count / maxCount) * 100, color: hours[p.hour].count > maxCount * 0.7
                ? "bg-primary"
                : "bg-on-surface-variant/20" })); });
    }, [orders]);
    var itemTrendData = (0, react_1.useMemo)(function () {
        if (!selectedItemForTrend)
            return [];
        var last7Days = Array.from({ length: 7 }, function (_, index) {
            var d = new Date();
            d.setDate(d.getDate() - index);
            return {
                date: d.toISOString().split("T")[0],
                dayName: (0, date_fns_1.format)(d, "EEE"),
                revenue: 0,
            };
        }).reverse();
        orders
            .filter(function (o) { return o.product_name === selectedItemForTrend; })
            .forEach(function (order) {
            var orderDate = new Date(order.created_at)
                .toISOString()
                .split("T")[0];
            var day = last7Days.find(function (d) { return d.date === orderDate; });
            if (day)
                day.revenue += Number(order.total_price);
        });
        return last7Days.map(function (d) { return ({ name: d.dayName, value: d.revenue }); });
    }, [orders, selectedItemForTrend]);
    // Calculate top sellers from orders
    var productCounts = orders.reduce(function (acc, order) {
        acc[order.product_name] = (acc[order.product_name] || 0) + 1;
        return acc;
    }, {});
    var exportToCSV = function () {
        if (orders.length === 0) {
            sonner_1.toast.error("No orders to export");
            return;
        }
        var headers = ["Order ID", "Product", "Price", "Status", "Date"];
        var csvContent = __spreadArray([
            headers.join(",")
        ], orders.map(function (o) {
            return [
                o.id,
                "\"".concat(o.product_name, "\""),
                o.total_price,
                o.status,
                new Date(o.created_at).toLocaleDateString(),
            ].join(",");
        }), true).join("\n");
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        var link = document.createElement("a");
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "localeats_report_".concat(new Date().toISOString().split("T")[0], ".csv"));
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        sonner_1.toast.success("Report exported successfully!");
    };
    var topSellers = (0, react_1.useMemo)(function () {
        return Object.entries(productCounts)
            .map(function (_a) {
            var name = _a[0], count = _a[1];
            var menuItem = menuItems.find(function (mi) { return mi.name === name; });
            return {
                name: name,
                count: count,
                image_url: menuItem === null || menuItem === void 0 ? void 0 : menuItem.image_url,
                id: menuItem === null || menuItem === void 0 ? void 0 : menuItem.id,
            };
        })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, 4);
    }, [productCounts, menuItems]);
    // Detailed Menu Analytics
    var menuAnalytics = (0, react_1.useMemo)(function () {
        return menuItems
            .map(function (item) {
            var itemOrders = orders.filter(function (o) { return o.product_name === item.name; });
            var totalRevenue = itemOrders.reduce(function (sum, o) { return sum + Number(o.total_price); }, 0);
            var salesCount = itemOrders.length;
            // Calculate sales trend (last 7 days vs previous 7 days)
            var now = new Date();
            var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            var fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            var recentSales = itemOrders.filter(function (o) { return new Date(o.created_at) >= sevenDaysAgo; }).length;
            var previousSales = itemOrders.filter(function (o) {
                var date = new Date(o.created_at);
                return date >= fourteenDaysAgo && date < sevenDaysAgo;
            }).length;
            var trend = previousSales === 0
                ? recentSales > 0
                    ? 100
                    : 0
                : ((recentSales - previousSales) / previousSales) * 100;
            return __assign(__assign({}, item), { totalRevenue: totalRevenue, salesCount: salesCount, trend: trend });
        })
            .sort(function (a, b) { return b.totalRevenue - a.totalRevenue; });
    }, [orders, menuItems]);
    var categoryRevenue = orders.reduce(function (acc, order) {
        var item = menuItems.find(function (i) { return i.name === order.product_name; });
        var category = (item === null || item === void 0 ? void 0 : item.category) || "Other";
        acc[category] = (acc[category] || 0) + Number(order.total_price);
        return acc;
    }, {});
    var dailyEarningsData = (0, react_1.useMemo)(function () {
        var last7Days = Array.from({ length: 7 }, function (_, index) {
            var d = new Date();
            d.setDate(d.getDate() - index);
            return {
                date: d.toISOString().split("T")[0],
                dayName: (0, date_fns_1.format)(d, "EEE"),
                earnings: 0,
            };
        }).reverse();
        orders
            .filter(function (o) {
            return o.status === "completed" ||
                o.status === "preparing" ||
                o.status === "ready";
        })
            .forEach(function (order) {
            var orderDate = new Date(order.created_at)
                .toISOString()
                .split("T")[0];
            var day = last7Days.find(function (d) { return d.date === orderDate; });
            if (day)
                day.earnings += Number(order.total_price);
        });
        return last7Days.map(function (d) { return ({ name: d.dayName, earnings: d.earnings }); });
    }, [orders]);
    var couponPerformance = (0, react_1.useMemo)(function () {
        var couponOrders = orders.filter(function (o) { return o.coupon_code; });
        var totalDiscount = couponOrders.reduce(function (acc, curr) { return acc + (curr.discount_amount || 0); }, 0);
        var totalSales = couponOrders.reduce(function (acc, curr) { return acc + Number(curr.total_price); }, 0);
        var byCode = couponOrders.reduce(function (acc, order) {
            var code = order.coupon_code;
            if (!acc[code])
                acc[code] = { count: 0, discount: 0, sales: 0 };
            acc[code].count++;
            acc[code].discount += order.discount_amount || 0;
            acc[code].sales += Number(order.total_price);
            return acc;
        }, {});
        return {
            totalRedemptions: couponOrders.length,
            totalDiscount: totalDiscount,
            totalSales: totalSales,
            byCode: Object.entries(byCode)
                .map(function (_a) {
                var code = _a[0], stats = _a[1];
                return (__assign({ code: code }, stats));
            })
                .sort(function (a, b) { return b.sales - a.sales; }),
        };
    }, [orders]);
    var pieData = Object.entries(categoryRevenue).map(function (_a) {
        var name = _a[0], value = _a[1];
        return ({
            name: name,
            value: value,
        });
    });
    var COLORS = [
        "#FF6321",
        "#FF9F43",
        "#FFC107",
        "#4CAF50",
        "#2196F3",
        "#9C27B0",
    ];
    if (loading) {
        return (<div className="space-y-12">
        <section>
          <Skeleton className="h-12 w-64 mb-2"/>
          <Skeleton className="h-4 w-48"/>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Skeleton className="md:col-span-8 h-80 rounded-xl"/>
          <Skeleton className="md:col-span-4 h-80 rounded-xl"/>
          <Skeleton className="md:col-span-5 h-64 rounded-xl"/>
          <Skeleton className="md:col-span-7 h-64 rounded-xl"/>
        </div>
      </div>);
    }
    return (<div className="space-y-12">
      <react_2.motion.section initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">
          Business Insights
        </h1>
        <p className="text-on-surface-variant font-body">
          Data-driven performance overview for LocalEats.
        </p>
      </react_2.motion.section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <react_2.motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="md:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_-4px_rgba(167,52,0,0.05)] border border-outline-variant/10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">
                Daily Earnings (Last 7 Days)
              </h2>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-on-surface font-headline">
                  R{" "}
                  {dailyEarningsData
            .reduce(function (acc, d) { return acc + d.earnings; }, 0)
            .toLocaleString()}
                </span>
                <span className="flex items-center text-sm font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <lucide_react_1.TrendingUp size={14} className="mr-1"/>
                  Real-time
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                <lucide_react_1.Download size={14}/>
                Export CSV
              </button>
              <button onClick={function () { return sonner_1.toast.info("Historical data coming soon"); }} className="px-4 py-2 text-xs font-bold rounded-full bg-primary text-on-primary">
                Snapshot
              </button>
            </div>
          </div>
          <div className="h-64 mt-4">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.BarChart data={dailyEarningsData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f58220" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#ff9d4d" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <recharts_1.XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
            fill: "var(--on-surface-variant)",
            fontSize: 10,
            fontWeight: 700,
        }} dy={10}/>
                <recharts_1.YAxis hide/>
                <recharts_1.Tooltip cursor={{ fill: "var(--primary)", opacity: 0.05 }} contentStyle={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
            padding: "12px",
        }} itemStyle={{
            color: "#f58220",
            fontWeight: 800,
            fontSize: "14px",
        }} labelStyle={{
            color: "#64748b",
            fontWeight: 700,
            fontSize: "10px",
            marginBottom: "4px",
            textTransform: "uppercase",
        }} formatter={function (value) { return [
            "R".concat(value.toLocaleString()),
            "Earnings",
        ]; }}/>
                <recharts_1.Bar dataKey="earnings" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={32} animationBegin={200}/>
              </recharts_1.BarChart>
            </recharts_1.ResponsiveContainer>
          </div>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="md:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_-4px_rgba(167,52,0,0.05)] border border-outline-variant/10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-on-surface-variant/60 mb-6">
            Revenue by Category
          </h2>
          <div className="h-64">
            <recharts_1.ResponsiveContainer width="99%" height="100%" minHeight={256} minWidth={1}>
              <recharts_1.PieChart>
                <recharts_1.Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map(function (entry, index) { return (<recharts_1.Cell key={"cell-".concat(index)} fill={COLORS[index % COLORS.length]}/>); })}
                </recharts_1.Pie>
                <recharts_1.Tooltip contentStyle={{
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }} itemStyle={{
            color: "var(--on-surface)",
            fontSize: "12px",
            fontWeight: "bold",
        }}/>
                <recharts_1.Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{
            fontSize: "10px",
            fontWeight: "bold",
            textTransform: "uppercase",
        }}/>
              </recharts_1.PieChart>
            </recharts_1.ResponsiveContainer>
          </div>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="md:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_-4px_rgba(167,52,0,0.05)] border border-outline-variant/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-on-surface-variant/60">
              Coupon Impact
            </h2>
            <lucide_react_1.Ticket size={20} className="text-primary"/>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Total Discount
                </p>
                <p className="text-lg font-black text-on-surface">
                  R{Number(couponPerformance.totalDiscount || 0).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-surface-container-low rounded-2xl">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Coupon Sales
                </p>
                <p className="text-lg font-black text-on-surface">
                  R{Number(couponPerformance.totalSales || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest">
                Top Codes
              </h3>
              {couponPerformance.byCode.length > 0 ? (<div className="space-y-3">
                  {couponPerformance.byCode.slice(0, 3).map(function (coupon, i) { return (<div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {i + 1}
                        </div>
                        <span className="font-mono font-bold text-on-surface text-sm">
                          {coupon.code}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-on-surface">
                          R{Number(coupon.sales || 0).toFixed(0)}
                        </p>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                          {coupon.count} uses
                        </p>
                      </div>
                    </div>); })}
                </div>) : (<div className="py-10 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30">
                  <lucide_react_1.Ticket className="mx-auto text-on-surface-variant/20 mb-2" size={24}/>
                  <p className="text-xs text-on-surface-variant">
                    No coupon data
                  </p>
                </div>)}
            </div>
          </div>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="md:col-span-8 bg-surface-container-low rounded-xl p-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <lucide_react_1.Clock size={20} className="text-primary"/>
            Peak Order Hours
          </h2>
          <div className="space-y-6">
            {orders.length > 0 ? (peakHoursData.map(function (p, i) { return (<div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-on-surface">{p.time}</span>
                    <span className="text-on-surface-variant uppercase tracking-widest">
                      {p.label}
                    </span>
                  </div>
                  <div className="w-full h-4 bg-surface-container rounded-full overflow-hidden">
                    <react_2.motion.div initial={{ width: 0 }} animate={{ width: "".concat(p.val, "%") }} transition={{ duration: 1, delay: 0.5 + i * 0.1 }} className={cn("h-full rounded-full", p.color)}/>
                  </div>
                </div>); })) : (<p className="text-on-surface-variant text-sm italic py-8 text-center">
                No peak data yet.
              </p>)}
          </div>
          <p className="mt-8 text-xs text-on-surface-variant italic leading-snug">
            * Busiest periods detected between 12pm - 1pm and 7pm - 8:30pm.
          </p>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="md:col-span-7 bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Top Sellers</h2>
            <button onClick={function () { return sonner_1.toast.info("Detailed sales report coming soon"); }} className="text-primary text-xs font-bold underline cursor-pointer bg-transparent border-none">
              View All
            </button>
          </div>
          <div className="space-y-5">
            {topSellers.length > 0 ? (topSellers.map(function (item, i) { return (<react_2.motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }} key={i} className="flex items-center justify-between group cursor-pointer p-2 -m-2 rounded-xl hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container flex items-center justify-center">
                      {!isPlaceholderImage(item.image_url) ? (<img className="w-full h-full object-cover group-hover:scale-110 transition-transform" src={item.image_url} alt={item.name}/>) : (<FoodPlaceholder size={24}/>)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-on-surface">
                        {item.name}
                      </h4>
                      <p className="text-xs text-on-surface-variant">
                        Popular Choice
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-on-surface">
                      {item.count}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-on-surface-variant/60">
                      Orders Total
                    </div>
                  </div>
                </react_2.motion.div>); })) : (<p className="text-on-surface-variant text-sm italic">
                No sales data yet.
              </p>)}
          </div>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="md:col-span-5 bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Item Popularity</h2>
            <select className="text-xs font-bold bg-surface-container-low border-none rounded-lg px-2 py-1 outline-none" value={selectedItemForTrend || ""} onChange={function (e) { return setSelectedItemForTrend(e.target.value || null); }}>
              <option value="">Select Item</option>
              {menuItems.map(function (item) { return (<option key={item.id} value={item.name}>
                  {item.name}
                </option>); })}
            </select>
          </div>

          {selectedItemForTrend ? (<div className="h-48 w-full">
              <recharts_1.ResponsiveContainer width="99%" height="100%" minHeight={192} minWidth={1}>
                <recharts_1.AreaChart data={itemTrendData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <recharts_1.Tooltip contentStyle={{
                backgroundColor: "var(--surface-container-lowest)",
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }} itemStyle={{
                color: "var(--primary)",
                fontSize: "12px",
                fontWeight: "bold",
            }}/>
                  <recharts_1.Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)"/>
                  <recharts_1.XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
                fontSize: 10,
                fontWeight: 700,
                fill: "var(--on-surface-variant)",
            }}/>
                  <recharts_1.YAxis hide/>
                </recharts_1.AreaChart>
              </recharts_1.ResponsiveContainer>
              <p className="text-[10px] text-center text-on-surface-variant/60 font-bold uppercase tracking-widest mt-4">
                7-Day Revenue Trend for {selectedItemForTrend}
              </p>
            </div>) : (<div className="h-48 flex flex-col items-center justify-center text-center space-y-3 bg-surface-container-low/30 rounded-2xl border-2 border-dashed border-outline-variant/10">
              <lucide_react_1.BarChart3 className="text-on-surface-variant/20" size={40}/>
              <p className="text-xs text-on-surface-variant font-medium">
                Select a menu item to view its
                <br />
                popularity trend over time.
              </p>
            </div>)}
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="md:col-span-12 bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <lucide_react_1.Users size={20} className="text-blue-600"/>
                Follower Growth
              </h2>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                Total Followers:{" "}
                <span className="text-blue-600 font-semibold">
                  {followerCount}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest">
                Last 7 Days
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <recharts_1.ResponsiveContainer width="99%" height="100%" minHeight={256} minWidth={1}>
              <recharts_1.AreaChart data={followerTrendData}>
                <defs>
                  <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <recharts_1.XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
            fontSize: 10,
            fontWeight: 700,
            fill: "var(--on-surface-variant)",
        }}/>
                <recharts_1.YAxis axisLine={false} tickLine={false} tick={{
            fontSize: 10,
            fontWeight: 700,
            fill: "var(--on-surface-variant)",
        }}/>
                <recharts_1.Tooltip contentStyle={{
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }} itemStyle={{
            color: "#2563eb",
            fontSize: "12px",
            fontWeight: "bold",
        }}/>
                <recharts_1.Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorFollowers)" animationDuration={1500}/>
              </recharts_1.AreaChart>
            </recharts_1.ResponsiveContainer>
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">
                Total Followers
              </p>
              <p className="text-2xl font-black text-blue-900">
                {followerCount}
              </p>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                New this Week
              </p>
              <p className="text-2xl font-black text-emerald-900">
                +{followerTrendData.reduce(function (acc, d) { return acc + d.value; }, 0)}
              </p>
            </div>
            <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">
                Engagement Rate
              </p>
              <p className="text-2xl font-black text-orange-900">
                {orders.length > 0
            ? "".concat(Number((reviews.length / orders.length) * 100).toFixed(1), "%")
            : "0%"}
              </p>
            </div>
          </div>
        </react_2.motion.section>

        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="md:col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-headline font-extrabold text-on-surface">
                Menu Item Performance
              </h2>
              <p className="text-sm text-on-surface-variant">
                Detailed analytics for your offerings
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10">
                <lucide_react_1.BarChart3 size={16} className="text-primary"/>
                <span className="text-xs font-bold">
                  {menuItems.length} Total Items
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full min-w-[600px] text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Item
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Category
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Orders
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Revenue
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Trend (7d)
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {menuAnalytics.length > 0 ? (menuAnalytics.map(function (item) { return (<tr key={item.id} className="border-b border-outline-variant/5 hover:bg-surface-container-low/50 transition-colors group">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex items-center justify-center">
                            {!isPlaceholderImage(item.image_url) ? (<img src={item.image_url} alt={item.name} className="w-full h-full object-cover"/>) : (<FoodPlaceholder size={16}/>)}
                          </div>
                          <span className="font-bold text-sm text-on-surface">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-sm">
                        {item.salesCount}
                      </td>
                      <td className="py-4 px-4 font-bold text-sm text-primary">
                        R {item.totalRevenue.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className={cn("flex items-center gap-1 text-xs font-bold", item.trend > 0
                ? "text-primary"
                : item.trend < 0
                    ? "text-error"
                    : "text-on-surface-variant/40")}>
                          {item.trend > 0 ? (<lucide_react_1.ArrowUp size={12}/>) : item.trend < 0 ? (<lucide_react_1.ArrowDown size={12}/>) : null}
                          {Number(Math.abs(item.trend || 0)).toFixed(1)}%
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden min-w-[60px]">
                            <div className={cn("h-full rounded-full", (item.stock_quantity || 0) < 5
                ? "bg-error"
                : "bg-primary")} style={{
                width: "".concat(Math.min(100, ((item.stock_quantity || 0) / 50) * 100), "%"),
            }}/>
                          </div>
                          <span className={cn("text-[10px] font-bold", (item.stock_quantity || 0) < 5
                ? "text-error"
                : "text-on-surface-variant")}>
                            {item.stock_quantity || 0}
                          </span>
                        </div>
                      </td>
                    </tr>); })) : (<tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant italic text-sm">
                      No menu items found.
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </react_2.motion.section>

        {/* Customer Feedback Section */}
        <react_2.motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="md:col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              Customer Feedback
              <span className="bg-secondary-fixed text-on-secondary-fixed text-xs px-2.5 py-1 rounded-full">
                {reviews.length} Reviews
              </span>
            </h2>
            <div className="flex items-center gap-1 text-tertiary">
              <lucide_react_1.Star size={18} className="fill-current"/>
              <span className="font-bold">
                {reviews.length > 0
            ? Number(reviews.reduce(function (acc, r) { return acc + r.rating; }, 0) /
                reviews.length).toFixed(1)
            : "0.0"}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                ({reviews.length} total)
              </span>
            </div>
          </div>

          <ReviewsList reviews={reviews} onRespond={handleResponse}/>
        </react_2.motion.section>
      </div>
    </div>);
};
// --- Subscription Components ---
var RiderManagement = function (_a) {
    var _b;
    var currentShop = _a.currentShop, orders = _a.orders, onRequestRider = _a.onRequestRider, sendRiderNudge = _a.sendRiderNudge, user = _a.user;
    var _c = (0, react_1.useState)([]), connections = _c[0], setConnections = _c[1];
    var _d = (0, react_1.useState)(true), loading = _d[0], setLoading = _d[1];
    var _e = (0, react_1.useState)(null), selectedTrackId = _e[0], setSelectedTrackId = _e[1];
    var _f = (0, react_1.useState)(false), showCode = _f[0], setShowCode = _f[1];
    var _g = (0, react_1.useState)(null), activeCode = _g[0], setActiveCode = _g[1];
    var _h = (0, react_1.useState)(""), qrUrl = _h[0], setQrUrl = _h[1];
    var trackedRider = (0, react_1.useMemo)(function () {
        return connections.find(function (c) { return c.rider_id === selectedTrackId; });
    }, [connections, selectedTrackId]);
    (0, react_1.useEffect)(function () {
        if (activeCode) {
            Promise.resolve().then(function () { return require("qrcode"); }).then(function (QRCode) {
                QRCode.toDataURL(activeCode.code, {
                    margin: 0,
                    scale: 10,
                    color: { dark: "#000000", light: "#ffffff" },
                }).then(function (url) { return setQrUrl(url); });
            });
        }
        else {
            setQrUrl("");
        }
    }, [activeCode]);
    var activeMissions = orders.filter(function (o) {
        return o.delivery_status &&
            o.delivery_status !== "delivered" &&
            o.status !== "cancelled";
    });
    var fetchConnections = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error, processed;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setLoading(true);
                    return [4 /*yield*/, supabase
                            .from("rider_connections")
                            .select("\n        *,\n        rider_profiles:rider_id (\n          is_online,\n          full_name,\n          phone,\n          status,\n          vehicle_type,\n          rating,\n          total_deliveries,\n          total_earnings,\n          current_latitude,\n          current_longitude,\n          updated_at\n        )\n      ")
                            .eq("shop_id", currentShop.id)
                            .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (!error && data) {
                        processed = data.map(function (item) {
                            var conn = item;
                            var profile = item.rider_profiles;
                            return __assign(__assign({}, conn), { is_online: (profile === null || profile === void 0 ? void 0 : profile.is_online) || false, rider_name: (profile === null || profile === void 0 ? void 0 : profile.full_name) || conn.rider_name, rider_phone: (profile === null || profile === void 0 ? void 0 : profile.phone) || conn.rider_phone, status: (profile === null || profile === void 0 ? void 0 : profile.status) || (new Date(conn.expires_at) < new Date() ? "expired" : conn.status), vehicle_type: (profile === null || profile === void 0 ? void 0 : profile.vehicle_type) || "Road", rating: (profile === null || profile === void 0 ? void 0 : profile.rating) || 5.0, total_deliveries: (profile === null || profile === void 0 ? void 0 : profile.total_deliveries) || 0, total_earnings: (profile === null || profile === void 0 ? void 0 : profile.total_earnings) || 0, current_latitude: profile === null || profile === void 0 ? void 0 : profile.current_latitude, current_longitude: profile === null || profile === void 0 ? void 0 : profile.current_longitude, last_seen: profile === null || profile === void 0 ? void 0 : profile.updated_at });
                        });
                        setConnections(processed);
                    }
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); }, [currentShop.id]);
    var activeConnectionsCount = connections.filter(function (c) { return c.rider_id && new Date(c.expires_at) >= new Date(); }).length;
    var availableCodesCount = connections.filter(function (c) { return !c.rider_id && new Date(c.expires_at) >= new Date(); }).length;
    (0, react_1.useEffect)(function () {
        fetchConnections();
        // Subscribe to real-time changes
        var channel = supabase
            .channel("rider_connections_sync_".concat(currentShop.id))
            .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'rider_connections',
            filter: "shop_id=eq.".concat(currentShop.id)
        }, function () {
            fetchConnections();
        })
            .subscribe();
        return function () {
            void supabase.removeChannel(channel);
        };
    }, [fetchConnections, currentShop.id]);
    var generateCode = function () { return __awaiter(void 0, void 0, void 0, function () {
        var code, expiresAt, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    code = Math.random().toString(36).substring(2, 8).toUpperCase();
                    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                    return [4 /*yield*/, supabase.from("rider_connections").insert({
                            shop_id: currentShop.id,
                            connection_code: code,
                            expires_at: expiresAt,
                            status: "active",
                        })];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        sonner_1.toast.error("Failed to generate code: " + error.message);
                    }
                    else {
                        setActiveCode({ code: code, expires: expiresAt });
                        setShowCode(true);
                        void fetchConnections();
                        sonner_1.toast.success("Pairing code generated! Valid for 24 hours.");
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var deleteConnection = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase
                        .from("rider_connections")
                        .delete()
                        .eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (!error) {
                        sonner_1.toast.success("Connection removed");
                        void fetchConnections();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var broadcastTestOrder = function () { return __awaiter(void 0, void 0, void 0, function () {
        var testOrder, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/];
                    testOrder = {
                        shop_id: currentShop.id,
                        user_id: user.id,
                        customer_name: "Test Signal " + Math.floor(Math.random() * 1000),
                        phone: "000 000 0000",
                        address: "77 Sector Street, Alpha Hub",
                        city: "Tembisa",
                        product_name: "Debug Package",
                        restaurant_name: currentShop.name,
                        total_price: 25,
                        price: 25,
                        status: "accepted",
                        delivery_status: "finding_rider",
                        order_type: "delivery",
                        delivery_fee: FLAT_DELIVERY_FEE,
                        items: ["Debug Packet [ENC_V2]"],
                        created_at: new Date().toISOString(),
                    };
                    setLoading(true);
                    return [4 /*yield*/, supabase.from("orders").insert(testOrder)];
                case 1:
                    error = (_a.sent()).error;
                    setLoading(false);
                    if (error) {
                        sonner_1.toast.error("Signal fail: " + error.message);
                        if (error.message.includes("permission denied")) {
                            sonner_1.toast.warning("RLS Policy Blocking: Please ensure public insert is allowed for testing.");
                        }
                    }
                    else {
                        sonner_1.toast.success("Test mission broadcasted. Check Rider App!");
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    return (<div className="max-w-4xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
              Rider Fleet
            </h2>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">
              v1.1
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-medium">
            Manage your delivery partners and track active pairings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={broadcastTestOrder} className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 text-amber-600 rounded-2xl font-bold hover:bg-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <lucide_react_1.Zap size={20}/>
            Auto-Broadcast Mission
          </button>

          <button onClick={generateCode} className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
            <lucide_react_1.Plus size={20}/>
            New Pairing Code
          </button>
        </div>
      </header>

      {/* ACTIVE MISSIONS TRACKER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">
            Live Missions Track ({activeMissions.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-tight">
              Real-time Sync
            </span>
          </div>
        </div>

        {activeMissions.length === 0 ? (<div className="bg-surface-container-low/30 rounded-3xl p-8 text-center border border-outline-variant/10">
            <p className="text-sm text-on-surface-variant/40 font-medium italic">
              No active delivery missions at the moment.
            </p>
          </div>) : (<div className="grid grid-cols-1 gap-3">
            {activeMissions.map(function (mission) {
                var _a;
                var assignedRider = connections.find(function (c) { return c.rider_id === mission.rider_id; });
                return (<div key={mission.id} className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10 flex items-center justify-between group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", mission.delivery_status === "finding_rider"
                        ? "bg-amber-100 text-amber-600 animate-pulse"
                        : mission.delivery_status === "accepted"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600")}>
                      {mission.delivery_status === "finding_rider" ? (<lucide_react_1.Zap size={18}/>) : (<lucide_react_1.Bike size={18}/>)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-on-surface">
                          Order #{mission.id.toString().slice(-4)}
                        </p>
                        <span className={cn("text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full", mission.delivery_status === "finding_rider"
                        ? "bg-amber-100 text-amber-600"
                        : mission.delivery_status === "accepted"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-600 text-white")}>
                          {(_a = mission.delivery_status) === null || _a === void 0 ? void 0 : _a.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium mt-0.5 line-clamp-1">
                        {mission.address}, {mission.city} • {(assignedRider === null || assignedRider === void 0 ? void 0 : assignedRider.rider_name) || "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold text-on-surface">
                        R {mission.total_price || mission.price}
                      </p>
                      <p className="text-[10px] text-on-surface-variant font-medium">
                        ETA: {mission.estimated_delivery_time || "Pending"}
                      </p>
                    </div>
                    {mission.rider_id && (<button onClick={function () { return setSelectedTrackId(mission.rider_id); }} className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors border border-primary/20" title="Track Real-time Position">
                        <lucide_react_1.MapPin size={16}/>
                      </button>)}
                    {mission.delivery_status === "finding_rider" && (<button onClick={function () { return onRequestRider(mission.id); }} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Retry Dispatch">
                        <lucide_react_1.RefreshCw size={16}/>
                      </button>)}
                  </div>
                </div>);
            })}
          </div>)}
      </div>

      {showCode && activeCode && (<react_2.motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/5 border-2 border-primary/20 rounded-3xl p-8 text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <button onClick={function () { return setShowCode(false); }} className="text-on-surface-variant/40 hover:text-on-surface transition-colors p-2">
              <lucide_react_1.X size={24}/>
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              Share with Rider
            </p>
            <h3 className="text-6xl font-headline font-black tracking-widest text-on-surface select-all">
              {activeCode.code}
            </h3>
            <p className="text-xs text-on-surface-variant/60 font-medium">
              Expires in 24 hours
            </p>
          </div>
          <div className="flex justify-center">
            <div className="bg-white p-6 rounded-3xl shadow-2xl border border-outline-variant/10 group cursor-pointer active:scale-95 transition-transform">
              {qrUrl ? (<img src={qrUrl} alt="Pairing QR" className="w-44 h-44"/>) : (<lucide_react_1.QrCode size={180} className="text-black"/>)}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-on-surface">
              Ready to connect
            </p>
            <p className="text-xs text-on-surface-variant italic">
              Riders scan this to connect instantly to {currentShop.name}
            </p>
          </div>
        </react_2.motion.div>)}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">
              Active Pairings ({activeConnectionsCount})
            </h3>
            <button onClick={function () { return void fetchConnections(); }} className="p-1 hover:bg-on-surface/5 rounded-lg text-primary transition-all" title="Refresh Connections">
              <lucide_react_1.RefreshCw size={12} className={cn(loading && "animate-spin")}/>
            </button>
          </div>
          <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
            {availableCodesCount} Available Codes
          </span>
        </div>

        {loading && connections.length === 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(function (i) { return (<div key={i} className="h-32 bg-surface-container-low rounded-3xl animate-pulse"/>); })}
          </div>) : connections.length === 0 ? (<div className="bg-surface-container-low rounded-[2rem] p-12 md:p-20 text-center border-2 border-dashed border-outline-variant/10">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4 text-on-surface-variant/20">
              <lucide_react_1.Bike size={32}/>
            </div>
            <p className="text-on-surface-variant font-bold text-lg leading-tight mb-1">
              No active rider connections
            </p>
            <p className="text-sm text-on-surface-variant/60 max-w-xs mx-auto mb-6">
              Generate a pairing code to allow riders to join your delivery
              network.
            </p>
            <button onClick={generateCode} className="flex items-center gap-2 px-8 py-4 bg-primary text-on-primary rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 mx-auto">
              <lucide_react_1.Plus size={20}/>
              Generate First Pairing Code
            </button>
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map(function (conn) {
                var _a;
                var expirationTime = new Date(conn.expires_at).getTime();
                var now = Date.now();
                var isExpired = expirationTime < now;
                return (<div key={conn.id} className={cn("bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 flex flex-col gap-4 group transition-all", isExpired
                        ? "opacity-60 bg-error-container/5 border-error/10"
                        : "hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 shadow-sm")}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0", isExpired
                        ? "bg-error/10 text-error"
                        : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary")}>
                        <lucide_react_1.Bike size={24}/>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-on-surface truncate">
                            {conn.rider_name || "Awaiting Rider..."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {conn.rider_id && (<div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 rounded-full text-amber-600 border border-amber-100 shrink-0">
                                <lucide_react_1.Star size={10} className="fill-current"/>
                                <span className="text-[10px] font-bold">{((_a = conn.rating) === null || _a === void 0 ? void 0 : _a.toFixed(1)) || '5.0'}</span>
                             </div>)}
                          {conn.rider_id && (<div className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-container-highest rounded-full text-on-surface-variant shrink-0">
                                <span className="text-[10px] font-bold">{conn.vehicle_type || 'Road'}</span>
                             </div>)}
                          <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg uppercase tracking-tight", conn.is_online
                        ? (conn.status === 'busy' ? "bg-amber-50 text-amber-700" : conn.status === 'paused' ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700")
                        : "bg-surface-container-highest text-on-surface-variant")}>
                            {conn.rider_id ? (conn.is_online ? conn.status : (conn.last_seen ? "Offline - ".concat(new Date(conn.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'Offline')) : conn.connection_code}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {conn.rider_id && (<button onClick={function () { return setSelectedTrackId(conn.rider_id); }} className="w-10 h-10 flex items-center justify-center bg-surface-container-highest text-on-surface rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm" title="View Live map">
                          <lucide_react_1.Navigation size={18}/>
                        </button>)}
                      <button onClick={function () { return deleteConnection(conn.id); }} className="w-10 h-10 flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/5 rounded-xl transition-colors" title="Disconnect Rider">
                        <lucide_react_1.Trash2 size={16}/>
                      </button>
                    </div>
                  </div>

                  {/* Rider performance KPIs */}
                  {conn.rider_id && (<div className="grid grid-cols-2 gap-2 pt-4 border-t border-outline-variant/10">
                       <div className="bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/10">
                          <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">Missions</p>
                          <p className="text-sm font-black text-on-surface">{conn.total_deliveries || 0}</p>
                       </div>
                       <div className="bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/10">
                          <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">Earnings</p>
                          <p className="text-sm font-black text-on-surface text-green-600">R {(conn.total_earnings || 0).toFixed(2)}</p>
                       </div>
                    </div>)}

                  {!isExpired && conn.rider_id && !conn.is_online && (<button onClick={function () {
                            sendRiderNudge(conn.rider_id, "Dispatcher is nudging you to go online!");
                        }} className="w-full py-2.5 bg-amber-500/10 text-amber-600 text-[10px] font-black rounded-xl uppercase hover:bg-amber-500/20 transition-all border border-amber-500/10 flex items-center justify-center gap-2">
                      <lucide_react_1.Zap size={12}/>
                      Wake Rider
                    </button>)}

                  {isExpired && (<button onClick={generateCode} className="w-full py-2.5 bg-error text-white text-[10px] font-black rounded-xl uppercase hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-error/20">
                      Code expired. Re-pair
                    </button>)}
                </div>);
            })}
          </div>)}
      </div>

      {/* TRACKER MODAL */}
      <react_2.AnimatePresence>
         {selectedTrackId && trackedRider && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 pointer-events-none">
               <react_2.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md pointer-events-auto" onClick={function () { return setSelectedTrackId(null); }}/>
               <react_2.motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} className="w-full max-w-5xl h-full max-h-[80vh] bg-surface-container-low rounded-[2.5rem] border border-outline-variant/20 shadow-2xl overflow-hidden relative flex flex-col pointer-events-auto">
                  <div className="p-6 md:p-8 flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                           <lucide_react_1.Bike size={24}/>
                        </div>
                        <div>
                           <h2 className="text-xl font-headline font-bold text-on-surface">{trackedRider.rider_name}</h2>
                           <p className="text-xs font-medium text-on-surface-variant/60 flex items-center gap-1.5">
                              <span className={cn("w-2 h-2 rounded-full", trackedRider.is_online ? "bg-green-500 animate-pulse" : "bg-zinc-300")}/>
                              {trackedRider.is_online ? 'Live tracking active' : 'Last known location'}
                           </p>
                        </div>
                     </div>
                     <button onClick={function () { return setSelectedTrackId(null); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-on-surface/5 transition-colors">
                        <lucide_react_1.X size={24}/>
                     </button>
                  </div>

                  <div className="flex-1 relative bg-surface-container-highest">
                     {trackedRider.latitude && trackedRider.longitude ? (<react_leaflet_1.MapContainer center={[trackedRider.latitude, trackedRider.longitude]} zoom={15} className="w-full h-full" zoomControl={false}>
                          <react_leaflet_1.TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"/>
                          <react_leaflet_1.Marker position={[trackedRider.latitude, trackedRider.longitude]} icon={leaflet_1.default.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3195/3195868.png',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                })}/>
                        </react_leaflet_1.MapContainer>) : (<div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                           <lucide_react_1.Navigation size={48} className="text-on-surface-variant/20 mb-4 animate-bounce"/>
                           <h3 className="font-bold text-lg mb-2">Location Signal Missing</h3>
                           <p className="text-sm text-on-surface-variant/60 max-w-xs">
                              We haven't received GPS coordinates for this rider yet. Ensure their app is open and location services are enabled.
                           </p>
                        </div>)}
                  </div>

                  <div className="p-6 bg-surface-container-low border-t border-outline-variant/10 grid grid-cols-3 gap-4">
                     <div className="text-center">
                        <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Missions</p>
                        <p className="text-xl font-black text-on-surface">{trackedRider.total_deliveries || 0}</p>
                     </div>
                     <div className="text-center">
                        <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Rating</p>
                        <p className="text-xl font-black text-primary flex items-center justify-center gap-1">
                           <lucide_react_1.Star size={16} className="fill-current"/>
                           {((_b = trackedRider.rating) === null || _b === void 0 ? void 0 : _b.toFixed(1)) || '5.0'}
                        </p>
                     </div>
                     <div className="text-center">
                        <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Status</p>
                        <p className={cn("text-sm font-black uppercase tracking-tighter mt-1", trackedRider.is_online ? (trackedRider.status === 'busy' ? "text-amber-600" : trackedRider.status === 'paused' ? "text-blue-600" : "text-green-600") : "text-on-surface-variant")}>
                           {trackedRider.is_online ? trackedRider.status : 'Offline'}
                        </p>
                     </div>
                  </div>
               </react_2.motion.div>
            </div>)}
      </react_2.AnimatePresence>
    </div>);
};
// --- Subscription Components ---
// --- Main App ---
var isPlaceholderImage = function (url) {
    if (!url)
        return true;
    return url.includes("picsum.photos") || url.includes("dicebear.com");
};
var FoodPlaceholder = function (_a) {
    var _b = _a.size, size = _b === void 0 ? 20 : _b, _c = _a.className, className = _c === void 0 ? "" : _c;
    return (<div className={cn("w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-cover bg-center", className)} style={{
            backgroundImage: "linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), url(".concat(DEFAULT_MENU_IMAGE, ")")
        }}>
    {/* Glassmorphism accents */}
    <div className="absolute top-0 right-0 w-full h-full bg-white/10" style={{ clipPath: "polygon(0 0, 100% 0, 100% 30%, 0 80%)" }}/>
    <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-black/5 rounded-full blur-xl"/>

    <div className="relative flex flex-col items-center justify-center gap-1">
      <div className="relative">
        <lucide_react_1.UtensilsCrossed size={size} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" strokeWidth={2}/>
        {/* Subtle sparkle for 3D effect */}
        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-white rounded-full animate-pulse blur-[1px]"/>
      </div>
      {size > 30 && (<span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 drop-shadow-sm mt-1">
          LocalEats
        </span>)}
    </div>
  </div>);
};
function App() {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var _k = (0, react_1.useState)(function () {
        return localStorage.getItem("user_role") || "merchant";
    }), role = _k[0], setRole = _k[1];
    var _l = (0, react_1.useState)([]), cart = _l[0], setCart = _l[1];
    var _m = (0, react_1.useState)("dashboard"), activeTab = _m[0], setActiveTab = _m[1];
    var _o = (0, react_1.useState)(false), showHelp = _o[0], setShowHelp = _o[1];
    (0, react_1.useEffect)(function () {
        localStorage.setItem("user_role", role);
    }, [role]);
    var handleSwitchRole = function () {
        var newRole = "merchant";
        if (role === "merchant")
            newRole = "customer";
        else if (role === "customer")
            newRole = "rider";
        else
            newRole = "merchant";
        setRole(newRole);
        if (newRole === "merchant")
            setActiveTab("dashboard");
        else if (newRole === "customer")
            setActiveTab("explore");
        else
            setActiveTab("feed");
        sonner_1.toast.success("Switching to ".concat(newRole.toUpperCase(), " environment"));
    };
    // Version Polling for Updates
    var _p = (0, react_1.useState)(false), updateAvailable = _p[0], setUpdateAvailable = _p[1];
    var _q = (0, react_1.useState)(""), lastCheckTime = _q[0], setLastCheckTime = _q[1];
    var currentBuildVersion = (0, react_1.useRef)(19); // Moving to v5.4 tracker
    (0, react_1.useEffect)(function () {
        var checkVersion = function () { return __awaiter(_this, void 0, void 0, function () {
            var response, data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setLastCheckTime(new Date().toLocaleTimeString());
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, fetch("/version.json?t=" + Date.now())];
                    case 2:
                        response = _b.sent();
                        if (!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _b.sent();
                        if (data.version > currentBuildVersion.current) {
                            setUpdateAvailable(true);
                        }
                        _b.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        _a = _b.sent();
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        }); };
        // Check once on mount and then every 30s
        checkVersion();
        var interval = setInterval(checkVersion, 30000);
        return function () { return clearInterval(interval); };
    }, []);
    var _r = (0, react_1.useState)([]), orders = _r[0], setOrders = _r[1];
    var _s = (0, react_1.useState)([]), shops = _s[0], setShops = _s[1];
    var _t = (0, react_1.useState)([]), menuItems = _t[0], setMenuItems = _t[1];
    var _u = (0, react_1.useState)(null), user = _u[0], setUser = _u[1];
    var _v = (0, react_1.useState)("signin"), authView = _v[0], setAuthView = _v[1];
    var _w = (0, react_1.useState)(false), isVerifying = _w[0], setIsVerifying = _w[1];
    var _x = (0, react_1.useState)(false), isEditingProfile = _x[0], setIsEditingProfile = _x[1];
    var _y = (0, react_1.useState)(false), isSaving = _y[0], setIsSaving = _y[1];
    var _z = (0, react_1.useState)(false), isSaveSuccess = _z[0], setIsSaveSuccess = _z[1];
    var _0 = (0, react_1.useState)(""), signupEmail = _0[0], setSignupEmail = _0[1];
    var _1 = (0, react_1.useState)(true), loading = _1[0], setLoading = _1[1];
    var _2 = (0, react_1.useState)(false), isAuthReady = _2[0], setIsAuthReady = _2[1];
    var _3 = (0, react_1.useState)(function () {
        return localStorage.getItem("soundAlerts") !== "false";
    }), soundAlerts = _3[0], setSoundAlerts = _3[1];
    var _4 = (0, react_1.useState)(function () {
        return (typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted");
    }), pushEnabled = _4[0], setPushEnabled = _4[1];
    var prevPendingCount = (0, react_1.useRef)(0);
    var _5 = (0, react_1.useState)(!navigator.onLine), isOffline = _5[0], setIsOffline = _5[1];
    var _6 = (0, react_1.useState)(false), kitchenMode = _6[0], setKitchenMode = _6[1];
    var _7 = (0, react_1.useState)(function () {
        return localStorage.getItem("darkMode") === "true";
    }), darkMode = _7[0], setDarkMode = _7[1];
    var shopsRef = (0, react_1.useRef)([]);
    var currentShop = (0, react_1.useMemo)(function () { return shops.find(function (s) { return s.owner_id === (user === null || user === void 0 ? void 0 : user.id); }); }, [shops, user === null || user === void 0 ? void 0 : user.id]);
    var trialInfo = (0, react_1.useMemo)(function () {
        // Trial mode is disabled for now - everything is free.
        return null;
    }, []);
    // Offline detection
    (0, react_1.useEffect)(function () {
        var handleOnline = function () { return setIsOffline(false); };
        var handleOffline = function () { return setIsOffline(true); };
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return function () {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);
    // Cache data to localStorage
    (0, react_1.useEffect)(function () {
        if (shops.length > 0)
            localStorage.setItem("le_shops", JSON.stringify(shops));
    }, [shops]);
    (0, react_1.useEffect)(function () {
        if (orders.length > 0)
            localStorage.setItem("le_orders", JSON.stringify(orders));
    }, [orders]);
    (0, react_1.useEffect)(function () {
        if (menuItems.length > 0)
            localStorage.setItem("le_menu", JSON.stringify(menuItems));
    }, [menuItems]);
    // Load cached data on mount
    (0, react_1.useEffect)(function () {
        var cachedShops = localStorage.getItem("le_shops");
        var cachedOrders = localStorage.getItem("le_orders");
        var cachedMenu = localStorage.getItem("le_menu");
        if (cachedShops)
            setShops(JSON.parse(cachedShops));
        if (cachedOrders)
            setOrders(JSON.parse(cachedOrders));
        if (cachedMenu)
            setMenuItems(JSON.parse(cachedMenu));
    }, []);
    (0, react_1.useEffect)(function () {
        shopsRef.current = shops;
    }, [shops]);
    (0, react_1.useEffect)(function () {
        if (darkMode) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("darkMode", "true");
        }
        else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("darkMode", "false");
        }
    }, [darkMode]);
    (0, react_1.useEffect)(function () {
        localStorage.setItem("soundAlerts", soundAlerts.toString());
    }, [soundAlerts]);
    (0, react_1.useEffect)(function () {
        // Check current session with a timeout
        var getSessionWithTimeout = function () { return __awaiter(_this, void 0, void 0, function () {
            var timeout_1, sessionPromise, timeoutPromise, result, session, err_15;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, 3, 4]);
                        timeout_1 = 15000;
                        sessionPromise = supabase.auth.getSession();
                        timeoutPromise = new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Session check timed out")); }, timeout_1);
                        });
                        return [4 /*yield*/, Promise.race([
                                sessionPromise,
                                timeoutPromise,
                            ])];
                    case 1:
                        result = (_b.sent());
                        session = result.data.session;
                        if (session === null || session === void 0 ? void 0 : session.user) {
                            setUser(session.user);
                            if (((_a = session.user.user_metadata) === null || _a === void 0 ? void 0 : _a.dark_mode) !== undefined) {
                                setDarkMode(session.user.user_metadata.dark_mode);
                            }
                        }
                        return [3 /*break*/, 4];
                    case 2:
                        err_15 = _b.sent();
                        // Log as warning instead of error to reduce noise, as onAuthStateChange is a fallback
                        console.warn("Auth initialization status:", err_15 instanceof Error ? err_15.message : err_15);
                        return [3 /*break*/, 4];
                    case 3:
                        // Ensure we mark auth as ready so the app can render
                        setIsAuthReady(true);
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        getSessionWithTimeout();
        // Listen for auth changes
        var subscription = supabase.auth.onAuthStateChange(function (_event, session) {
            var _a, _b, _c;
            var currentUser = (_a = session === null || session === void 0 ? void 0 : session.user) !== null && _a !== void 0 ? _a : null;
            setUser(currentUser);
            setIsAuthReady(true);
            setLoading(false); // Make sure loading is false on auth change
            if (((_c = (_b = session === null || session === void 0 ? void 0 : session.user) === null || _b === void 0 ? void 0 : _b.user_metadata) === null || _c === void 0 ? void 0 : _c.dark_mode) !== undefined) {
                setDarkMode(session.user.user_metadata.dark_mode);
            }
        }).data.subscription;
        return function () { return subscription.unsubscribe(); };
    }, []);
    // Automatic Shop Opening/Closing based on hours
    (0, react_1.useEffect)(function () {
        var checkShopHours = function () { return __awaiter(_this, void 0, void 0, function () {
            var operatingHours, now, currentTime, isOpen, _loop_2, _i, shops_1, shop;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!user || shops.length === 0)
                            return [2 /*return*/];
                        operatingHours = (_a = user.user_metadata) === null || _a === void 0 ? void 0 : _a.operating_hours;
                        if (!operatingHours || !operatingHours.open || !operatingHours.close)
                            return [2 /*return*/];
                        now = new Date();
                        currentTime = (0, date_fns_1.format)(now, "HH:mm");
                        isOpen = currentTime >= operatingHours.open &&
                            currentTime <= operatingHours.close;
                        _loop_2 = function (shop) {
                            var error;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        if (!(shop.owner_id === user.id && shop.is_active !== isOpen)) return [3 /*break*/, 2];
                                        console.log("Auto-toggling shop ".concat(shop.name, " to ").concat(isOpen ? "Open" : "Closed"));
                                        return [4 /*yield*/, supabase
                                                .from("shops")
                                                .update({ is_active: isOpen })
                                                .eq("id", shop.id)];
                                    case 1:
                                        error = (_c.sent()).error;
                                        if (!error) {
                                            setShops(function (prev) {
                                                return prev.map(function (s) {
                                                    return s.id === shop.id ? __assign(__assign({}, s), { is_active: isOpen }) : s;
                                                });
                                            });
                                            sonner_1.toast.info("Shop ".concat(isOpen ? "Opened" : "Closed", " Automatically"), {
                                                description: "Based on your operating hours: ".concat(operatingHours.open, " - ").concat(operatingHours.close),
                                                icon: isOpen ? (<lucide_react_1.Store className="text-emerald-500"/>) : (<lucide_react_1.PauseCircle className="text-primary"/>),
                                                duration: 5000,
                                            });
                                        }
                                        _c.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, shops_1 = shops;
                        _b.label = 1;
                    case 1:
                        if (!(_i < shops_1.length)) return [3 /*break*/, 4];
                        shop = shops_1[_i];
                        return [5 /*yield**/, _loop_2(shop)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        // Check every minute
        var interval = setInterval(function () {
            void checkShopHours();
        }, 60000);
        void checkShopHours(); // Run once on mount or when shops/user change
        return function () { return clearInterval(interval); };
    }, [user, shops, (_a = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _a === void 0 ? void 0 : _a.operating_hours]);
    (0, react_1.useEffect)(function () {
        localStorage.setItem("soundAlerts", soundAlerts.toString());
    }, [soundAlerts]);
    var requestPushPermissions = function () { return __awaiter(_this, void 0, void 0, function () {
        var permission, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!("Notification" in window)) {
                        sonner_1.toast.error("This browser does not support push notifications.");
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Notification.requestPermission()];
                case 2:
                    permission = _a.sent();
                    if (permission === "granted") {
                        setPushEnabled(true);
                        sonner_1.toast.success("Push notifications enabled!");
                    }
                    else {
                        setPushEnabled(false);
                        sonner_1.toast.error("Notification permission denied.");
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_9 = _a.sent();
                    console.error("Error requesting notification permission:", error_9);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var playNotificationSound = function (isRepeating) {
        if (isRepeating === void 0) { isRepeating = false; }
        // Vibrate if supported
        if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
        var audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
        audio.volume = 1.0;
        if (isRepeating) {
            audio.loop = true;
            // Stop repeating sound after 10 seconds or when user clicks something
            setTimeout(function () {
                audio.pause();
            }, 10000);
        }
        audio.play().catch(function (e) {
            console.log("Audio play blocked or failed:", e);
        });
        return audio;
    };
    // Sound alert logic for new orders
    (0, react_1.useEffect)(function () {
        if (!user)
            return;
        var currentPendingCount = orders.filter(function (o) { return o.status === "pending"; }).length;
        // Only trigger if count increased and sound is enabled
        if (soundAlerts && currentPendingCount > prevPendingCount.current) {
            var audio_1 = playNotificationSound(true); // Enable repeating for new orders
            sonner_1.toast.success("NEW ORDER RECEIVED!", {
                description: "CRITICAL: You have ".concat(currentPendingCount, " pending ").concat(currentPendingCount === 1 ? "order" : "orders", "."),
                duration: 15000,
                important: true,
                icon: <lucide_react_1.Bell className="text-primary animate-bounce"/>,
                action: {
                    label: "DISMISS ALERT",
                    onClick: function () {
                        audio_1.pause();
                        setActiveTab("orders");
                    },
                },
                onDismiss: function () { return audio_1.pause(); },
            });
        }
        prevPendingCount.current = currentPendingCount;
    }, [orders, soundAlerts, user]);
    var fetchOrders = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, ownedShops, shopsError, ownedShopIds, _b, data, error, stuckOrders, mappedOrders;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/];
                    return [4 /*yield*/, fetchWithRetry(function () {
                            return supabase.from("shops").select("id").eq("owner_id", user.id);
                        })];
                case 1:
                    _a = _c.sent(), ownedShops = _a.data, shopsError = _a.error;
                    if (shopsError) {
                        console.error("Error fetching owned shops for orders:", shopsError);
                        if (shopsError.message === "Failed to fetch") {
                            sonner_1.toast.error("Uplink failed. Refreshing connection...");
                        }
                        return [2 /*return*/];
                    }
                    ownedShopIds = (ownedShops === null || ownedShops === void 0 ? void 0 : ownedShops.map(function (s) { return s.id; })) || [];
                    if (ownedShopIds.length === 0) {
                        setOrders([]);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, fetchWithRetry(function () {
                            return supabase
                                .from("orders")
                                .select("*")
                                .in("shop_id", ownedShopIds)
                                .order("created_at", { ascending: false });
                        })];
                case 2:
                    _b = _c.sent(), data = _b.data, error = _b.error;
                    if (error) {
                        console.error("Error fetching orders:", error);
                        if (error.message === "Failed to fetch") {
                            sonner_1.toast.error("Network error: Could not connect to Supabase. Check your internet or ad-blocker.");
                        }
                        else {
                            sonner_1.toast.error("Error fetching orders: ".concat(error.message));
                        }
                    }
                    else if (data) {
                        stuckOrders = data.filter(function (o) {
                            return (o.status === "completed" && o.delivery_status === "finding_rider") ||
                                o.delivery_status === "none";
                        });
                        if (stuckOrders.length > 0) {
                            console.log("Cleaning up ".concat(stuckOrders.length, " stuck delivery statuses..."));
                            stuckOrders.forEach(function (o) {
                                supabase
                                    .from("orders")
                                    .update({ delivery_status: null })
                                    .eq("id", o.id)
                                    .then();
                                o.delivery_status = null;
                            });
                        }
                        mappedOrders = data.map(function (order) {
                            var _a, _b;
                            return (__assign(__assign({}, order), { total_price: (_b = (_a = order.total_price) !== null && _a !== void 0 ? _a : order.price) !== null && _b !== void 0 ? _b : 0 }));
                        });
                        console.log("Fetched orders:", mappedOrders);
                        setOrders(mappedOrders);
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [user]);
    var fetchAllMenuItems = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var ownedShops, ownedShopIds, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/];
                    return [4 /*yield*/, fetchWithRetry(function () {
                            return supabase.from("shops").select("id").eq("owner_id", user.id);
                        })];
                case 1:
                    ownedShops = (_b.sent()).data;
                    ownedShopIds = (ownedShops === null || ownedShops === void 0 ? void 0 : ownedShops.map(function (s) { return s.id; })) || [];
                    if (ownedShopIds.length === 0) {
                        setMenuItems([]);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, fetchWithRetry(function () {
                            return supabase.from("menu_items").select("*").in("shop_id", ownedShopIds);
                        })];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (data) {
                        setMenuItems(data);
                    }
                    else if (error) {
                        console.error("Fetch All Menu Items Error:", error);
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [user]);
    var fetchShops = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetchWithRetry(function () {
                        return supabase
                            .from("shops")
                            .select("*")
                            .order("created_at", { ascending: false });
                    })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        console.error("Error fetching shops:", error);
                        if (error.message === "Failed to fetch") {
                            sonner_1.toast.error("Network error: Could not connect to Supabase. Check your internet or ad-blocker.");
                        }
                    }
                    else if (data) {
                        setShops(data);
                    }
                    return [2 /*return*/];
            }
        });
    }); }, []);
    (0, react_1.useEffect)(function () {
        if (user) {
            void fetchOrders();
            void fetchShops();
            void fetchAllMenuItems();
            // Real-time subscription for shops
            var shopsChannel_1 = supabase
                .channel("shops_changes")
                .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, function () {
                void fetchShops();
            })
                .subscribe();
            return function () {
                void supabase.removeChannel(shopsChannel_1);
            };
        }
    }, [user, fetchOrders, fetchShops, fetchAllMenuItems]);
    // Separate effect for order subscriptions to filter by shop_id
    (0, react_1.useEffect)(function () {
        if (user && shops.length > 0) {
            var ownedShopIds = shops
                .filter(function (s) { return s.owner_id === user.id; })
                .map(function (s) { return s.id; });
            if (ownedShopIds.length === 0)
                return;
            var channels_1 = ownedShopIds.map(function (shopId) {
                return supabase
                    .channel("orders_changes_".concat(shopId))
                    .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: "shop_id=eq.".concat(shopId),
                }, function () {
                    void fetchOrders();
                })
                    .subscribe();
            });
            return function () {
                channels_1.forEach(function (channel) { return void supabase.removeChannel(channel); });
            };
        }
    }, [user, shops, fetchOrders]);
    var deleteAllOrders = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, ownedShops, shopsError, ownedShopIds, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/];
                    if (!window.confirm("Are you sure you want to delete ALL orders? This action cannot be undone."))
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase
                            .from("shops")
                            .select("id")
                            .eq("owner_id", user.id)];
                case 1:
                    _a = _b.sent(), ownedShops = _a.data, shopsError = _a.error;
                    if (shopsError) {
                        console.error("Error fetching owned shops for deletion:", shopsError);
                        return [2 /*return*/];
                    }
                    ownedShopIds = (ownedShops === null || ownedShops === void 0 ? void 0 : ownedShops.map(function (s) { return s.id; })) || [];
                    if (ownedShopIds.length === 0) {
                        sonner_1.toast.info("No orders to delete.");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .delete()
                            .in("shop_id", ownedShopIds)];
                case 2:
                    error = (_b.sent()).error;
                    if (error) {
                        console.error("Delete All Orders Error:", error);
                        sonner_1.toast.error("We couldn't delete these orders right now. Please try again.");
                    }
                    else {
                        sonner_1.toast.success("All orders have been deleted.");
                        fetchOrders();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var updateOrderStatus = function (id, status, message, estimatedTime) { return __awaiter(_this, void 0, void 0, function () {
        var previousOrders, updateData, order, order, error, order_1, menuItem_1, newStock_1, stockError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    previousOrders = __spreadArray([], orders, true);
                    setOrders(function (prev) {
                        return prev.map(function (o) {
                            if (o.id === id) {
                                var updated = __assign(__assign({}, o), { status: status });
                                if (message)
                                    updated.acceptance_message = message;
                                if (status === "preparing" && !o.accepted_at)
                                    updated.accepted_at = new Date().toISOString();
                                if (status === "completed" && !o.completed_at)
                                    updated.completed_at = new Date().toISOString();
                                if (estimatedTime)
                                    updated.estimated_delivery_time = estimatedTime;
                                // Optimistic Rider Broadcast
                                if ((status === "preparing" ||
                                    status === "ready" ||
                                    status === "accepted") &&
                                    (o.order_type === "delivery" || !o.order_type) &&
                                    !o.delivery_status) {
                                    updated.delivery_status = "finding_rider";
                                    updated.order_type = "delivery";
                                    updated.delivery_fee = FLAT_DELIVERY_FEE;
                                    updated.status = "accepted"; // Force 'accepted' for Rider App query compatibility
                                    updated.restaurant_name = o.restaurant_name || currentShop.name;
                                    updated.city = "Tembisa"; // Locked to Tembisa for rollout
                                    updated.price = o.price || o.total_price || 0;
                                    updated.total_price = o.total_price || o.price || 0;
                                    if (!o.items || o.items.length === 0) {
                                        updated.items = [o.product_name || "Delivery Order"];
                                    }
                                }
                                if (status === "completed" && o.delivery_status === "finding_rider") {
                                    updated.delivery_status = undefined; // Hide from live track locally
                                }
                                return updated;
                            }
                            return o;
                        });
                    });
                    updateData = { status: status };
                    if (message)
                        updateData.acceptance_message = message;
                    if (estimatedTime)
                        updateData.estimated_delivery_time = estimatedTime;
                    if (status === "preparing" || status === "ready" || status === "accepted") {
                        order = orders.find(function (o) { return o.id === id; });
                        if (order) {
                            if (!order.accepted_at &&
                                (status === "preparing" || status === "accepted")) {
                                updateData.accepted_at = new Date().toISOString();
                            }
                            if (status === "completed" && !order.completed_at) {
                                updateData.completed_at = new Date().toISOString();
                            }
                            // Auto-broadcast to rider network if it's a delivery order and not already assigned/finding
                            if ((order.order_type === "delivery" || !order.order_type) &&
                                !order.delivery_status) {
                                updateData.delivery_status = "finding_rider";
                                updateData.delivery_fee = FLAT_DELIVERY_FEE;
                                updateData.order_type = "delivery";
                                updateData.status = "accepted"; // Matches what works in Auto-Broadcast
                                updateData.restaurant_name =
                                    order.restaurant_name || (currentShop === null || currentShop === void 0 ? void 0 : currentShop.name) || "Local Merchant";
                                updateData.city = "Tembisa"; // Locked to Tembisa for rollout
                                updateData.shop_id = order.shop_id || (currentShop === null || currentShop === void 0 ? void 0 : currentShop.id);
                                if ((!order.items || order.items.length === 0) &&
                                    order.product_name) {
                                    updateData.items = [order.product_name];
                                }
                                else if (!order.items || order.items.length === 0) {
                                    updateData.items = ["Food Delivery"];
                                }
                                updateData.price = order.price || order.total_price || 0;
                                updateData.total_price = order.total_price || order.price || 0;
                            }
                        }
                    }
                    if (status === "completed") {
                        order = orders.find(function (o) { return o.id === id; });
                        if (order && order.delivery_status === "finding_rider") {
                            updateData.delivery_status = null; // clear the rider status to remove from rider feed
                        }
                    }
                    if (estimatedTime)
                        updateData.estimated_delivery_time = estimatedTime;
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .update(updateData)
                            .eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (!error) return [3 /*break*/, 2];
                    console.error("Update Order Status Error:", error);
                    setOrders(previousOrders);
                    sonner_1.toast.error("We couldn't update the order status. Please try again later.");
                    return [3 /*break*/, 5];
                case 2:
                    sonner_1.toast.success("Order marked as ".concat(status));
                    if (!(status === "preparing")) return [3 /*break*/, 4];
                    order_1 = orders.find(function (o) { return o.id === id; });
                    if (!order_1) return [3 /*break*/, 4];
                    menuItem_1 = menuItems.find(function (mi) {
                        return mi.name === order_1.product_name && mi.shop_id === order_1.shop_id;
                    });
                    if (!(menuItem_1 &&
                        menuItem_1.stock_quantity !== undefined &&
                        menuItem_1.stock_quantity !== null &&
                        menuItem_1.stock_quantity > 0)) return [3 /*break*/, 4];
                    newStock_1 = menuItem_1.stock_quantity - 1;
                    return [4 /*yield*/, supabase
                            .from("menu_items")
                            .update({ stock_quantity: newStock_1 })
                            .eq("id", menuItem_1.id)];
                case 3:
                    stockError = (_a.sent()).error;
                    if (stockError) {
                        console.error("Failed to decrement stock:", stockError);
                    }
                    else {
                        // Update local state
                        setMenuItems(function (prev) {
                            return prev.map(function (mi) {
                                return mi.id === menuItem_1.id
                                    ? __assign(__assign({}, mi), { stock_quantity: newStock_1 }) : mi;
                            });
                        });
                        if (newStock_1 < 5) {
                            sonner_1.toast.warning("Low stock alert: ".concat(menuItem_1.name, " has only ").concat(newStock_1, " left!"), {
                                description: "Consider restocking soon.",
                                icon: <lucide_react_1.AlertCircle className="text-error" size={18}/>,
                                duration: 5000,
                            });
                        }
                    }
                    _a.label = 4;
                case 4:
                    // Notify about client update when picked up (completed)
                    if (status === "completed") {
                        sonner_1.toast.info("Notification sent to client app", {
                            description: "The customer has been notified that their order was picked up.",
                            icon: <lucide_react_1.Bell className="text-primary" size={18}/>,
                            duration: 4000,
                        });
                    }
                    // Notify about acceptance message
                    if (status === "preparing" && message) {
                        sonner_1.toast.info("Acceptance message sent!", {
                            description: "\"".concat(message, "\" sent to the customer app."),
                            icon: <lucide_react_1.MessageSquare className="text-primary" size={18}/>,
                            duration: 4000,
                        });
                    }
                    fetchOrders();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var unassignRider = function (id) { return __awaiter(_this, void 0, void 0, function () {
        var previousOrders, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    previousOrders = __spreadArray([], orders, true);
                    setOrders(function (prev) {
                        return prev.map(function (o) {
                            return o.id === id
                                ? __assign(__assign({}, o), { delivery_status: "finding_rider", rider_id: undefined }) : o;
                        });
                    });
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .update({
                            delivery_status: "finding_rider",
                            rider_id: null,
                        })
                            .eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        setOrders(previousOrders);
                        sonner_1.toast.error("Error unassigning rider: ".concat(error.message));
                    }
                    else {
                        sonner_1.toast.success("Rider unassigned and mission rebroadcasted to fleet");
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var sendRiderNudge = function (riderId, message) { return __awaiter(_this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sonner_1.toast.info("Sending nudge to rider...", {
                        icon: <lucide_react_1.MessageSquare size={16}/>,
                    });
                    return [4 /*yield*/, supabase.rpc("nudge_rider", {
                            rider_id: riderId,
                            message: message,
                        })];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error("Nudge error:", error);
                        sonner_1.toast.error("Failed to nudge rider. Connection issue.");
                    }
                    else {
                        sonner_1.toast.success("Nudge sent via secure gateway!");
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var requestRider = function (id, targetRiderId) { return __awaiter(_this, void 0, void 0, function () {
        var previousOrders, currentOrder, updateData, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    previousOrders = __spreadArray([], orders, true);
                    setOrders(function (prev) {
                        return prev.map(function (o) {
                            return o.id === id
                                ? __assign(__assign({}, o), { status: "accepted", delivery_status: "finding_rider", delivery_fee: FLAT_DELIVERY_FEE, rider_id: targetRiderId || o.rider_id, order_type: "delivery", restaurant_name: o.restaurant_name || currentShop.name, city: "Tembisa", price: o.price || o.total_price || 0, total_price: o.total_price || o.price || 0 }) : o;
                        });
                    });
                    currentOrder = orders.find(function (o) { return o.id === id; });
                    updateData = {
                        status: "accepted",
                        delivery_status: "finding_rider",
                        delivery_fee: FLAT_DELIVERY_FEE,
                        price: (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.price) || (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.total_price) || 0,
                        total_price: (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.total_price) || (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.price) || 0,
                        restaurant_name: (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.restaurant_name) || currentShop.name,
                        items: (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.items) && currentOrder.items.length > 0
                            ? currentOrder.items
                            : (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.product_name)
                                ? [currentOrder.product_name]
                                : ["Food Delivery"],
                        order_type: "delivery",
                        city: "Tembisa",
                        shop_id: (currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.shop_id) || currentShop.id,
                    };
                    if (targetRiderId)
                        updateData.rider_id = targetRiderId;
                    // Clean undefined from updateData
                    if (updateData.status === undefined)
                        delete updateData.status;
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .update(updateData)
                            .eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error("Request Rider Error:", error);
                        setOrders(previousOrders);
                        sonner_1.toast.error("We couldn't request a rider right now. Please try again.");
                    }
                    else {
                        sonner_1.toast.success("Rider requested! Searching for available cyclists...", {
                            icon: <lucide_react_1.Rocket className="text-primary" size={18}/>,
                        });
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleSignOut = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase.auth.signOut()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    if (loading || !isAuthReady) {
        return (<div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>);
    }
    // Configuration check for Supabase Uplink
    if (!supabaseUrl || !supabaseAnonKey) {
        return (<div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20 animate-pulse">
          <lucide_react_1.AlertCircle size={40} className="text-red-500"/>
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight uppercase tracking-widest font-headline">
          Infrastructure Offline
        </h1>
        <p className="text-zinc-400 max-w-sm mb-8 font-medium leading-relaxed font-body text-sm">
          The Supabase Uplink is missing credentials. Please configure{" "}
          <span className="text-white font-mono bg-zinc-800 px-2 py-0.5 rounded">
            VITE_SUPABASE_URL
          </span>{" "}
          and{" "}
          <span className="text-white font-mono bg-zinc-800 px-2 py-0.5 rounded">
            VITE_SUPABASE_ANON_KEY
          </span>{" "}
          in your project secrets.
        </p>
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-full max-w-md text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1">
            Debugging Intel
          </p>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between p-2 bg-black/30 rounded-lg">
              <span className="text-zinc-600">URL Status:</span>
              <span className={supabaseUrl ? "text-green-500" : "text-red-500"}>
                {supabaseUrl ? "DETECTED" : "MISSING"}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-black/30 rounded-lg">
              <span className="text-zinc-600">Key Status:</span>
              <span className={supabaseAnonKey ? "text-green-500" : "text-red-500"}>
                {supabaseAnonKey ? "DETECTED" : "MISSING"}
              </span>
            </div>
          </div>
        </div>
      </div>);
    }
    var handleSaveProfile = function (data) { return __awaiter(_this, void 0, void 0, function () {
        var error, shopPayload, shopUpdateErr, error_10;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 9, , 10]);
                    return [4 /*yield*/, supabase.auth.updateUser({
                            data: {
                                full_name: data.fullName,
                                phone: data.phone,
                                whatsapp: data.whatsapp,
                                location: data.location,
                                address: data.address,
                                operating_hours: data.operatingHours,
                                marketing_preferences: data.marketing,
                                dark_mode: data.darkMode,
                                avatar_url: data.avatarUrl,
                            },
                        })];
                case 2:
                    error = (_c.sent()).error;
                    if (error)
                        throw error;
                    if (!user) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase
                            .from("rider_profiles")
                            .update({
                            full_name: data.fullName,
                            phone: data.phone,
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", user.id)];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4:
                    if (!currentShop) return [3 /*break*/, 8];
                    shopPayload = {
                        phone: data.phone,
                        whatsapp: data.whatsapp,
                        location: data.address, // Sync address too
                    };
                    return [4 /*yield*/, supabase
                            .from("shops")
                            .update(shopPayload)
                            .eq("id", currentShop.id)];
                case 5:
                    shopUpdateErr = (_c.sent()).error;
                    if (!(shopUpdateErr && (shopUpdateErr.code === "42703" || ((_a = shopUpdateErr.message) === null || _a === void 0 ? void 0 : _a.includes("column")) || ((_b = shopUpdateErr.message) === null || _b === void 0 ? void 0 : _b.includes("schema cache"))))) return [3 /*break*/, 7];
                    // Fallback if columns don't exist on shops table
                    delete shopPayload.whatsapp;
                    delete shopPayload.lat;
                    delete shopPayload.lng;
                    return [4 /*yield*/, supabase
                            .from("shops")
                            .update(shopPayload)
                            .eq("id", currentShop.id)];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7:
                    fetchShops(); // Refresh shops state
                    _c.label = 8;
                case 8:
                    if (data.darkMode !== undefined) {
                        setDarkMode(data.darkMode);
                    }
                    void fetchRiderData();
                    // Show success state
                    setIsSaving(false);
                    setIsSaveSuccess(true);
                    // Close after delay
                    setTimeout(function () {
                        setIsSaveSuccess(false);
                        setIsEditingProfile(false);
                        sonner_1.toast.success("Profile updated successfully!");
                    }, 1500);
                    return [3 /*break*/, 10];
                case 9:
                    error_10 = _c.sent();
                    setIsSaving(false);
                    setIsSaveSuccess(false);
                    sonner_1.toast.error(error_10 instanceof Error ? error_10.message : "Failed to update profile");
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    }); };
    if (isVerifying) {
        return (<VerificationPending email={signupEmail} onBack={function () { return setIsVerifying(false); }} onVerified={function () {
                setIsVerifying(false);
                setIsEditingProfile(true);
            }} onSupport={function () {
                window.location.href = "mailto:support@localeats.com";
            }}/>);
    }
    if (isEditingProfile) {
        return (<>
        <EditProfile onBack={function () { return setIsEditingProfile(false); }} onSave={handleSaveProfile} userId={(user === null || user === void 0 ? void 0 : user.id) || ""} isSaving={isSaving} isSuccess={isSaveSuccess} initialData={{
                fullName: ((_b = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _b === void 0 ? void 0 : _b.full_name) || "",
                email: (user === null || user === void 0 ? void 0 : user.email) || signupEmail,
                phone: ((_c = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _c === void 0 ? void 0 : _c.phone) || "",
                whatsapp: ((_d = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _d === void 0 ? void 0 : _d.whatsapp) || "",
                location: ((_e = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _e === void 0 ? void 0 : _e.location) || "",
                address: ((_f = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _f === void 0 ? void 0 : _f.address) || "",
                avatarUrl: ((_g = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _g === void 0 ? void 0 : _g.avatar_url) || "",
                operatingHours: ((_h = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _h === void 0 ? void 0 : _h.operating_hours) || {
                    open: "08:00",
                    close: "20:00",
                },
            }}/>
        <SavingOverlay_1.SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess}/>
      </>);
    }
    if (!user) {
        return authView === "signin" ? (<SignIn onSignUpClick={function () { return setAuthView("signup"); }} onSuccess={function () { }}/>) : (<SignUp onSignInClick={function () { return setAuthView("signin"); }} onSuccess={function (email) {
                setSignupEmail(email);
                setIsVerifying(true);
            }}/>);
    }
    // BRANCH: Rider View
    if (role === "rider") {
        return (<>
        <LockedRiderMode onSwitchRole={handleSwitchRole} setIsSaving={setIsSaving} setIsSaveSuccess={setIsSaveSuccess}/>
        <SavingOverlay_1.SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess}/>
      </>);
    }
    // BRANCH: Customer View
    if (role === "customer") {
        return (<>
        <CustomerView shops={shops} menuItems={menuItems} cart={cart} setCart={setCart} onSwitchRole={handleSwitchRole} user={user}/>
        <SavingOverlay_1.SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess}/>
      </>);
    }
    var pendingOrdersCount = orders.filter(function (o) { return o.status === "pending"; }).length;
    var navItems = [
        { id: "dashboard", label: "Dashboard", icon: lucide_react_1.LayoutDashboard },
        { id: "menu", label: "Menu", icon: lucide_react_1.UtensilsCrossed },
        {
            id: "orders",
            label: "Orders",
            icon: lucide_react_1.ReceiptText,
            badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
        },
        { id: "riders", label: "Riders", icon: lucide_react_1.Bike },
        { id: "marketing", label: "Marketing", icon: lucide_react_1.Zap },
        { id: "coupons", label: "Coupons", icon: lucide_react_1.Ticket },
        { id: "payments", label: "Payments", icon: lucide_react_1.CreditCard },
        { id: "insights", label: "Insights", icon: lucide_react_1.TrendingUp },
        { id: "settings", label: "Settings", icon: lucide_react_1.Settings },
    ];
    return (<div className={cn("min-h-screen bg-surface selection:bg-primary-fixed selection:text-on-primary-fixed transition-colors duration-300", darkMode && "dark")}>
        {/* Existing Toaster */}
        <sonner_1.Toaster position="top-center" richColors theme={darkMode ? "dark" : "light"}/>
        <SavingOverlay_1.SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess}/>

        {isOffline && (<div className="fixed top-0 left-0 right-0 z-[100] bg-error text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
            <lucide_react_1.PauseCircle size={14}/>
            YOU ARE OFFLINE. Changes will be saved locally and synced when you
            reconnect.
          </div>)}

        {/* TopAppBar */}
        {!kitchenMode && (<header className="fixed top-0 w-full z-50 bg-white/70 dark:bg-surface-container-lowest/70 backdrop-blur-xl shadow-sm shadow-orange-900/5">
          <div className="flex justify-between items-center px-4 md:px-6 h-16 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <LocalEatsLogo_1.LocalEatsLogo width={160} height={42}/>
              <span className="text-[8px] font-bold text-primary/20 mt-4">
                v5.4
              </span>
            </div>

            <nav className="hidden md:flex flex-1 items-center gap-4 lg:gap-8 overflow-x-auto scrollbar-hide px-4 whitespace-nowrap scroll-smooth mx-4">
              {navItems.map(function (item) { return (<button key={item.id} onClick={function () { return setActiveTab(item.id); }} className={cn("px-3 py-1 rounded-lg transition-colors font-medium text-sm flex items-center gap-2 relative shrink-0", activeTab === item.id
                    ? "text-primary font-bold"
                    : "text-on-surface/60 hover:bg-surface-container-low dark:hover:bg-surface-container-high")}>
                  {item.label}
                  {item.badge && (<span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white animate-pulse">
                      {item.badge}
                    </span>)}
                </button>); })}
            </nav>

            <div className="flex items-center gap-1 md:gap-4 shrink-0">
              {currentShop && (<button onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                    var newStatus, error;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!currentShop)
                                    return [2 /*return*/];
                                newStatus = !currentShop.is_active;
                                // Optimistic update
                                setShops(function (prev) {
                                    return prev.map(function (s) {
                                        return s.id === currentShop.id ? __assign(__assign({}, s), { is_active: newStatus }) : s;
                                    });
                                });
                                return [4 /*yield*/, supabase
                                        .from("shops")
                                        .update({ is_active: newStatus })
                                        .eq("id", currentShop.id)];
                            case 1:
                                error = (_a.sent()).error;
                                if (!error) {
                                    sonner_1.toast.success("Shop is now ".concat(newStatus ? "Open" : "Closed"));
                                }
                                else {
                                    // Rollback on error
                                    setShops(function (prev) {
                                        return prev.map(function (s) {
                                            return s.id === currentShop.id ? __assign(__assign({}, s), { is_active: !newStatus }) : s;
                                        });
                                    });
                                    sonner_1.toast.error("Failed to update status: ".concat(error.message));
                                }
                                return [2 /*return*/];
                        }
                    });
                }); }} className={cn("flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs font-bold transition-all border", currentShop.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "bg-error/10 text-error border-error/20 hover:bg-error/20 shadow-lg shadow-error/10")}>
                  <div className={cn("w-2 h-2 rounded-full", currentShop.is_active
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-error")}/>
                  <span className="hidden xs:inline">
                    {currentShop.is_active ? "Open" : "Closed"}
                  </span>
                  <span className="hidden sm:inline ml-1 opacity-70">
                    {currentShop.is_active ? "• Accepting Orders" : "• Paused"}
                  </span>
                </button>)}
              <button onClick={function () {
                setSoundAlerts(!soundAlerts);
                if (!soundAlerts)
                    playNotificationSound();
            }} className={cn("p-2 transition-colors relative group", soundAlerts ? "text-primary" : "text-on-surface-variant/40")} title={soundAlerts ? "Mute Order Alerts" : "Unmute Order Alerts"}>
                {soundAlerts ? (<lucide_react_1.Bell size={18} className="md:w-5 md:h-5"/>) : (<lucide_react_1.BellOff size={18} className="md:w-5 md:h-5"/>)}
              </button>
              <button onClick={function () { return setDarkMode(!darkMode); }} className="p-2 text-on-surface-variant hover:text-primary transition-colors" title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
                {darkMode ? (<lucide_react_1.Sun size={18} className="md:w-5 md:h-5"/>) : (<lucide_react_1.Moon size={18} className="md:w-5 md:h-5"/>)}
              </button>
              <button onClick={function () { return setIsEditingProfile(true); }} className="p-2 text-on-surface-variant hover:text-primary transition-colors" title="Edit Profile">
                <lucide_react_1.User size={18} className="md:w-5 md:h-5"/>
              </button>
              <button onClick={handleSignOut} className="p-2 text-on-surface-variant hover:text-primary transition-colors" title="Sign Out">
                <lucide_react_1.LogOut size={18} className="md:w-5 md:h-5"/>
              </button>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/10 shadow-sm">
                {((_j = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _j === void 0 ? void 0 : _j.avatar_url) ? (<img alt="Profile" className="w-full h-full object-cover" src={user.user_metadata.avatar_url} referrerPolicy="no-referrer"/>) : (<div className="w-full h-full flex items-center justify-center bg-primary" style={{
                    background: "radial-gradient(circle at 30% 30%, #ff9d4d 0%, #f58220 100%)",
                }}>
                    <lucide_react_1.User size={20} className="text-white drop-shadow-sm" strokeWidth={2.5}/>
                  </div>)}
              </div>
            </div>
          </div>
        </header>)}

      <main className={cn("px-4 md:px-6 max-w-7xl mx-auto", kitchenMode ? "pt-6 pb-6" : "pt-20 md:pt-24 pb-32")}>
        <react_2.AnimatePresence mode="wait">
          <react_2.motion.div key={activeTab} initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.98 }} transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
        }}>
            {activeTab === "dashboard" && (<DashboardOverview orders={orders} loading={loading} shops={shops} user={user} onNavigate={setActiveTab} onRefresh={function () {
                fetchShops();
                fetchOrders();
                fetchAllMenuItems();
            }} onEditProfile={function () { return setIsEditingProfile(true); }} menuItems={menuItems} trialInfo={trialInfo} currentShop={currentShop} darkMode={darkMode}/>)}
            {activeTab === "menu" && (<MenuManagement shops={shops} loading={loading} user={user} onRefreshMenu={function () {
                fetchAllMenuItems();
                fetchShops();
            }} setIsSaving={setIsSaving} setIsSaveSuccess={setIsSaveSuccess}/>)}
            {activeTab === "orders" && (<OrdersManagement orders={orders} onUpdateStatus={updateOrderStatus} onDeleteAllOrders={deleteAllOrders} loading={loading} onRefresh={fetchOrders} kitchenMode={kitchenMode} setKitchenMode={setKitchenMode} soundAlerts={soundAlerts} setSoundAlerts={setSoundAlerts} onRequestRider={requestRider} onUnassignRider={unassignRider} onTabChange={setActiveTab} sendRiderNudge={sendRiderNudge} currentShop={currentShop}/>)}
            {activeTab === "marketing" && (<Marketing currentShop={currentShop}/>)}
            {activeTab === "coupons" && (<Coupons currentShop={currentShop} orders={orders}/>)}
            {activeTab === "insights" && (<Insights orders={orders} menuItems={menuItems} loading={loading} currentShop={currentShop}/>)}
            {activeTab === "riders" && currentShop && (<RiderManagement currentShop={currentShop} orders={orders} onRequestRider={requestRider} sendRiderNudge={sendRiderNudge} user={user}/>)}
            {activeTab === "payments" && currentShop && (<PaymentHistory shopId={currentShop.id}/>)}
            {activeTab === "settings" && (<div className="max-w-2xl mx-auto space-y-8">
                <header className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
                      Settings
                    </h2>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">
                      v2.1
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant font-medium">
                    Manage your account and storefront preferences.
                  </p>
                </header>

                <div className="space-y-4">
                  <button onClick={function () { return setActiveTab("storefront"); }} className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 p-5 bg-primary/5 hover:bg-primary/10 rounded-2xl transition-all border border-primary/20 group shadow-sm shadow-primary/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                        <lucide_react_1.Store size={20}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Storefront Profile
                        </p>
                        <p className="text-xs text-on-surface-variant line-clamp-1 md:line-clamp-none">
                          Update your shop name, logo, and cover photo.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <span className="text-[10px] items-center font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                        New Location
                      </span>
                      <lucide_react_1.ChevronRight size={18} className="text-on-surface-variant/40"/>
                    </div>
                  </button>

                  <button onClick={function () { return setIsEditingProfile(true); }} className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <lucide_react_1.User size={20}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Edit Profile
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Change your name, email, and photo.
                        </p>
                      </div>
                    </div>
                    <lucide_react_1.ChevronRight size={18} className="text-on-surface-variant/40"/>
                  </button>

                  <button onClick={function () {
                return sonner_1.toast.info("Staff Accounts coming soon!", {
                    description: "You will be able to add staff members with limited access (e.g., cannot view revenue or delete menu items).",
                });
            }} className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <lucide_react_1.Users size={20}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Staff Accounts
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Manage roles and permissions for your team.
                        </p>
                      </div>
                    </div>
                    <lucide_react_1.ChevronRight size={18} className="text-on-surface-variant/40"/>
                  </button>

                  <a href="https://rider.localeatssa.co.za/" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-5 bg-blue-500/5 hover:bg-blue-500/10 rounded-2xl transition-all border border-blue-500/20 group shadow-sm shadow-blue-500/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <lucide_react_1.Bike size={24}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Rider Marketplace
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Access the dedicated platform for deliveries and
                          missions.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-blue-500/60 bg-blue-500/10 px-2 py-0.5 rounded-md">
                        External
                      </span>
                      <lucide_react_1.ExternalLink size={18} className="text-blue-500"/>
                    </div>
                  </a>

                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-primary/10 flex items-center justify-center text-primary">
                        <lucide_react_1.Bell size={20}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Sound Alerts
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Play a sound when new orders arrive.
                        </p>
                      </div>
                    </div>
                    <button onClick={function () { return setSoundAlerts(!soundAlerts); }} className={cn("w-12 h-6 rounded-full transition-all relative", soundAlerts ? "bg-primary" : "bg-outline-variant")}>
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", soundAlerts ? "left-7" : "left-1")}/>
                    </button>
                  </div>

                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                        <lucide_react_1.Bell size={20}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Push Notifications
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Get browser alerts even when the app is closed.
                        </p>
                      </div>
                    </div>
                    <button onClick={function () {
                if (!pushEnabled) {
                    requestPushPermissions();
                }
                else {
                    sonner_1.toast.info("To disable push notifications, please change your browser settings.");
                }
            }} className={cn("w-12 h-6 rounded-full transition-all relative", pushEnabled ? "bg-primary" : "bg-outline-variant")}>
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", pushEnabled ? "left-7" : "left-1")}/>
                    </button>
                  </div>

                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                        {darkMode ? <lucide_react_1.Moon size={20}/> : <lucide_react_1.Sun size={20}/>}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Dark Mode</p>
                        <p className="text-xs text-on-surface-variant">
                          Toggle between light and dark themes.
                        </p>
                      </div>
                    </div>
                    <button onClick={function () { return setDarkMode(!darkMode); }} className={cn("w-12 h-6 rounded-full transition-all relative", darkMode ? "bg-primary" : "bg-outline-variant")}>
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", darkMode ? "left-7" : "left-1")}/>
                    </button>
                  </div>

                  <button onClick={handleSignOut} className="w-full flex items-center justify-between p-5 bg-error/5 hover:bg-error/10 rounded-2xl transition-all border border-error/10 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error group-hover:scale-110 transition-transform">
                        <lucide_react_1.LogOut size={20}/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-error">Sign Out</p>
                        <p className="text-xs text-error/60">
                          Logout from your account.
                        </p>
                      </div>
                    </div>
                    <lucide_react_1.ChevronRight size={18} className="text-error/40"/>
                  </button>
                </div>
              </div>)}
            {activeTab === "storefront" && (<div className="max-w-3xl mx-auto">
                <button onClick={function () { return setActiveTab("settings"); }} className="mb-6 flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
                  <lucide_react_1.ChevronRight className="rotate-180" size={16}/>
                  Back to Settings
                </button>
                {currentShop ? (<ShopProfile shop={currentShop} onRefresh={fetchShops} user={user} setIsSaving={setIsSaving} setIsSaveSuccess={setIsSaveSuccess} isSaving={isSaving} isSuccess={isSaveSuccess} onFinished={function () { return setActiveTab("dashboard"); }}/>) : (<div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                      <lucide_react_1.Store className="text-on-surface-variant" size={32}/>
                    </div>
                    <p className="text-on-surface-variant font-medium">
                      Please create a shop first to edit your storefront.
                    </p>
                  </div>)}
              </div>)}
          </react_2.motion.div>
        </react_2.AnimatePresence>
      </main>

      {/* Floating Help Button */}
      <button onClick={function () { return setShowHelp(true); }} className="fixed bottom-24 md:bottom-8 right-6 z-[60] w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group" title="Help & Tips">
        <lucide_react_1.HelpCircle size={28} className="group-hover:rotate-12 transition-transform"/>
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-surface-container-highest text-on-surface text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-outline-variant/10">
          Need help?
        </span>
      </button>

      {/* Help Modal */}
      <react_2.AnimatePresence>
        {showHelp && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <react_2.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={function () { return setShowHelp(false); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
            <react_2.motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/10">
              <div className="p-6 md:p-8 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide">
                <header className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                      <lucide_react_1.Sparkles size={20}/>
                      <span className="text-xs font-black uppercase tracking-widest">
                        Guide
                      </span>
                    </div>
                    <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">
                      How LocalEats Works
                    </h2>
                  </div>
                  <button onClick={function () { return setShowHelp(false); }} className="p-2 hover:bg-surface-container rounded-full transition-colors">
                    <lucide_react_1.X size={24}/>
                  </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                {
                    title: "Dashboard",
                    desc: "Your command center. Track total sales, order volume, and follower growth at a glance.",
                    icon: lucide_react_1.LayoutDashboard,
                    color: "text-blue-500 bg-blue-50",
                },
                {
                    title: "Menu Management",
                    desc: "Add items, set prices, and upload mouth-watering photos. Toggle availability instantly.",
                    icon: lucide_react_1.UtensilsCrossed,
                    color: "text-orange-500 bg-orange-50",
                },
                {
                    title: "Real-time Orders",
                    desc: "Never miss a beat. Orders pop up instantly with sound alerts. Use Kitchen Mode for focus.",
                    icon: lucide_react_1.ReceiptText,
                    color: "text-green-500 bg-green-50",
                },
                {
                    title: "Marketing & Coupons",
                    desc: "Grow your reach. Create discount codes and use AI to craft perfect campaigns.",
                    icon: lucide_react_1.Zap,
                    color: "text-purple-500 bg-purple-50",
                },
                {
                    title: "Insights",
                    desc: "Understand your customers. View reviews and analyze performance trends.",
                    icon: lucide_react_1.TrendingUp,
                    color: "text-indigo-500 bg-indigo-50",
                },
                {
                    title: "Storefront",
                    desc: "Customize how customers see your shop. Update your bio, location, and social links.",
                    icon: lucide_react_1.Store,
                    color: "text-pink-500 bg-pink-50",
                },
            ].map(function (tip, i) { return (<div key={i} className="flex gap-4 p-4 rounded-2xl border border-outline-variant/5 hover:border-primary/20 transition-colors group">
                      <div className={cn("w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", tip.color)}>
                        <tip.icon size={24}/>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-on-surface">
                          {tip.title}
                        </h3>
                        <p className="text-sm text-on-surface-variant leading-relaxed">
                          {tip.desc}
                        </p>
                      </div>
                    </div>); })}
                </div>

                <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 space-y-3">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <lucide_react_1.Rocket size={18}/>
                    Pro Tip
                  </h4>
                  <p className="text-sm text-on-surface-variant">
                    Enable <b>Sound Alerts</b> in Settings to ensure you hear
                    every new order even when the tab is in the background.
                  </p>
                </div>

                <button onClick={function () { return setShowHelp(false); }} className="w-full py-4 bg-primary text-on-primary font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-[0.99] active:scale-95 transition-all">
                  Got it, let's go!
                </button>
              </div>
            </react_2.motion.div>
          </div>)}
      </react_2.AnimatePresence>

      {/* BottomNavBar */}
      {!kitchenMode && (<nav className="md:hidden fixed bottom-0 left-0 w-full z-[100] bg-white/80 dark:bg-surface-container-lowest/80 backdrop-blur-2xl rounded-t-3xl border-t border-outline-variant/10 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-1 px-3 pb-8 pt-4 overflow-x-auto scrollbar-hide">
            {navItems.map(function (item) {
                var isActive = activeTab === item.id;
                return (<button key={item.id} onClick={function () { return setActiveTab(item.id); }} className={cn("flex flex-col items-center justify-center min-w-[70px] shrink-0 py-2 rounded-2xl transition-all duration-300 relative group", isActive
                        ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105"
                        : "text-on-surface-variant/60 hover:text-primary")}>
                  <div className={cn("relative", isActive ? "scale-110" : "group-active:scale-95 transition-transform")}>
                    <item.icon size={20} className={cn(isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")}/>
                    {item.badge && (<span className={cn("absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black border-2 border-white dark:border-zinc-950", isActive ? "bg-white text-primary" : "bg-primary text-white")}>
                        {item.badge}
                      </span>)}
                  </div>
                  <span className={cn("text-[8px] uppercase tracking-widest font-black mt-1.5", isActive ? "text-white" : "text-inherit")}>
                    {item.label === "Dashboard" ? "Home" : item.label}
                  </span>
                </button>);
            })}
          </div>
        </nav>)}

      {/* Update Notifier Floating Button */}
      <react_2.AnimatePresence>
        {updateAvailable && (<react_2.motion.div initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="fixed bottom-24 md:bottom-8 left-6 z-[60]">
            <button onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                var registrations, _i, registrations_1, registration, keys, _a, keys_1, key, e_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 11, , 12]);
                            if (!("serviceWorker" in navigator)) return [3 /*break*/, 5];
                            return [4 /*yield*/, navigator.serviceWorker.getRegistrations()];
                        case 1:
                            registrations = _b.sent();
                            _i = 0, registrations_1 = registrations;
                            _b.label = 2;
                        case 2:
                            if (!(_i < registrations_1.length)) return [3 /*break*/, 5];
                            registration = registrations_1[_i];
                            return [4 /*yield*/, registration.unregister()];
                        case 3:
                            _b.sent();
                            _b.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            if (!("caches" in window)) return [3 /*break*/, 10];
                            return [4 /*yield*/, caches.keys()];
                        case 6:
                            keys = _b.sent();
                            _a = 0, keys_1 = keys;
                            _b.label = 7;
                        case 7:
                            if (!(_a < keys_1.length)) return [3 /*break*/, 10];
                            key = keys_1[_a];
                            return [4 /*yield*/, caches.delete(key)];
                        case 8:
                            _b.sent();
                            _b.label = 9;
                        case 9:
                            _a++;
                            return [3 /*break*/, 7];
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            e_1 = _b.sent();
                            console.error("Force reload error:", e_1);
                            return [3 /*break*/, 12];
                        case 12:
                            // Force reload without cache
                            window.location.href =
                                window.location.origin +
                                    window.location.pathname +
                                    "?v=" +
                                    Date.now();
                            return [2 /*return*/];
                    }
                });
            }); }} className="bg-[#FF5400] text-white px-5 py-3 rounded-full shadow-2xl shadow-orange-500/60 flex items-center gap-3 hover:scale-105 active:scale-95 border-2 border-white/20 transition-all font-body animate-pulse ring-4 ring-orange-500/20">
              <div className="relative">
                <lucide_react_1.RefreshCw size={18} className="animate-spin"/>
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">
                  New update (Checked {lastCheckTime})
                </p>
                <p className="text-sm font-bold leading-none">
                  Refresh to See Changes
                </p>
              </div>
            </button>
          </react_2.motion.div>)}
      </react_2.AnimatePresence>
      <SavingOverlay_1.SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess}/>
    </div>);
}
// --- Customer Experience Components ---
var CustomerView = function (_a) {
    var shops = _a.shops, menuItems = _a.menuItems, cart = _a.cart, setCart = _a.setCart, onSwitchRole = _a.onSwitchRole, user = _a.user;
    var _b = (0, react_1.useState)(false), showCheckout = _b[0], setShowCheckout = _b[1];
    var _c = (0, react_1.useState)(""), searchQuery = _c[0], setSearchQuery = _c[1];
    var _d = (0, react_1.useState)([]), customerOrders = _d[0], setCustomerOrders = _d[1];
    var fetchCustomerOrders = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .select("*")
                            .eq("user_id", user.id)
                            .order("created_at", { ascending: false })
                            .limit(5)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (data && !error) {
                        setCustomerOrders(data);
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [user]);
    (0, react_1.useEffect)(function () {
        var init = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetchCustomerOrders()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        void init();
        if (!user)
            return;
        // Request notification permission if not already granted
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
        var channel = supabase
            .channel("customer_orders_".concat(user.id, "_changes"))
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "orders",
            filter: "user_id=eq.".concat(user.id),
        }, function (payload) {
            fetchCustomerOrders();
            var newRecord = payload.new;
            var oldRecord = payload.old;
            if (oldRecord && oldRecord.status !== "ready" && newRecord.status === "ready") {
                sonner_1.toast.success("Your order is ready and is being prepared for delivery/dispatch!");
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Order Ready!", {
                        body: "Your order is ready and is being prepared for delivery/dispatch.",
                        icon: "/favicon.png",
                    });
                }
            }
        })
            .subscribe();
        return function () {
            supabase.removeChannel(channel);
        };
    }, [user, fetchCustomerOrders]);
    var addToCart = function (item) {
        setCart(function (prev) {
            var existing = prev.find(function (i) { return i.item.id === item.id; });
            if (existing) {
                return prev.map(function (i) {
                    return i.item.id === item.id ? __assign(__assign({}, i), { quantity: i.quantity + 1 }) : i;
                });
            }
            return __spreadArray(__spreadArray([], prev, true), [{ item: item, quantity: 1 }], false);
        });
        sonner_1.toast.success("".concat(item.name, " added to cart!"));
    };
    var subtotal = cart.reduce(function (acc, curr) { return acc + curr.item.price * curr.quantity; }, 0);
    return (<div className="min-h-screen bg-surface font-body text-on-surface pb-32">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-6 h-16 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <LocalEatsLogo_1.LocalEatsLogo width={120} height={32}/>
            <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">
              Beta
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onSwitchRole} className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors">
              Merchant Mode
            </button>
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <lucide_react_1.User size={20} className="text-on-surface-variant"/>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-7xl mx-auto">
        <section className="mb-10">
          <h1 className="text-3xl font-headline font-black tracking-tight mb-2">
            Hungry?
          </h1>
          <p className="text-on-surface-variant mb-6">
            R5 Flat-Rate Delivery on all orders.
          </p>

          <div className="relative group">
            <lucide_react_1.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={20}/>
            <input type="text" placeholder="Search for kotas, burgers, or shops..." className="w-full h-14 bg-surface-container-low border-none rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-base" value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }}/>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems
            .filter(function (item) {
            return item.name.toLowerCase().includes(searchQuery.toLowerCase());
        })
            .map(function (item) { return (<react_2.motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10 shadow-sm hover:shadow-xl transition-all group">
                <div className="h-48 relative overflow-hidden bg-surface-container">
                  <img src={item.image_url || DEFAULT_MENU_IMAGE} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                  {isPlaceholderImage(item.image_url) && (<div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                      <lucide_react_1.UtensilsCrossed size={48} className="text-white/30"/>
                    </div>)}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">
                    <span className="text-sm font-black text-primary">
                      R {item.price.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{item.name}</h3>
                    <p className="text-xs text-on-surface-variant line-clamp-2">
                      {item.description || "Fresh and hot from the kitchen."}
                    </p>
                  </div>
                  <button onClick={function () { return addToCart(item); }} className="w-full h-12 bg-surface-container-low hover:bg-primary hover:text-white transition-all rounded-xl font-bold flex items-center justify-center gap-2 group">
                    <lucide_react_1.Plus size={18}/>
                    <span>Add to Order</span>
                  </button>
                </div>
              </react_2.motion.div>); })}
        </section>

        {customerOrders.length > 0 && (<section className="mt-16 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-headline font-black tracking-tight flex items-center gap-2">
                <lucide_react_1.ReceiptText size={24} className="text-primary"/>
                Recent Orders
              </h2>
            </div>
            <div className="space-y-4">
              {customerOrders.map(function (order) {
                var shop = shops.find(function (s) { return s.id === order.shop_id; });
                return (<react_2.motion.div key={order.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 font-black">
                        {order.status[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-on-surface">
                            {order.product_name}
                          </p>
                          <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full", order.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                        order.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary')}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium">
                          {(shop === null || shop === void 0 ? void 0 : shop.name) || "Local Shop"} • R {order.total_price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(shop === null || shop === void 0 ? void 0 : shop.phone) && (<a href={"tel:".concat(shop.phone)} className="flex-1 md:flex-none h-10 px-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-outline-variant/10 text-on-surface">
                          <lucide_react_1.Phone size={14}/>
                          Call
                        </a>)}
                      {(shop === null || shop === void 0 ? void 0 : shop.whatsapp) && (<a href={"https://wa.me/".concat(shop.whatsapp.replace(/\D/g, ""))} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none h-10 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-emerald-500/20">
                          <lucide_react_1.MessageCircle size={14}/>
                          WhatsApp
                        </a>)}
                    </div>
                  </react_2.motion.div>);
            })}
            </div>
          </section>)}
      </main>

      <react_2.AnimatePresence>
        {cart.length > 0 && !showCheckout && (<react_2.motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-48px)] max-w-lg">
            <button onClick={function () { return setShowCheckout(true); }} className="w-full h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-between px-8 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="bg-on-primary/20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">
                  {cart.length}
                </div>
                <span className="font-bold">View Order</span>
              </div>
              <span className="font-black text-xl">R {subtotal.toFixed(2)}</span>
            </button>
          </react_2.motion.div>)}
      </react_2.AnimatePresence>

      <react_2.AnimatePresence>
        {showCheckout && (<CustomerCheckout cart={cart} subtotal={subtotal} onClose={function () { return setShowCheckout(false); }} user={user} onOrderPlaced={function () {
                setCart([]);
                setShowCheckout(false);
            }} setIsSaving={setIsSaving} setIsSaveSuccess={setIsSaveSuccess}/>)}
      </react_2.AnimatePresence>
    </div>);
};
var CustomerCheckout = function (_a) {
    var _b;
    var cart = _a.cart, subtotal = _a.subtotal, onClose = _a.onClose, user = _a.user, onOrderPlaced = _a.onOrderPlaced, setIsSaving = _a.setIsSaving, setIsSaveSuccess = _a.setIsSaveSuccess;
    var _c = (0, react_1.useState)(""), address = _c[0], setAddress = _c[1];
    var _d = (0, react_1.useState)("Tembisa"), city = _d[0], setCity = _d[1];
    var _e = (0, react_1.useState)(((_b = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _b === void 0 ? void 0 : _b.phone) || ""), phone = _e[0], setPhone = _e[1];
    var _f = (0, react_1.useState)(null), coords = _f[0], setCoords = _f[1];
    var _g = (0, react_1.useState)(null), shopCoords = _g[0], setShopCoords = _g[1];
    var total = subtotal + FLAT_DELIVERY_FEE;
    (0, react_1.useEffect)(function () {
        var fetchShopCoords = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!cart[0])
                            return [2 /*return*/];
                        return [4 /*yield*/, supabase
                                .from("shops")
                                .select("lat, lng")
                                .eq("id", cart[0].item.shop_id)
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (data && !error) {
                            setShopCoords({ lat: data.lat || -25.9964, lng: data.lng || 28.2268 }); // Default Tembisa center if null
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        void fetchShopCoords();
    }, [cart]);
    var distance = (0, react_1.useMemo)(function () {
        if (coords && shopCoords) {
            return calculateDistance(coords.lat, coords.lng, shopCoords.lat, shopCoords.lng);
        }
        return null;
    }, [coords, shopCoords]);
    var handlePlaceOrder = function () { return __awaiter(void 0, void 0, void 0, function () {
        var cleanedPhone, orderData, error;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!user) {
                        sonner_1.toast.error("Please sign in to place an order");
                        return [2 /*return*/];
                    }
                    if (!address || !coords) {
                        sonner_1.toast.error("Please select a valid delivery address");
                        return [2 /*return*/];
                    }
                    cleanedPhone = phone.replace(/[\s-]/g, "");
                    if (!/^(?:\+27|0)[0-9]{9}$/.test(cleanedPhone)) {
                        sonner_1.toast.error("Please enter a valid South African phone number (e.g., +27 82 123 4567 or 082 123 4567).");
                        return [2 /*return*/];
                    }
                    if (distance && distance > 10) {
                        sonner_1.toast.error("Delivery distance exceeded", {
                            description: "Your location is too far for the R5 Flat Rate fee.",
                        });
                        return [2 /*return*/];
                    }
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    orderData = {
                        user_id: user.id,
                        shop_id: cart[0].item.shop_id,
                        customer_name: ((_a = user.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Guest",
                        product_name: cart.length === 1 ? cart[0].item.name : "".concat(cart.length, " items"),
                        items: cart.map(function (i) { return ({
                            name: i.item.name,
                            price: i.item.price,
                            quantity: i.quantity,
                        }); }),
                        total_price: total,
                        price: total,
                        delivery_fee: FLAT_DELIVERY_FEE,
                        status: "pending",
                        order_type: "delivery",
                        created_at: new Date().toISOString(),
                        address: address,
                        phone: phone,
                        city: city,
                        lat: coords.lat,
                        lng: coords.lng,
                    };
                    return [4 /*yield*/, supabase.from("orders").insert(orderData)];
                case 1:
                    error = (_b.sent()).error;
                    if (error) {
                        setIsSaving(false);
                        setIsSaveSuccess(false);
                        sonner_1.toast.error("We couldn't process your order right now. Please try again later.");
                    }
                    else {
                        setIsSaving(false);
                        setIsSaveSuccess(true);
                        setTimeout(function () {
                            setIsSaveSuccess(false);
                            sonner_1.toast.success("Order placed successfully!", {
                                description: "Your R5.00 delivery mission has been broadcasted.",
                            });
                            onOrderPlaced();
                        }, 1500);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    return (<div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      <react_2.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <react_2.motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-xl bg-surface-container-lowest rounded-t-[32px] md:rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/10">
        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
          <header className="flex justify-between items-center">
            <h2 className="text-2xl font-headline font-black tracking-tight">
              Checkout
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full">
              <lucide_react_1.X size={24}/>
            </button>
          </header>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                Delivery Details
              </h3>
              <AddressAutocomplete value={address} onChange={setAddress} placeholder="Type your street address in Tembisa..." onSelect={function (formatted, cityName, lat, lng) {
            setAddress(formatted);
            setCity(cityName);
            setCoords({ lat: lat, lng: lng });
        }}/>

              {coords && (<div className="w-full h-40 rounded-2xl overflow-hidden border border-outline-variant/10 shadow-inner z-0">
                  <LeafletMap center={coords} zoom={15} onLocationSelect={function (lat, lng) {
                setCoords({ lat: lat, lng: lng });
                // Reverse geocode when pin moves
                fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=".concat(lat, "&lon=").concat(lng, "&email=aviwenotununu4@gmail.com"))
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                    if (data && data.display_name) {
                        setAddress(data.display_name);
                    }
                })
                    .catch(function () { });
            }}/>
                </div>)}

              <div className="relative">
                <lucide_react_1.Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18}/>
                <input type="tel" placeholder="Contact number for Rider" value={phone} onChange={function (e) {
            var result = formatSAPhone(e.target.value);
            setPhone(result.formatted);
        }} className="w-full h-14 bg-surface-container-low border border-outline-variant/10 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-base"/>
              </div>

              {distance !== null && (<div className={cn("p-4 rounded-2xl flex items-center justify-between border", distance > 10
                ? "bg-error/5 border-error/20 text-error"
                : "bg-green-500/5 border-green-500/20 text-green-600")}>
                  <div className="flex items-center gap-3">
                    <lucide_react_1.Bike size={18}/>
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Distance to Store
                    </span>
                  </div>
                  <span className="font-black">
                    {distance.toFixed(1)} km
                    {distance > 10 && " (Too Far)"}
                  </span>
                </div>)}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                Order Items
              </h3>
              <div className="space-y-2">
                {cart.map(function (item, idx) { return (<div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low/50 border border-outline-variant/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container overflow-hidden">
                        <img src={item.item.image_url || DEFAULT_MENU_IMAGE} alt={item.item.name} className="w-full h-full object-cover"/>
                      </div>
                      <span className="text-sm font-bold">
                        {item.quantity}x {item.item.name}
                      </span>
                    </div>
                    <span className="font-black text-sm">
                      R {(item.item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>); })}
              </div>
            </div>

            <div className="space-y-4 border-t border-outline-variant/20 pt-8">
              <div className="flex justify-between items-center text-on-surface-variant font-medium">
                <span>Subtotal</span>
                <span>R {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-primary font-bold">
                <div className="flex items-center gap-2">
                  <span>Delivery Fee</span>
                  <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                    <lucide_react_1.Sparkles size={10}/> Deal
                  </span>
                </div>
                <span>R {FLAT_DELIVERY_FEE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-black pt-4 border-t border-outline-variant/10">
                <span>Total</span>
                <span className="text-primary">R {total.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handlePlaceOrder} disabled={loading || (distance !== null && distance > 10)} className="w-full h-16 bg-primary text-on-primary font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[0.99] active:scale-95 transition-all text-lg disabled:opacity-50">
              {loading ? "Processing..." : "Confirm & Pay"}
            </button>

            <p className="text-[10px] text-center text-on-surface-variant/60 font-medium italic">
              * LocalEats R5 delivery valid within a 10km radius of the
              merchant.
            </p>
          </div>
        </div>
      </react_2.motion.div>
    </div>);
};
var LockedRiderMode = function (_a) {
    var _b, _c, _d;
    var onSwitchRole = _a.onSwitchRole, setIsSaving = _a.setIsSaving, setIsSaveSuccess = _a.setIsSaveSuccess;
    var _e = (0, react_1.useState)(null), riderProfile = _e[0], setRiderProfile = _e[1];
    var _f = (0, react_1.useState)(true), loading = _f[0], setLoading = _f[1];
    var _g = (0, react_1.useState)([]), activeMissions = _g[0], setActiveMissions = _g[1];
    var _h = (0, react_1.useState)([]), availableMissions = _h[0], setAvailableMissions = _h[1];
    var _j = (0, react_1.useState)([]), onlineRiders = _j[0], setOnlineRiders = _j[1];
    var _k = (0, react_1.useState)(undefined), riderCoords = _k[0], setRiderCoords = _k[1];
    var _l = (0, react_1.useState)([]), activeConnections = _l[0], setActiveConnections = _l[1];
    var _m = (0, react_1.useState)(false), showPairingModal = _m[0], setShowPairingModal = _m[1];
    var _o = (0, react_1.useState)(""), pairingCode = _o[0], setPairingCode = _o[1];
    var _p = (0, react_1.useState)(false), isPairing = _p[0], setIsPairing = _p[1];
    var fetchRiderData = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, profile, newProfile, active, available, riders, connections;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, supabase.auth.getUser()];
                case 1:
                    user = (_c.sent()).data.user;
                    if (!user)
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase
                            .from("rider_profiles")
                            .select("*")
                            .eq("id", user.id)
                            .maybeSingle()];
                case 2:
                    profile = (_c.sent()).data;
                    if (!profile) return [3 /*break*/, 3];
                    setRiderProfile(profile);
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, supabase
                        .from("rider_profiles")
                        .insert({
                        id: user.id,
                        is_online: false,
                        status: "offline",
                        phone: ((_a = user.user_metadata) === null || _a === void 0 ? void 0 : _a.phone) || "",
                        full_name: ((_b = user.user_metadata) === null || _b === void 0 ? void 0 : _b.full_name) || ""
                    })
                        .select()
                        .single()];
                case 4:
                    newProfile = (_c.sent()).data;
                    if (newProfile)
                        setRiderProfile(newProfile);
                    _c.label = 5;
                case 5: return [4 /*yield*/, supabase
                        .from("orders")
                        .select("*")
                        .eq("rider_id", user.id)
                        .not("delivery_status", "eq", "delivered")
                        .order("created_at", { ascending: false })];
                case 6:
                    active = (_c.sent()).data;
                    if (active)
                        setActiveMissions(active);
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .select("*")
                            .eq("delivery_status", "finding_rider")
                            .or("status.eq.accepted,status.eq.preparing")
                            .order("created_at", { ascending: false })];
                case 7:
                    available = (_c.sent()).data;
                    if (available)
                        setAvailableMissions(available);
                    return [4 /*yield*/, supabase
                            .from("rider_profiles")
                            .select("*")
                            .eq("is_online", true)
                            .limit(10)];
                case 8:
                    riders = (_c.sent()).data;
                    if (riders)
                        setOnlineRiders(riders);
                    return [4 /*yield*/, supabase
                            .from("rider_connections")
                            .select("\n        *,\n        shops:shop_id (\n          name,\n          logo_url\n        )\n      ")
                            .eq("rider_id", user.id)
                            .eq("status", "active")
                            .gt("expires_at", new Date().toISOString())];
                case 9:
                    connections = (_c.sent()).data;
                    if (connections)
                        setActiveConnections(connections);
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); }, []);
    (0, react_1.useEffect)(function () {
        var initRider = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetchRiderData()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        void initRider();
        // Geolocation Tracking (Note: Background tracking normally requires a ServiceWorker or Native App Wrapper)
        var watchId;
        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(function (pos) {
                var _a = pos.coords, latitude = _a.latitude, longitude = _a.longitude;
                setRiderCoords([latitude, longitude]);
                // Throttled DB update, only if online
                void (function () { return __awaiter(void 0, void 0, void 0, function () {
                    var user;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, supabase.auth.getUser()];
                            case 1:
                                user = (_a.sent()).data.user;
                                if (!user) return [3 /*break*/, 3];
                                return [4 /*yield*/, supabase.from("rider_profiles").update({
                                        current_latitude: latitude,
                                        current_longitude: longitude,
                                        updated_at: new Date().toISOString()
                                    }).eq("id", user.id).eq("is_online", true)];
                            case 2:
                                _a.sent(); // Only update coordinates if they are marked online!
                                _a.label = 3;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); })();
            }, function (err) {
                console.error("Geo error:", err);
                sonner_1.toast.error("Location tracking disabled. Ensure GPS is on.");
            }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 });
        }
        // Listen for changes in orders, profile and online status
        var ordersSubscription = supabase
            .channel("rider_dashboard_orders")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, function (payload) {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                var order = payload.new;
                // Notify if a new mission is looking for a rider
                if (order.delivery_status === 'finding_rider' && payload.eventType === 'INSERT') {
                    sonner_1.toast.info("🚨 New Mission Broadcast!", { description: "Tap to view in Available Missions", duration: 5000 });
                    // Play a sound if available
                    var audio = new Audio('/notification.mp3');
                    audio.play().catch(function () { });
                }
            }
            void fetchRiderData();
        })
            .subscribe();
        var profileSubscription = supabase
            .channel("rider_dashboard_profiles")
            .on("postgres_changes", { event: "*", schema: "public", table: "rider_profiles" }, function () { void fetchRiderData(); })
            .subscribe();
        var connectionsSubscription = supabase
            .channel("rider_dashboard_connections")
            .on("postgres_changes", { event: "*", schema: "public", table: "rider_connections" }, function () { void fetchRiderData(); })
            .subscribe();
        return function () {
            if (watchId)
                navigator.geolocation.clearWatch(watchId);
            supabase.removeChannel(ordersSubscription);
            supabase.removeChannel(profileSubscription);
            supabase.removeChannel(connectionsSubscription);
        };
    }, [fetchRiderData]);
    var toggleOnline = function () { return __awaiter(void 0, void 0, void 0, function () {
        var newStatus, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!riderProfile)
                        return [2 /*return*/];
                    newStatus = !riderProfile.is_online;
                    return [4 /*yield*/, supabase
                            .from("rider_profiles")
                            .update({
                            is_online: newStatus,
                            status: newStatus ? "online" : "offline",
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", riderProfile.id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        sonner_1.toast.error("Failed to update status");
                    }
                    else {
                        sonner_1.toast.success(newStatus ? "You are now ONLINE" : "You are now OFFLINE");
                        fetchRiderData();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var acceptMission = function (orderId) { return __awaiter(void 0, void 0, void 0, function () {
        var user, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase.auth.getUser()];
                case 1:
                    user = (_a.sent()).data.user;
                    if (!user || !(riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online)) {
                        sonner_1.toast.error((riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online) ? "Auth error" : "Go online to accept missions");
                        return [2 /*return*/];
                    }
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .update({
                            rider_id: user.id,
                            delivery_status: "accepted",
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", orderId)
                            .eq("delivery_status", "finding_rider")];
                case 2:
                    error = (_a.sent()).error;
                    if (error) {
                        setIsSaving(false);
                        setIsSaveSuccess(false);
                        sonner_1.toast.error("Failed to accept mission: " + error.message);
                    }
                    else {
                        setIsSaving(false);
                        setIsSaveSuccess(true);
                        setTimeout(function () {
                            setIsSaveSuccess(false);
                            sonner_1.toast.success("Mission Accepted!");
                            fetchRiderData();
                        }, 1500);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var updateMissionStatus = function (orderId, currentStatus) { return __awaiter(void 0, void 0, void 0, function () {
        var nextStatus, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    nextStatus = "";
                    if (currentStatus === "accepted")
                        nextStatus = "picked_up";
                    else if (currentStatus === "picked_up")
                        nextStatus = "delivered";
                    if (!nextStatus)
                        return [2 /*return*/];
                    setIsSaving(true);
                    setIsSaveSuccess(false);
                    return [4 /*yield*/, supabase
                            .from("orders")
                            .update({
                            delivery_status: nextStatus,
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", orderId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        setIsSaving(false);
                        setIsSaveSuccess(false);
                        sonner_1.toast.error("Update failed");
                    }
                    else {
                        setIsSaving(false);
                        setIsSaveSuccess(true);
                        setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var order, fee;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        setIsSaveSuccess(false);
                                        sonner_1.toast.success("Broadcasting update: ".concat(nextStatus));
                                        if (!(nextStatus === "delivered")) return [3 /*break*/, 2];
                                        order = activeMissions.find(function (o) { return o.id === orderId; });
                                        fee = (order === null || order === void 0 ? void 0 : order.delivery_fee) || 5;
                                        return [4 /*yield*/, supabase
                                                .from("rider_profiles")
                                                .update({
                                                total_earnings: ((riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.total_earnings) || 0) + fee,
                                                total_deliveries: ((riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.total_deliveries) || 0) + 1,
                                                active_points: ((riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.active_points) || 0) + 10,
                                                updated_at: new Date().toISOString()
                                            })
                                                .eq("id", riderProfile.id)];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2:
                                        fetchRiderData();
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 1500);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handlePairing = function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, _a, data, error, updateError, err_16;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!pairingCode || pairingCode.length < 6) {
                        sonner_1.toast.error("Please enter a valid 6-digit code");
                        return [2 /*return*/];
                    }
                    setIsPairing(true);
                    return [4 /*yield*/, supabase.auth.getUser()];
                case 1:
                    user = (_c.sent()).data.user;
                    if (!user) {
                        sonner_1.toast.error("Session expired. Please sign in again.");
                        setIsPairing(false);
                        return [2 /*return*/];
                    }
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 5, 6, 7]);
                    return [4 /*yield*/, supabase
                            .from("rider_connections")
                            .select("*")
                            .eq("connection_code", pairingCode.toUpperCase())
                            .eq("status", "active")
                            .single()];
                case 3:
                    _a = _c.sent(), data = _a.data, error = _a.error;
                    if (error || !data) {
                        sonner_1.toast.error("Invalid or expired pairing code");
                        setIsPairing(false);
                        return [2 /*return*/];
                    }
                    // Check expiry
                    if (new Date(data.expires_at) < new Date()) {
                        sonner_1.toast.error("This code has expired. Ask merchant for a new one.");
                        setIsPairing(false);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, supabase
                            .from("rider_connections")
                            .update({
                            rider_id: user.id,
                            rider_name: (riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.full_name) || ((_b = user.email) === null || _b === void 0 ? void 0 : _b.split("@")[0]) || "Rider",
                            status: "active",
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", data.id)];
                case 4:
                    updateError = (_c.sent()).error;
                    if (updateError) {
                        sonner_1.toast.error("Linking failed: " + updateError.message);
                    }
                    else {
                        sonner_1.toast.success("Successfully paired with Merchant!");
                        setShowPairingModal(false);
                        setPairingCode("");
                        fetchRiderData();
                    }
                    return [3 /*break*/, 7];
                case 5:
                    err_16 = _c.sent();
                    console.error("Pairing error:", err_16);
                    sonner_1.toast.error("An unexpected error occurred during pairing");
                    return [3 /*break*/, 7];
                case 6:
                    setIsPairing(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return (<div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white font-body">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>);
    }
    return (<div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-body pb-24 relative overflow-hidden">
      {/* Background Map */}
      <div className="absolute inset-0 z-0">
        <AppMapBackground_1.default riderCoords={riderCoords} missions={availableMissions.map(function (m) { return (__assign(__assign({}, m), { latitude: m.lat, longitude: m.lng, order_type: m.order_type })); })} activeMission={activeMissions[0] ? __assign(__assign({}, activeMissions[0]), { latitude: activeMissions[0].lat, longitude: activeMissions[0].lng, order_type: activeMissions[0].order_type }) : null}/>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/80 pointer-events-none"/>
      </div>

      <div className="relative z-10 p-6 flex flex-col min-h-screen">
        {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-headline">
            Rider HUD
          </h1>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", (riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online) ? "bg-green-500 animate-pulse" : "bg-zinc-600")}/>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {(riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online) ? "Ready for Missions" : "Off Duty"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onSwitchRole} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-colors">
            <lucide_react_1.Store size={20}/>
          </button>
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center font-bold text-on-primary">
            {((_b = riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.full_name) === null || _b === void 0 ? void 0 : _b[0]) || ((_c = riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.name) === null || _c === void 0 ? void 0 : _c[0]) || <lucide_react_1.User size={20}/>}
          </div>
        </div>
      </header>

      {/* Active Connections HUD */}
      {activeConnections.length > 0 && (<div className="px-6 mb-8">
           <div className="flex flex-col gap-2">
             {activeConnections.map(function (conn) {
                var _a;
                var expiresAt = new Date(conn.expires_at);
                var diff = expiresAt.getTime() - Date.now();
                var hours = Math.floor(diff / (1000 * 60 * 60));
                var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return (<div key={conn.id} className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <lucide_react_1.Store size={20}/>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">Uplink Active</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"/>
                        </div>
                        <p className="text-sm font-bold text-white">{((_a = conn.shops) === null || _a === void 0 ? void 0 : _a.name) || "Merchant Shop"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter mb-0.5">Session Remaining</p>
                      <p className="text-xs font-mono font-black text-zinc-300">
                        {hours}h {mins}m
                      </p>
                    </div>
                  </div>);
            })}
           </div>
        </div>)}

      {/* Stats Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-8 relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                Lifetime Tracker
              </h2>
              <p className="text-sm font-bold text-zinc-300">
                {(riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.full_name) || "Agent Rider"}
              </p>
            </div>
            <button onClick={toggleOnline} className={cn("px-5 py-2 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest border-2", (riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online)
            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
            : "bg-transparent text-zinc-500 border-zinc-800")}>
              {(riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online) ? "Go Offline" : "Go Online"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-500/10 rounded-lg text-green-500">
                  <lucide_react_1.Sparkles size={12}/>
                </div>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                  Total Earnings
                </span>
              </div>
              <p className="text-xl font-black text-white">R {((_d = riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.total_earnings) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || "0.00"}</p>
            </div>
            <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                  <lucide_react_1.Package size={12}/>
                </div>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                  Deliveries
                </span>
              </div>
              <p className="text-xl font-black text-white">{(riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.total_deliveries) || 0}</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full -mr-16 -mt-16"/>
      </div>

      {/* Active Missions */}
      {activeMissions.length > 0 && (<div className="mb-8">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 mb-4 flex items-center gap-2">
            <lucide_react_1.Navigation size={14} className="text-primary"/> Active Missions
          </h3>
          <div className="space-y-3">
            {activeMissions.map(function (order) {
                var _a;
                return (<div key={order.id} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Customer</span>
                    <p className="font-bold text-white">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <div className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter mb-1 inline-block", order.delivery_fee && order.delivery_fee > 5
                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                        : "bg-green-500/20 text-green-500 border border-green-500/30")}>
                      {order.delivery_fee && order.delivery_fee > 5 ? "R10 FIXED" : "R5 FIXED"}
                    </div>
                    <p className="font-black text-white">R {((_a = order.delivery_fee) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "5.00"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-4 text-[10px] font-medium text-zinc-400">
                  <div className="flex items-center gap-1">
                    <lucide_react_1.MapPin size={10} className="text-zinc-600"/>
                    <span className="truncate max-w-[120px]">{order.delivery_address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <lucide_react_1.Clock size={10} className="text-zinc-600"/>
                    <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <button onClick={function () { return updateMissionStatus(order.id, order.delivery_status || "accepted"); }} disabled={updatingOrderId === order.id} className={cn("w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ring-offset-zinc-900", order.delivery_status === "accepted"
                        ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                        : "bg-primary text-on-primary hover:bg-primary/90")}>
                  {updatingOrderId === order.id ? "Syncing..." :
                        order.delivery_status === "accepted" ? "Mark as Picked Up" : "Mark as Delivered"}
                </button>
              </div>);
            })}
          </div>
        </div>)}

      {/* Available Missions (Broadcast) */}
      <div className="mb-8">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 mb-4">
          Broadcast Missions
        </h3>
        {availableMissions.length === 0 ? (<div className="bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-center">
            <lucide_react_1.Radio className="mx-auto mb-3 text-zinc-700 animate-pulse" size={24}/>
            <p className="text-zinc-500 italic text-sm font-medium">
              Scanning for nearby merchant signals...
            </p>
          </div>) : (<div className="space-y-3">
            {availableMissions.map(function (order) {
                var _a;
                return (<div key={order.id} className="bg-zinc-900/50 border border-primary/20 rounded-2xl p-5 hover:bg-zinc-900 transition-colors group">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <lucide_react_1.Store size={20}/>
                    </div>
                    <div>
                      <p className="font-bold text-white leading-none mb-1">{order.restaurant_name || "Merchant"}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border", order.delivery_fee && order.delivery_fee > 5
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-green-500/10 text-green-500 border-green-500/20")}>
                          {order.delivery_fee && order.delivery_fee > 5 ? "Zone B" : "Zone A"}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight italic">Priority Delivery</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-green-500 leading-none mb-1">R {((_a = order.delivery_fee) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "5.00"}</p>
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Earnings</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4 text-[10px] text-zinc-400 font-medium">
                  <div className="flex items-center gap-1">
                    <lucide_react_1.Navigation size={10} className={cn(order.delivery_fee && order.delivery_fee > 5 ? "text-amber-500" : "text-green-500")}/>
                    <span>{order.delivery_fee && order.delivery_fee > 5 ? "Mid-Range (3-6km)" : "Short-Range (<3km)"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <lucide_react_1.Info size={10}/>
                    <span>{JSON.parse(order.items || "[]").length} Items</span>
                  </div>
                </div>

                <button onClick={function () { return acceptMission(order.id); }} disabled={updatingOrderId === order.id || !(riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.is_online)} className="w-full py-3 bg-zinc-100 text-zinc-950 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white active:scale-95 transition-all disabled:opacity-30">
                  {updatingOrderId === order.id ? "Deploying..." : "Accept Mission"}
                </button>
              </div>);
            })}
          </div>)}
      </div>

      {/* Connected People (Online Riders) */}
      <div className="mb-8">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 mb-4 flex items-center gap-2">
          <lucide_react_1.Users size={14} className="text-zinc-600"/> Connected Hub
        </h3>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
          {onlineRiders.map(function (rider) {
            var _a, _b;
            return (<div key={rider.id} className="relative group">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all border-2", rider.id === (riderProfile === null || riderProfile === void 0 ? void 0 : riderProfile.id)
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-zinc-900 border-zinc-800 text-zinc-500")}>
                {((_a = rider.full_name) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = rider.name) === null || _b === void 0 ? void 0 : _b[0]) || "?"}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-950"/>
            </div>);
        })}
          <button className="w-10 h-10 rounded-xl border-2 border-dashed border-zinc-800 flex items-center justify-center text-zinc-700 hover:border-zinc-700 hover:text-zinc-500 transition-all" onClick={function () { return setShowPairingModal(true); }}>
            <lucide_react_1.Plus size={16}/>
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-4 font-medium italic">
          Currently {onlineRiders.length} agents active in the regional mesh network.
        </p>
      </div>

      {/* Pairing Modal */}
      <react_2.AnimatePresence>
        {showPairingModal && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/80 backdrop-blur-sm">
            <react_2.motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <lucide_react_1.Zap size={24}/>
                </div>
                <button onClick={function () { return setShowPairingModal(false); }} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <lucide_react_1.X size={24}/>
                </button>
              </div>

              <div className="space-y-2 mb-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Pair with Shop</h3>
                <p className="text-sm text-zinc-500 font-medium">Enter the 6-digit uplink code shown on the merchant dashboard.</p>
              </div>

              <div className="space-y-4">
                <input type="text" maxLength={6} value={pairingCode} onChange={function (e) { return setPairingCode(e.target.value.toUpperCase()); }} placeholder="CODE" className="w-full h-16 bg-zinc-950 border-2 border-zinc-800 rounded-2xl text-center text-3xl font-black tracking-[0.5em] text-white focus:border-primary outline-none transition-all placeholder:text-zinc-800"/>
                <button onClick={handlePairing} disabled={isPairing || pairingCode.length < 6} className="w-full h-14 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-primary/20">
                  {isPairing ? "Verifying Uplink..." : "Initialize Pairing"}
                </button>
              </div>
            </react_2.motion.div>
          </div>)}
      </react_2.AnimatePresence>

      {/* Footer Instructions */}
      <div className="mt-8 pt-8 border-t border-zinc-900">
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <lucide_react_1.ShieldCheck size={20}/>
          </div>
          <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
            SECURE LINK ACTIVE: Your session is protected by E2E encryption. 
            Maintain a high rating to stay eligible for <span className="text-primary">Flash Multiplier</span> events.
          </p>
        </div>
      </div>
    </div>
  </div>);
};
