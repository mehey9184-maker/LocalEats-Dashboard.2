// Isolated, deterministic demonstration clock. These are NOT LocalEats Order rows.
// Never adapt these objects into real order APIs, shop totals, print jobs or FCM.
// The preview is just a guided walkthrough for consenting merchant prospects.

export type WorkshopStage = "incoming" | "accepted" | "preparing" | "ready" | "collected";

export type WorkshopOrder = {
  id: string;
  sampleName: string;
  item: string;
  examplePrice: number;
  createdTick: number;
  stage: WorkshopStage;
};

export type WorkshopEvent = {
  id: string;
  tick: number;
  stage: WorkshopStage;
  message: string;
};

export type WorkshopState = {
  tick: number;
  nextNumber: number;
  completedTotal: number;
  orders: WorkshopOrder[];
  events: WorkshopEvent[];
};

const MENU_EXAMPLES = [
  { item: "Kota with chips", examplePrice: 25 },
  { item: "Cheese kota", examplePrice: 35 },
  { item: "Kota and soft drink", examplePrice: 40 },
  { item: "Small chips", examplePrice: 15 },
] as const;

const MAX_ACTIVE_AND_RECENT_ORDERS = 10;
const MAX_EVENTS = 7;

const stageForAge = (age: number): WorkshopStage =>
  age >= 10 ? "collected" :
  age >= 7 ? "ready" :
  age >= 4 ? "preparing" :
  age >= 2 ? "accepted" :
  "incoming";

const stageMessage: Record<WorkshopStage, string> = {
  incoming: "A fictional customer placed an example order.",
  accepted: "The example kitchen accepted the order.",
  preparing: "The food is being prepared in the demonstration.",
  ready: "The example customer sees a ready-for-pickup update (on-screen only).",
  collected: "Payment at shop and food handover were simulated.",
};

function newOrder(number: number, tick: number): WorkshopOrder {
  const item = MENU_EXAMPLES[(number - 1) % MENU_EXAMPLES.length];
  return {
    id: `DEMO-${String(number).padStart(3, "0")}`,
    sampleName: `Sample customer ${number}`,
    item: item.item,
    examplePrice: item.examplePrice,
    createdTick: tick,
    stage: "incoming",
  };
}

function eventFor(order: WorkshopOrder, tick: number): WorkshopEvent {
  return {
    id: `${order.id}-${tick}-${order.stage}`,
    tick,
    stage: order.stage,
    message: `${order.id}: ${stageMessage[order.stage]}`,
  };
}

export function initialWorkshopState(): WorkshopState {
  const order = newOrder(1, 0);
  return {
    tick: 0,
    nextNumber: 2,
    completedTotal: 0,
    orders: [order],
    events: [eventFor(order, 0)],
  };
}

export function advanceWorkshop(state: WorkshopState): WorkshopState {
  const tick = state.tick + 1;
  let completedThisStep = 0;
  const changes: WorkshopEvent[] = [];

  const updated = state.orders.map((order) => {
    const stage = stageForAge(tick - order.createdTick);
    if (stage === order.stage) return order;
    const changed = { ...order, stage };
    if (stage === "collected") completedThisStep += 1;
    changes.push(eventFor(changed, tick));
    return changed;
  });

  let nextNumber = state.nextNumber;
  if (tick % 3 === 0) {
    const order = newOrder(nextNumber, tick);
    nextNumber += 1;
    updated.unshift(order);
    changes.push(eventFor(order, tick));
  }

  // Bound memory/DOM even when the workshop is left running for hours.
  // Collected demonstration orders are retained briefly then discarded.
  const orders = updated
    .filter((order) => tick - order.createdTick <= 13)
    .slice(0, MAX_ACTIVE_AND_RECENT_ORDERS);

  return {
    tick,
    nextNumber,
    completedTotal: state.completedTotal + completedThisStep,
    orders,
    events: [...changes.reverse(), ...state.events].slice(0, MAX_EVENTS),
  };
}

export const WORKSHOP_STAGES: readonly WorkshopStage[] = [
  "incoming", "accepted", "preparing", "ready", "collected",
];
