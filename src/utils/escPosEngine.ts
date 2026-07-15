// LocalEatsSA High-Reliability Receipt Printing Engine
// Direct browser-to-hardware communication via Web Bluetooth / Web USB
// Optimized for thermal ESC/POS POS printer slips (58mm / 80mm widths)

import { Order } from "../types";

const ESC = 0x1b;
const GS = 0x1d;

// ESC/POS Command specifications
export const COMMANDS = {
  RESET: new Uint8Array([ESC, 0x40]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_SIZE_ON: new Uint8Array([GS, 0x21, 0x11]), // Double height & width
  DOUBLE_SIZE_OFF: new Uint8Array([GS, 0x21, 0x00]),
  CUT: new Uint8Array([GS, 0x56, 0x41, 0x03]), // Feed 3 lines & cut
};

export interface QueuedPrintJob {
  id: string;
  orderId: string;
  customerName: string;
  createdAt: string;
  binaryData: number[]; // Serialized as standard number array for DB safety
  status: "failed" | "retrying";
}

const DB_NAME = "localeats_print_queue_db";
const STORE_NAME = "failed_prints";

// --- IndexedDB Local Slip Queue Storage (Offline fallback) ---
export function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueFailedPrint(job: Omit<QueuedPrintJob, "status">): Promise<void> {
  try {
    const db = await initDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ ...job, status: "failed" });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to queue print job locally in IndexedDB:", err);
  }
}

export async function getFailedPrints(): Promise<QueuedPrintJob[]> {
  try {
    const db = await initDb();
    return await new Promise<QueuedPrintJob[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to fetch queued prints:", err);
    return [];
  }
}

export async function deleteFailedPrint(id: string): Promise<void> {
  try {
    const db = await initDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to delete queued print job:", err);
  }
}

// --- Text Formatting Helpers for Alignments ---
export function formatTwoColumns(col1: string, col2: string, width: number): string {
  const col2Str = col2.toString();
  const spaceNeeded = width - col1.length - col2Str.length;
  if (spaceNeeded <= 0) {
    const truncatedCol1 = col1.slice(0, Math.max(5, width - col2Str.length - 2));
    return truncatedCol1 + " " + col2Str;
  }
  return col1 + " ".repeat(spaceNeeded) + col2Str;
}

// --- ESC/POS Raw Slip Binary Generator ---
export function generateReceiptBytes(order: Order, shopName: string, paperSize: 58 | 80 = 58): Uint8Array {
  const width = paperSize === 58 ? 32 : 48;
  const parts: Uint8Array[] = [];

  const addBytes = (bytes: Uint8Array) => {
    parts.push(bytes);
  };

  const addText = (text: string) => {
    const encoder = new TextEncoder();
    parts.push(encoder.encode(text));
  };

  const addLine = (text: string = "") => {
    addText(text + "\n");
  };

  // Initialize
  addBytes(COMMANDS.RESET);

  // Shop Header (Centered, Double-sized)
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE_ON);
  addBytes(COMMANDS.BOLD_ON);
  addLine(shopName.toUpperCase());
  addBytes(COMMANDS.DOUBLE_SIZE_OFF);
  addBytes(COMMANDS.BOLD_OFF);

  addLine("-".repeat(width));
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine("LOCAL EATS SOUTH AFRICA");
  addLine("Kitchen / Dispatch Slip");
  addLine("-".repeat(width));

  // Metadata block (Left Aligned)
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine(`ORDER ID: #${order.id.slice(0, 8).toUpperCase()}`);
  addLine(`Placed: ${order.created_at ? new Date(order.created_at).toLocaleString("en-ZA") : new Date().toLocaleString("en-ZA")}`);
  addLine(`Service: ${(order.order_type || "Delivery").toUpperCase()}`);
  addLine(`Payment: ${(order.payment_method || "Cash on Arrival").toUpperCase()}`);
  addLine("-".repeat(width));

  // Customer profile
  addBytes(COMMANDS.BOLD_ON);
  addLine("DISPATCH PROFILE:");
  addBytes(COMMANDS.BOLD_OFF);
  addLine(`Name: ${order.customer_name || "Guest Customer"}`);
  addLine(`Phone: ${order.phone || "N/A"}`);
  if (order.address && order.order_type !== "collection") {
    addLine(`Address: ${order.address}`);
  }
  if (order.notes) {
    addLine(`Notes: "${order.notes}"`);
  }
  addLine("-".repeat(width));

  // Itemized breakdown
  addBytes(COMMANDS.BOLD_ON);
  addLine(formatTwoColumns("Item description", "Price", width));
  addBytes(COMMANDS.BOLD_OFF);
  addLine("-".repeat(width));

  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    (order.items as Array<string | { name?: string; price?: number | string }>).forEach((item) => {
      const name = typeof item === "string" ? item : item.name || "MenuItem";
      const priceVal = typeof item === "string" ? "" : item.price ? `R${Number(item.price).toFixed(2)}` : "";
      addLine(formatTwoColumns(`1x ${name}`, priceVal, width));
    });
  } else if (order.product_name) {
    const quantityLabel = order.product_variant ? `1x ${order.product_variant}` : "1x";
    addLine(formatTwoColumns(`${quantityLabel} ${order.product_name}`, `R${(order.price || order.total_price || 0).toFixed(2)}`, width));
  } else {
    addLine("1x Standard Order Item");
  }

  addLine("-".repeat(width));

  // Financed calculations
  const subTotal = Number(order.price) || Number(order.total_price) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;
  const discount = Number(order.discount_amount) || 0;
  const total = subTotal + deliveryFee - discount;

  addLine(formatTwoColumns("Subtotal:", `R${subTotal.toFixed(2)}`, width));
  if (deliveryFee > 0) {
    addLine(formatTwoColumns("Delivery Fee:", `R${deliveryFee.toFixed(2)}`, width));
  }
  if (discount > 0) {
    addLine(formatTwoColumns("Discount:", `-R${discount.toFixed(2)}`, width));
  }
  
  addBytes(COMMANDS.BOLD_ON);
  addLine(formatTwoColumns("TOTAL AMOUNT:", `R${total.toFixed(2)}`, width));
  addBytes(COMMANDS.BOLD_OFF);

  addLine("=".repeat(width));
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.BOLD_ON);
  addLine("EAT LOCAL. SUPPORT LOCAL.");
  addBytes(COMMANDS.BOLD_OFF);
  addLine("\n\n\n"); // Feed paper space
  addBytes(COMMANDS.CUT);

  // Buffer compaction
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }
  return buffer;
}

// --- Browser Bluetooth Printing Bridge ---
export async function printViaBluetooth(binaryData: Uint8Array): Promise<void> {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API is not available on this device/browser.");
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
        { namePrefix: "Printer" },
        { namePrefix: "MTP" },
        { namePrefix: "RPP" },
        { namePrefix: "POS" },
        { namePrefix: "Thermal" }
      ],
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"]
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error("GATT Connection handshaking failed.");

    const services = await server.getPrimaryServices();
    let writeChar: BluetoothRemoteGATTCharacteristic | null = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error("No ESC/POS writable channels discovered.");
    }

    // Standard 512-byte payload fragmentation limits over wireless BT SPP profiles
    const MTU = 512;
    for (let offset = 0; offset < binaryData.length; offset += MTU) {
      const chunk = binaryData.slice(offset, offset + MTU);
      await writeChar.writeValue(chunk);
    }
  } catch (err) {
    console.error("Bluetooth printer stream crash:", err);
    throw err;
  }
}

// --- Browser Web USB Printing Bridge ---
export async function printViaUSB(binaryData: Uint8Array): Promise<void> {
  if (!navigator.usb) {
    throw new Error("Web USB API is not supported on this browser.");
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: [{ classCode: 7 }] // Class 7 mapping: PRINTER devices
    });

    await device.open();
    await device.selectConfiguration(1);

    let interfaceNum = 0;
    let endpointOut = 1;
    let epDiscovered = false;

    for (const config of device.configurations) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          if (alt.interfaceClass === 7) {
            interfaceNum = iface.interfaceNumber;
            const outEp = alt.endpoints.find(ep => ep.direction === "out" && ep.type === "bulk");
            if (outEp) {
              endpointOut = outEp.endpointNumber;
              epDiscovered = true;
              break;
            }
          }
        }
        if (epDiscovered) break;
      }
      if (epDiscovered) break;
    }

    await device.claimInterface(interfaceNum);
    await device.transferOut(endpointOut, binaryData);
    await device.close();
  } catch (err) {
    console.error("USB printer pipeline failure:", err);
    throw err;
  }
}
