# Counter-sign reference adaptation QA

Date: 2026-11-22 (Africa/Johannesburg)

final result: passed

Scope: the owner's supplied shopping-bag QR style, intentionally adapted to a LocalEats serving dome. This is a local design/code acceptance result, not a Production or physical-print sign-off.

## Evidence and comparison

- Source: owner attachment `codex-clipboard-e3caded7-bfb8-4585-a203-0e6a2eae1d82.png`, inspected directly. Its sample QR data is not used.
- Generated artwork: `public/marketing-cloche-frame.png`; purpose-built dome silhouette and LocalEats base lettering, with no generated QR data.
- Implementation: local Marketing preview at `http://127.0.0.1:4317/`, with labelled sample data and no live services. Both the complete sign and pattern controls were inspected in the browser.
- Side-by-side comparison: `http://127.0.0.1:4317/compare.html` presents the source and rendered composite together at equal column widths. The original includes surrounding UI/checkerboard; that background is excluded from the fidelity judgment. The browser capture was approximately 1265 × 712 CSS pixels. A later viewport override did not affect the target tab as requested; a new 390px acceptance result is therefore not claimed.
- PDF evidence: `outputs/marketing-qr-review/cloche-layout-sample-a4.pdf` and `cloche-layout-sample-a5.pdf` (outside the repo). The A4 render was inspected; both rendered PDFs decoded to the exact fixture shop URL.

## Required fidelity surfaces

- Typography: friendly rounded white LocalEats lettering replaces TikTok on the illustrated base. The original Dashboard typography remains for controls and editable sign copy.
- Spacing/layout: the frame encloses a separate white QR tile; the website stays above the invitation, and pickup/payment information stays outside the scanning area. The centre logo is small and centred like the reference.
- Colour: LocalEats coral/orange replaces the reference pink; QR modules remain dark on white.
- Image quality: the frame is a local bundled asset. Functional QR data is rendered by the QR library and canvas, never image generation. Quiet zones, timing and alignment modules are preserved. Finder eyes are rounded and ordinary data modules dotted; a classic square fallback is selectable.
- Content: LocalEats and the selected shop replace the reference branding. The verified www.localeatssa.co.za address is retained. No delivery, automatic ordering, discounts or payments are promised.

## Functional results and limits

- 11 focused Marketing tests passed; scoped lint and Production build passed.
- No new TypeScript diagnostics. The branch retains 44 pre-existing whole-repo diagnostics.
- 22/24 offline scan stress probes passed. Both patterns passed normal-link QR-only and framed checks at all tested scales. Two 432px full-frame images containing an artificial 105-character shop ID failed decoding; the same long links passed at 720px and 1440px and as QR-only images. This is a documented reduction limit, not a claimed universal scanning guarantee.
- A4/A5 rendered PDF scan checks passed for the standard link. The interface says to print at actual size, not shrink below A5, retain the white border and verify with a phone.
- Switching classic/dotted patterns worked, exports became ready only after the current artwork loaded, and no browser console errors were observed.

No P0/P1/P2 visual discrepancy remains for the requested adaptation. Follow-up: owner review and physical paper/camera verification before vendor distribution; cross-device/mobile acceptance remains a separate check. No push, merge, Production deployment, order creation, database or settings change was performed.
