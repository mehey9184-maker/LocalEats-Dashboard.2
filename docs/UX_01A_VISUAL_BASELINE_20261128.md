# UX-01A: paired original versus branded visual baseline

Tracking: Merchant issue #282. Before: `45eb99d93c60efc0bfafcaa866d7a17f829fab28`. After-brand: `0432de69bd2d2f24ebf5a79ceae231860b694eda`.

Read-only audit of actual React components with isolated synthetic fixtures. 320/390/768/1440 widths, light and dark, reduced motion. Captures and measurements are intended to flag candidate problems (not blanket claims of accessibility failure); UI fixes require evidence. Outer fixture wrappers are not production app-shell verification. No app runtime files, production flags, real data, credentials or deployments modified. Test-only dependencies installed in runner, not shipped. Physical-device checks remain open. The after state represents branding, not UX polish. Subsequent UX modifications need independent before/after evidence and inherited regression gates.
