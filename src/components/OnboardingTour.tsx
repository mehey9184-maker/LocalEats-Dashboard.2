import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ReceiptText,
  Megaphone,
  Bell,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  PartyPopper,
  type LucideIcon
} from "lucide-react";

interface OnboardingTourProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onComplete: () => void;
  isOpen: boolean;
}

interface TourStep {
  id: number;
  tab: string;
  title: string;
  badge: string;
  description: string;
  highlightText: string;
  icon: LucideIcon;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 0, tab: "dashboard", title: "Welcome to LocalEats Merchant",
    badge: "PICKUP-FIRST TOUR",
    description: "Explore how an approved shop can prepare food for customer collection and take payment at the shop. This walkthrough is not a live order or a release approval.",
    highlightText: "During a vendor pitch, practise only with clearly labelled fake orders on a read-only preview.",
    icon: Sparkles, color: "from-orange-500 to-amber-500"
  },
  {
    id: 1, tab: "dashboard", title: "1. Your Shop Dashboard",
    badge: "SHOP OVERVIEW",
    description: "See your verified storefront and its current availability. Opening the dashboard does not automatically publish a shop or enable public pickup orders.",
    highlightText: "Do not toggle live shop availability just to demonstrate the product.",
    icon: LayoutDashboard, color: "from-amber-500 to-yellow-500"
  },
  {
    id: 2, tab: "menu", title: "2. Show Your Food Menu",
    badge: "MENU BROWSING",
    description: "Customers can browse an approved shop's food names and prices. Menu edits are protected server operations and may remain unavailable until separate launch testing.",
    highlightText: "Use approved sample items. Do not promise that menu or stock edits save until persistence has been verified.",
    icon: UtensilsCrossed, color: "from-emerald-500 to-teal-500"
  },
  {
    id: 3, tab: "orders", title: "3. Practise a Pickup Order",
    badge: "FAKE TICKETS ONLY",
    description: "In the read-only workshop, practise Accept, Preparing, Ready, payment at the shop and Collected using clearly labelled fictional tickets. No real order or payment is created.",
    highlightText: "Customers collect from the shop. Rider dispatch and delivery are not enabled in this pickup-first pilot.",
    icon: ReceiptText, color: "from-blue-500 to-sky-500"
  },
  {
    id: 4, tab: "marketing", title: "4. Invite Customers to Your Shop",
    badge: "SHOP MARKETING",
    description: "Review the shop-sharing, poster and QR-flyer options. These can help customers discover an approved shop; they do not guarantee visits, sales or advertising reach.",
    highlightText: "Show the vendor their own shop link only after approval and a real QR-scan check.",
    icon: Megaphone, color: "from-violet-500 to-purple-500"
  },
  {
    id: 5, tab: "settings", title: "5. Notifications & Settings",
    badge: "DEVICE READINESS",
    description: "Review notification permissions and settings. Actual alerts depend on device permissions, network connectivity and confirmed push delivery on the merchant's own phone.",
    highlightText: "A simulated alert is not proof that a real push notification will arrive.",
    icon: Bell, color: "from-pink-500 to-rose-500"
  },
  {
    id: 6, tab: "dashboard", title: "Ready to Practise, Not Yet Live",
    badge: "TOUR COMPLETE",
    description: "You have explored LocalEats' planned pickup-first vendor workflow. Real ordering, payments, availability changes and public launch still require separate acceptance and approval.",
    highlightText: "Tour completion is not shop approval, a production deployment or proof of real customer readiness.",
    icon: PartyPopper, color: "from-amber-500 to-orange-600"
  }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  activeTab,
  setActiveTab,
  onComplete,
  isOpen
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Sync the tour step with manual tab selection from sidebar clicks
  useEffect(() => {
    if (!isOpen) return;

    const stepTargetTab = TOUR_STEPS[currentStep].tab;
    if (activeTab !== stepTargetTab) {
      const matchIndex = TOUR_STEPS.findIndex((s) => s.tab === activeTab);
      if (matchIndex !== -1) {
        const timer = setTimeout(() => {
          setCurrentStep(matchIndex);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [activeTab, isOpen, currentStep]);

  // Reset to first step of the tour on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setCurrentStep(0);
        setActiveTab(TOUR_STEPS[0].tab);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, setActiveTab]);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setActiveTab(TOUR_STEPS[nextStep].tab);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setActiveTab(TOUR_STEPS[prevStep].tab);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div
      key="onboarding-tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="LocalEats pickup-first merchant tour"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
    >
      {/* Background Mask to highlight current active panel */}
      <div className="absolute inset-0 pointer-events-none" />

      <div
        id="onboarding-tour-card"
        className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-surface dark:bg-surface-container-high rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col transform scale-100 opacity-100 transition-all duration-300"
      >
        {/* Top colored aesthetic bar styled dynamically */}
        <div className={`h-2 bg-gradient-to-r ${step.color} w-full`} />

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-2 right-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:hover:bg-surface-container-highest transition-all z-10"
          aria-label="Skip tour"
        >
          <X size={16} />
        </button>

        <div className="p-4 pt-14 sm:p-6 sm:pt-14 md:p-8 md:pt-14 space-y-4 sm:space-y-6 flex-1">
          {/* Header section with icon, badge & title */}
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl bg-gradient-to-tr ${step.color} text-white shadow-md shrink-0`}>
              <step.icon size={24} />
            </div>
            <div className="space-y-1 text-left">
              <span className="text-[10px] font-bold tracking-widest text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                {step.badge}
              </span>
              <h3 className="text-xl font-bold font-headline text-on-surface select-none">
                {step.title}
              </h3>
            </div>
          </div>

          {/* Core Description */}
          <p className="text-sm text-on-surface-variant leading-relaxed select-none text-left">
            {step.description}
          </p>

          {/* Highlight helper card (proportional UX cues) */}
          <div className="p-4 bg-surface-container-low dark:bg-surface-container-highest/80 rounded-2xl border border-outline-variant/10 text-left flex items-start gap-3">
            <span className="text-base select-none shrink-0 mt-0.5">💡</span>
            <p className="text-xs text-on-surface font-medium leading-normal select-none">
              {step.highlightText}
            </p>
          </div>

          {/* Step indicator progress bars */}
          <div className="flex gap-1.5 pt-2">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "w-8 bg-primary" : "w-2 bg-outline-variant/35"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Action button bar */}
        <div className="bg-surface-container-low dark:bg-surface-container-highest/50 px-3 py-3 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10">
          <button
            onClick={handleSkip}
            className="min-h-[44px] inline-flex items-center text-xs text-on-surface-variant/70 hover:text-primary font-bold transition-colors select-none"
          >
            Skip Walkthrough
          </button>

          <div className="flex items-center gap-3">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="min-h-[44px] px-4 py-2 text-xs font-bold font-headline text-on-surface border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition-all flex items-center gap-1.5 select-none"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            <button
              onClick={handleNext}
              className={`min-h-[44px] px-5 py-2.5 text-xs font-bold font-headline rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5 select-none ${
                isLast
                  ? "bg-primary text-white shadow-primary/20 hover:bg-primary-dark"
                  : "bg-on-surface text-surface dark:bg-white dark:text-black hover:opacity-90"
              }`}
            >
              {isLast ? "Done" : isFirst ? <>Let's Go <Play size={12} className="fill-current" /></> : <>Next <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
