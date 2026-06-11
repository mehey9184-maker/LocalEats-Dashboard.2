import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const componentCode = `
const NotificationCenterSidePanel = ({
  isOpen,
  onClose,
  orders,
  menuItems,
}: {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  menuItems: MenuItem[];
}) => {
  const pendingOrdersCount = orders.filter(o => o.status === "pending" || o.status === "accepted").length;
  const lowStockItems = menuItems.filter(m => typeof m.stock_count === "number" && m.stock_count < 5);
  
  const alerts = [];
  
  if (pendingOrdersCount > 0) {
    alerts.push({ id: 'orders', type: 'info', icon: <Inbox size={16}/>, title: 'Active Orders', message: \`You have \${pendingOrdersCount} active orders needing attention.\`, time: 'Just now' });
  } else {
    alerts.push({ id: 'orders_empty', type: 'success', icon: <ShieldCheck size={16}/>, title: 'All Caught Up', message: 'No new orders to fulfill at the moment.', time: '1m ago' });
  }

  if (lowStockItems.length > 0) {
    alerts.push({ id: 'inventory', type: 'warning', icon: <AlertTriangle size={16}/>, title: 'Low Inventory', message: \`\${lowStockItems.length} items are running low on stock. Please restock soon.\`, time: '5m ago' });
  }
  
  // adding a generic system alert for weather/announcements
  alerts.push({ id: 'sys', type: 'info', icon: <Megaphone size={16}/>, title: 'System Notification', message: 'Your storefront is fully active and connecting to nearby riders.', time: '1h ago' });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notification-center-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex justify-end bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-sm h-full bg-surface-container-lowest border-l border-outline-variant/20 shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.1)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex justify-between items-center border-b border-outline-variant/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Inbox size={20} />
                </div>
                <h3 className="font-bold text-on-surface">Notification Center</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant hover:text-on-surface"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {alerts.length === 0 ? (
                 <div className="text-center p-8 mt-10">
                   <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-4 text-on-surface-variant/40">
                     <Inbox size={32} />
                   </div>
                   <h4 className="font-bold text-on-surface">No new notifications</h4>
                   <p className="text-xs text-on-surface-variant mt-2">You're all caught up!</p>
                 </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className="p-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm flex flex-col gap-2 relative overflow-hidden group">
                     {alert.type === 'warning' && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>}
                     {alert.type === 'info' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>}
                     {alert.type === 'success' && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}
                     
                     <div className="flex items-start gap-3">
                       <div className={cn("p-2 rounded-xl shrink-0 text-white", 
                         alert.type === 'warning' ? "bg-amber-500" : 
                         alert.type === 'info' ? "bg-blue-500" : "bg-emerald-500"
                       )}>
                         {alert.icon || <Inbox size={16} />}
                       </div>
                       <div className="flex-1">
                         <div className="flex justify-between items-start">
                           <h4 className="text-sm font-bold text-on-surface">{alert.title}</h4>
                           <span className="text-[10px] font-medium text-on-surface-variant/60 whitespace-nowrap ml-2">{alert.time}</span>
                         </div>
                         <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{alert.message}</p>
                       </div>
                     </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
`;

const stateCode = `  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);`;

const iconCode = `              <button
                onClick={() => setIsNotificationCenterOpen(true)}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors relative"
                title="Notification Center"
              >
                <Inbox size={18} className="md:w-5 md:h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-white"></span>
              </button>
              <button
                onClick={() => setSoundAlerts(!soundAlerts)}`;

content = content.replace('const [onboardingOpen, setOnboardingOpen] = useState(false);', stateCode);
content = content.replace(/<button\n\s*onClick=\{\(\) => setSoundAlerts\(!soundAlerts\)\}/g, iconCode);

// Inject component before AppWrapper
// We can search for 'export default function AppWrapper()' and insert before it
content = content.split('export default function AppWrapper()').join(componentCode + '\\n\\nexport default function AppWrapper()');

// There are a few things to consider: 
// 1. Megaphone imported?
content = content.replace('Inbox } from "lucide-react";', 'Inbox, Megaphone } from "lucide-react";');

// 2. Add NotificationCenterSidePanel below in the JSX somewhere, maybe near <OnboardingTour />
content = content.replace('<OnboardingTour', '<NotificationCenterSidePanel isOpen={isNotificationCenterOpen} onClose={() => setIsNotificationCenterOpen(false)} orders={orders} menuItems={menuItems} />\\n        <OnboardingTour');

fs.writeFileSync('src/App.tsx', content);

