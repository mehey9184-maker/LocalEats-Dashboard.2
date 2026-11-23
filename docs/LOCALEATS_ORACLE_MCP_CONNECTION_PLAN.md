# LocalEats — Connecting Oracle Cloud Infrastructure to Codex and ChatGPT

**Prepared:** 2026-11-22 · **Status:** CONNECTION PLAN ONLY; OCI account not yet connected to this ChatGPT session. No secrets, local configuration, IAM policies, cloud resources or billing changed.
**Goal:** allow the AI technical worker to inspect OCI quotas, Always Free entitlements, availability zones, compute inventory, storage and spending risks; perform no deployments or billing changes without founder approval.

## Connector discovery outcome

A ChatGPT Plugin Directory search on 2026-11-22 for "Oracle Cloud", "OCI", and "Oracle Cloud Infrastructure" found **no matching Oracle Cloud management plugin available to connect directly**. This is a statement about this directory search, not a claim that no Oracle integration exists anywhere.

**Official viable alternative:** Oracle publishes [`oracle/mcp`](https://github.com/oracle/mcp), including an [OCI Cloud MCP server](https://github.com/oracle/mcp/tree/main/src/oci-cloud-mcp-server) built on the official Oracle Python SDK. Its tools can list SDK clients, discover operations and invoke **any allowed SDK operation**. It supports local **stdio** mode (`uvx oracle.oci-cloud-mcp-server`) and remote HTTP streaming mode with OCI IAM identity-domain OAuth. The separate [OCI API MCP server](https://github.com/oracle/mcp/tree/main/src/oci-api-mcp-server) supports stdio only.

**Critical security consideration:** Its generic `invoke_oci_api` can attempt create/update/delete operations, so **OCI IAM permissions must be genuinely read-only** and ideally tool execution additionally allowlisted to list/get operations. Do not connect a tenancy administrator. Do not paste OCI API private keys, secret strings, auth tokens or CLI config into ChatGPT or commit them to GitHub.

## Recommended sequence

### O-MCP-1: Local Codex read-only connection first

1. Founder signs into [Oracle Cloud Console](https://cloud.oracle.com/) and confirms account/tenancy **Home Region** and whether the account is still in the 30-day Trial or Always Free-only state. For privacy, avoid sharing tenancy/user OCIDs or invoices publicly. We currently cannot query OCI tenancy state without a connection.
2. Create a **separate narrowly scoped OCI IAM identity/group** and (where useful) a dedicated LocalEats lab compartment; do **not** give it the Administrators group. Use policies permitting only the necessary *inspect/read* of Compute instances, availability limits, storage and usage/budget metadata, within that compartment. Do **not** grant `use` or `manage`, instance-launch, VM termination, DNS, key-management, billing-upgrade or high-privilege user-management powers. In OCI, the `inspect` verb typically lists metadata; `read` also grants detailed get access, and precise permissions depend on resource type.
3. Configure the official OCI SDK/CLI profile securely on the founder's own Windows 11 machine (`%HOMEDRIVE%%HOMEPATH%\.oci\config`), using a locally protected OCI signing key. Oracle's [OCI key setup](https://docs.oracle.com/en-us/iaas/Content/Identity/access/to_upload_an_API_signing_key.htm) and [CLI configuration](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm) govern the credential setup. Do not grant broad file read access to other users or agents.
4. Run the reviewed official OCI Cloud MCP server locally via `uvx oracle.oci-cloud-mcp-server`, and register it as a **stdio MCP server in Codex**, specifying only its executable/arguments; never inline key contents. Configure it to load the **read-only OCI profile**, not an administrator/default profile. Verify a list/read operation and a **denied** create/write attempt in a safe test context without actually sending a mutation request (e.g. inspect IAM policy boundaries rather than launch a VM).
5. After the connection is active, let Codex inspect real Always Free quotas, trial status/home-region/instances and report. Do not auto-provision anything.

**Codex configuration details should be taken from its current MCP setup documentation and the installed Codex version; don't assume historical GUI/menu text is still valid.** Explicit user account linking is required.

### O-MCP-2: ChatGPT custom remote MCP

ChatGPT's current [custom MCP server guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) and [OpenAI plugin quickstart](https://developers.openai.com/plugins/quickstart) describe adding a **remote MCP connection** to ChatGPT (in supported accounts/workspaces). Look for **Plugins → Add custom MCP server** or the corresponding current custom-connection UI; account entitlements and admin settings may vary. Local stdio alone is not a URL for ChatGPT to connect to.

Choose **one** secure transport for the future, only after founder approval:

- **Preferred for occasional audits:** host Oracle MCP on a trusted local machine and use OpenAI's documented [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) if available. This keeps the Oracle server/private OCI profile off the public internet; local machine must be online when used.
- **If continuous cloud access is essential:** host the official OCI Cloud MCP HTTP streaming server behind a secure HTTPS endpoint, with **OCI IAM identity-domain OAuth**, the documented `ORACLE_MCP_BASE_URL` and `/auth/callback` registration in an OCI IAM confidential app, plus authentication, rate limits and least-privilege IAM scope. This is **not** free of operational or security work and may require a separately approved VM/resource. Do not publish an unauthenticated MCP endpoint or administrative signing key.

Oracle's official HTTP-mode configuration includes `ORACLE_MCP_HOST`, `ORACLE_MCP_PORT`, `ORACLE_MCP_BASE_URL`, `OCI_REGION`, `IDCS_DOMAIN`, `IDCS_CLIENT_ID`, `IDCS_CLIENT_SECRET`, and `IDCS_AUDIENCE`. These are private configuration values; **do not put them in source, client-side variables or conversation text**. Authentication must be tested before any SDK tool is invoked remotely.

### O-MCP-3: Read-only acceptance report

Once connected with explicit owner action, verify:
- Exactly which OCI account/tenancy and home region are accessible; no cross-tenant permission.
- Trial expiry date, remaining credits and PAYG status **if an authorized billing read action is available**; do not infer from sign-up date.
- Always Free eligible Compute shapes/remaining OCPU/GB-hour quota, storage, cost budgets and current running instances; inspect actual region capacity without launching instances.
- IAM denies creation/deletion, resource changes, secret exposure, plan upgrade and billing actions.
- Save verified non-sensitive facts to [canonical LocalEats project memory](LOCALEATS_PROJECT_MEMORY.md), not OCIDs or keys; report founder decision points.

## Example OCI IAM policy concepts (EXAMPLES ONLY — do not apply automatically)

Oracle's [IAM policy verb docs](https://docs.oracle.com/en-us/iaas/Content/Identity/policieshow/Verbs.htm) and [core reference](https://docs.oracle.com/en-us/iaas/Content/Identity/Reference/corepolicyreference.htm) support compartment-level read-only policies. For a proposed group `LocalEatsAIAuditors` and proposed compartment `LocalEats-Lab`, a later administrator could **review** sample policies such as:

```text
Allow group LocalEatsAIAuditors to inspect instances in compartment LocalEats-Lab
Allow group LocalEatsAIAuditors to inspect virtual-network-family in compartment LocalEats-Lab
Allow group LocalEatsAIAuditors to inspect volume-family in compartment LocalEats-Lab
Allow group LocalEatsAIAuditors to inspect compartments in tenancy
Allow group LocalEatsAIAuditors to inspect usage-budgets in tenancy
```

**Do not copy directly to the live account without confirming identity domain, scope and current OCI IAM syntax.** `inspect` may permit listing but not all detailed resource GETs or quota/billing reads; add a specific narrowly scoped `read` permission only if required and independently approved. Avoid `manage all-resources`, `use instances`, `manage instance-family` or any admin membership.

## Honest current state

- Oracle tenancy, account status, Free Tier remaining quota and current region **not independently inspected**, because the OCI MCP server has not been connected.
- No matching ready-made Oracle plugin discovered in ChatGPT's plugin directory search.
- Official Oracle OCI MCP and OpenAI custom MCP/Tunnel docs establish a viable **path**, but no authenticated connection or privileged testing has occurred.
- **No Oracle cloud resource, OCI IAM policy, signing key, MCP host or instance has been created.** Future actual setup requires explicit founder action to authorize the connection, and individual approvals for any consequential writes/spend.

**Recommended founder decision:** authorize *only* read-only OCI connection onboarding first, with no VM creation. After the connected audit, decide whether to deploy an Always Free isolated backend pilot or keep Cloudflare as public hosting.

See [Oracle hosting research and resource risk analysis](LOCALEATS_ORACLE_CLOUD_HOSTING_EVALUATION.md) and [Founder–AI charter](LOCALEATS_FOUNDER_CHARTER.md).
