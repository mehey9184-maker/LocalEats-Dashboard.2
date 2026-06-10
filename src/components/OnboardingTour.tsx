import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ReceiptText,
  Bike,
  Bell,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  PartyPopper
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
  icon: React.ComponentType<{ size: number; className?: string }>;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 0,
    tab: "dashboard",
    title: "Welcome to LocalEats Merchant!",
    badge: "ONBOARDING TOUR",
    description: "Welcome back! This is your ultimate control bureau for managing your culinary business, adjusting orders, and coordinating deliveries. Let's run through a quick 1-minute visual guide to get you setup for success.",
    highlightText: "Press Start to witness the storefront capabilities.",
    icon: Sparkles,
    color: "from-orange-500 to-amber-500"
  },
  {
    id: 1,
    tab: "dashboard",
    title: "1. The Live Dashboard Command",
    badge: "COMMAND HUB",
    description: "Keep a pulse on your storefront performance. This is where you toggle your live merchant status, track hourly revenue charts, view quick alerts, and observe ongoing trends.",
    highlightText: "Toggle 'Online' in the header to receive live customer requests.",
    icon: LayoutDashboard,
    color: "from-amber-500 to-yellow-500"
  },
  {
    id: 2,
    tab: "menu",
    title: "2. Culinary Delicacies (Menu)",
    badge: "MENU EDITOR",
    description: "Your digital catalog. Create, catalog, and refine your dishes. Adjust stock levels with instant inventory decrementers, toggle item availability, and set pricing on the fly.",
    highlightText: "Keeping menu items fresh directly increases customer orders.",
    icon: UtensilsCrossed,
    color: "from-emerald-500 to-teal-500"
  },
  {
    id: 3,
    tab: "orders",
    title: "3. Real-Time Incoming Orders",
    badge: "ORDER STREAM",
    description: "Incoming customer orders wait for your action here. Moving a receipt to 'Preparing' prompts our intelligent rider pool immediately to prepare for pickup.",
    highlightText: "Fulfill orders rapidly to secure standard high merchant ratings.",
    icon: ReceiptText,
    color: "from-blue-500 to-sky-500"
  },
  {
    id: 4,
    tab: "riders",
    title: "4. Rider Logistics Track",
    badge: "DELIVERY CONTROL",
    description: "Coordinate your dispatchers instantly. Observe assigned courier status, calibrate live coordinates, track dispatch connections, and send urgent alerts to nearby riders.",
    highlightText: "See couriers live on the active operations map.",
    icon: Bike,
    color: "from-violet-500 to-purple-500"
  },
  {
    id: 5,
    tab: "settings",
    title: "5. High-Fidelity Notification Alerts",
    badge: "ENVIRONMENT SETTINGS",
    description: "Custom notification signals. Toggle sound alerts, select from 3 soothing audio melodies (Calm, Cozy, or Sparkle), and slider-control buzzer volume for custom store comfort.",
    highlightText: "Fine-tune alert decibels so your kitchen never misses an order.",
    icon: Bell,
    color: "from-pink-500 to-rose-500"
  },
  {
    id: 6,
    tab: "dashboard",
    title: "All Systems Set!",
    badge: "TOUR COMPLETED",
    description: "Awesome job. You are now ready to stream delivery dispatches, serve your community, and scale your brand with the LocalEats network.",
    highlightText: "You can restart this walkthrough anytime under Settings.",
    icon: PartyPopper,
    color: "from-amber-500 to-orange-600"
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
    >
      {/* Background Mask to highlight current active panel */}
      <div className="absolute inset-0 pointer-events-none" />

      <div
        id="onboarding-tour-card"
        className="relative w-full max-w-lg bg-surface dark:bg-surface-container-high rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden flex flex-col transform scale-100 opacity-100 transition-all duration-300"
      >
        {/* Top colored aesthetic bar styled dynamically */}
        <div className={`h-2 bg-gradient-to-r ${step.color} w-full`} />

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:hover:bg-surface-container-highest transition-all z-10"
          aria-label="Skip tour"
        >
          <X size={16} />
        </button>

        <div className="p-6 md:p-8 space-y-6 flex-1">
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
        <div className="bg-surface-container-low dark:bg-surface-container-highest/50 px-6 py-4 flex items-center justify-between border-t border-outline-variant/10">
          <button
            onClick={handleSkip}
            className="text-xs text-on-surface-variant/70 hover:text-primary font-bold transition-colors select-none"
          >
            Skip Walkthrough
          </button>

          <div className="flex items-center gap-3">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 text-xs font-bold font-headline text-on-surface border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition-all flex items-center gap-1.5 select-none"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            <button
              onClick={handleNext}
              className={`px-5 py-2.5 text-xs font-bold font-headline rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5 select-none ${
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
