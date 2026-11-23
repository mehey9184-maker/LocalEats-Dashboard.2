# CF-W2D — Vendor phone rehearsal and launch-pitch gate

**Scope:** Founder-led physical phone rehearsal of the **original** LocalEats Merchant Dashboard on the independent [Cloudflare demo](https://localeats-merchant-dashboard-preview.mehey9184.workers.dev/). This is a *fictional read-only training environment*, not public ordering acceptance.

**Safety/approval:** Do **not** merge any PR to `main`, alter Production domains, apply database migrations, create real orders, collect real payments, request vendor passwords, or claim the pilot accepts public customers. The demo uses only a fictional shop and simulated orders, with no live APIs or accounts. Do not confuse this step with the separate CF2-E backup and real-order release gates.

## Step 1 — Founder runs this on an actual phone (mandatory, not automatable)

Use your own Android/Chrome and/or iPhone/Safari if available. Keep **mobile data** on for at least one full pass. Do not use desktop DevTools as evidence for the physical-device check.

1. Open `https://localeats-merchant-dashboard-preview.mehey9184.workers.dev/` in a new phone tab, with no old dashboard session. **Expect:** original LocalEats Merchant Home, fictional **LocalEats Example Shop**, no sign-in requirement, no real customer details.
2. Tap **Orders** in the phone's bottom navigation. **Expect:** the original Orders layout and a small **Start simulation** control. No fake tickets until you start.
3. Tap **Start simulation**. **Expect:** one amber-bordered **FAKE · TEST ONLY** pickup ticket. Larger incoming waves may appear automatically every 8 seconds until you stop. Do not confuse their values with actual sales.
4. Tap **Stop simulation** before handling the order so the example remains simple. Tap **Accept & Prep**. Switch the phone's kitchen-stage tab from **New** to **Preparing**. Tap **Mark Ready**.
5. Switch to **Ready**. Tap **Confirm cash received**. Read the **TEST ONLY** dialog aloud before confirming. Tap **Confirm handover** and read the second **TEST ONLY** dialog. **Expect:** the fictional ticket advances without a real payment, message, or shop update.
6. Try screen scrolling, touch target accessibility, portrait rotation if possible, and **Clear tests**. Refresh the tab. **Expect:** fictional state resets and the Merchant app remains usable; it may keep you on the Orders tab so kitchen work is not interrupted. Never require a vendor to use a real account for this.
7. Repeat on **Wi-Fi** if possible and record whether the original Home, Orders and buttons stay usable on a weak/mobile network. Note approximate seconds to first usable Home and Orders, but do not treat simulator timing as a production speed measurement.

## Step 2 — One consenting vendor watches or uses it

Read the short pitch script:

> “This is LocalEats. On your own shop dashboard, incoming orders will appear here. You accept, prepare, mark ready, confirm payment received **at your counter**, then hand the order to the customer. Today I'm showing **fictional orders only** so you can try the workflow. Real activation comes after a separate launch check.”

Invite the vendor to perform **Accept → Ready → Payment → Handover** unaided after a brief demonstration. Record only voluntarily shared, non-sensitive feedback:
- Could they identify a new order without prompting?
- Did they understand what **Accept & Prep**, **Mark Ready**, **Confirm cash received**, and **Confirm handover** each do?
- Could they find the next kitchen tab on a phone without help?
- Did they correctly recognize that every example is **FAKE/TEST ONLY**?
- Would they be willing to join a *future* pickup pilot when real-order activation is approved?

Keep personally identifiable vendor data out of public GitHub issues, logs, and screenshots.

## Step 3 — Acceptance record

| Gate | Result | Evidence |
| --- | --- | --- |
| Hosted demo original Home → Orders | PASS — verified in CF-W2C | Cloudflare production Worker/browser |
| Fictional order controls and manual lifecycle | PASS — verified in CF-W2C | 320/390/1366 browser runs |
| GitHub CI Android, tablet, iOS WebKit browser touch testing | PENDING until CI runs | CF-W2D separate checks |
| Actual Android Chrome or iPhone Safari **on real phone**, with mobile data | **PENDING — founder must perform** | Brief date/device/connection note |
| One consenting vendor's comprehension/usability | **PENDING — founder must perform** | Four steps understood, problems noted |
| Real customer orders/payment and backups | **NOT PART OF THIS GATE** | Separate CF2-E and launch acceptance |

**Decision rule:** Call the demo **ready to pitch** after the hosted browser CI passes and the founder confirms the real-phone check. Call it **vendor-rehearsal accepted** only after at least one consenting vendor can follow the workflow and knows it is fictional. Neither result alone authorizes public real-order activation.

## Founder feedback (fill after your actual test)

- Date / device / browser / mobile-data operator:
- Home loaded (Y/N), approximate seconds:
- Orders tab accessible and fake ticket visible (Y/N):
- Each manual action worked, including lane changes (Y/N):
- Bottom controls unobstructed / no horizontal scroll (Y/N):
- On refresh, fictional orders reset (Y/N):
- Vendor could explain four steps without help (Y/N / not yet tested):
- Confusing buttons, errors, or screenshots **without private data**:
- Founder decision: PASS / NEEDS FIX / PENDING

### Reminders

The Cloudflare URL is a **live-hosted, read-only demo**, but it is not a replacement for production mobile acceptance, Firebase push notification verification or the database backup gate. Keep `main` and all live LocalEats domains unchanged.
