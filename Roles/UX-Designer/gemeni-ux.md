# UX Designer Domain Compiler Network

This document defines the atomic task types for a UX Designer within a formal Domain Compiler Network. It treats User Experience as a structured system of state coverage, navigational logic, and interaction patterns.

---

## Summary Table

| Task Name (Compiler ID) | Frequency      | Input                  | Output                       |
| :---------------------- | :------------- | :--------------------- | :--------------------------- |
| `ux-state-matrix`       | Daily          | Page/Component Spec    | JSON State Coverage Manifest |
| `ux-navigation-graph`   | Per-Project    | App Intent / Sitemap   | Directed Graph (JSON/DOT)    |
| `ux-user-flow`          | Per-Feature    | Intent + Routes        | Flow Sequence Manifest       |
| `ux-form-logic`         | Per-Feature    | `react-form` Spec      | Step & Branching Manifest    |
| `ux-permission-map`     | Per-Feature    | `auth-middleware` Spec | Access-Aware UI Branch Spec  |
| `ux-content-hierarchy`  | Per-Feature    | `i18n` + Data Schema   | Semantic Content Spec        |
| `ux-recovery-path`      | Per-Feature    | Error/Offline Specs    | Fallback & Retry Manifest    |
| `ux-variant-matrix`     | Per-Experiment | `feature-flag` Spec    | Experiment Branching Spec    |

---

## Detailed Compiler Breakdown

### 1. `ux-state-matrix`

- **Name:** State Coverage Compiler
- **Frequency:** Daily
- **Input:** Page ID, Data Query list, and UI Component list.
- **Output:** `state_matrix.json` (Mapping of every UI region to state variants).
- **Correctness Gates:**
  - Binary check: Every data-fetching component must have a defined "Partial Data" and "Empty" state.
  - Binary check: Every page-level transition must have a defined "Loading" state.
- **Dependencies:** `react-page`, `react-component`.
- **Downstream Consumers:** `react-page`, `ux-recovery-path`.
- **Spec file:** `{"pageId": "dashboard", "regions": [{"id": "balance_card", "states": {"loading": "shimmer", "empty": "zero_balance_msg"}}]}`
- **Error codes:** `UX101` (Missing Empty State), `UX102` (Uncovered Loading State), `UX103` (No Offline Fallback).
- **Key invariant:** A UI region cannot exist without a defined behavior for a null or pending data response.
- **Safe default:** Render a generic "Loading..." spinner and a "No data found" string.

---

### 2. `ux-navigation-graph`

- **Name:** Navigational Structure Compiler
- **Frequency:** Per-Project
- **Input:** Business Intent, User Roles, and Feature List.
- **Output:** `nav_graph.json` (Adjacency list of routes and navigation hierarchy).
- **Correctness Gates:**
  - Binary check: No "orphan" pages (all routes must be reachable from Root or a defined entry point).
  - Binary check: Every route in the graph must exist in the `api-route` or `react-page` inventory.
- **Dependencies:** `react-page`, `api-route`.
- **Downstream Consumers:** `ux-user-flow`, `auth-middleware`.
- **Spec file:** `{"nodes": [{"id": "home", "links": ["settings", "profile"]}], "entryPoints": ["/login"]}`
- **Error codes:** `UX201` (Unreachable Route), `UX202` (Cyclic Trap), `UX203` (Missing Back-path).
- **Key invariant:** Every node in the graph must have at least one incoming edge (except entry points).
- **Safe default:** Flat list of all available routes in a global navigation menu.

---

### 3. `ux-user-flow`

- **Name:** Task Flow Compiler
- **Frequency:** Per-Feature
- **Input:** User Goal and `ux-navigation-graph`.
- **Output:** `user_flow_manifest.json` (Ordered sequence of interactions).
- **Correctness Gates:**
  - Binary check: Flow must terminate in a defined "Success" or "Failure" state.
  - Binary check: All branching logic must be exhaustive (no undefined "if/else" UX paths).
- **Dependencies:** `ux-navigation-graph`, `react-page`.
- **Downstream Consumers:** `a11y-test`, `analytics-event`.
- **Spec file:** `{"flowId": "reset_pw", "steps": [{"action": "click_forgot", "leadsTo": "email_input"}]}`
- **Error codes:** `UX301` (Dead End Flow), `UX302` (Undefined Branch), `UX303` (Sequence Loop).
- **Key invariant:** A flow must have a finite number of steps before reaching a terminal state.
- **Safe default:** Redirect to "Home" on any undefined interaction.

---

### 4. `ux-form-logic`

- **Name:** Sequential Form Compiler
- **Frequency:** Per-Feature
- **Input:** `react-form` schema and multi-step intent.
- **Output:** `form_logic_spec.json` (Step order and branching).
- **Correctness Gates:**
  - Binary check: Destructive actions (Reset/Clear) must require a confirmation pattern.
  - Binary check: Summary step must exist before final submission for forms with >3 steps.
- **Dependencies:** `react-form`, `ts-schema`.
- **Downstream Consumers:** `react-form`, `react-component`.
- **Spec file:** `{"formId": "onboarding", "steps": [{"fields": ["name"], "next": "upload_id"}]}`
- **Error codes:** `UX401` (Missing Confirmation), `UX402` (Step Skip Error), `UX403` (Inconsistent Field State).
- **Key invariant:** Form submission cannot be triggered until all "Required" fields in the `ts-schema` are satisfied.
- **Safe default:** Single-page vertical list of all form fields.

---

### 5. `ux-permission-map`

- **Name:** Role-Based UX Compiler
- **Frequency:** Per-Feature
- **Input:** `auth-middleware` policy and User Roles.
- **Output:** `permission_ux_branch.json` (UI Visibility/Activity logic).
- **Correctness Gates:**
  - Binary check: Every "Unauthorized" state must have a corresponding "Request Access" or "Access Denied" UI pattern.
  - Binary check: UI visibility logic must match `auth-middleware` endpoint protection 1:1.
- **Dependencies:** `auth-middleware`, `api-route`.
- **Downstream Consumers:** `react-component`, `react-page`.
- **Spec file:** `{"role": "viewer", "restrictions": [{"targetId": "delete_btn", "action": "hide"}]}`
- **Error codes:** `UX501` (Auth/UX Mismatch), `UX502` (Exposed Forbidden Route), `UX503` (Missing Denied State).
- **Key invariant:** A UI element cannot be "Active" if its underlying `api-route` is protected by a higher-tier role.
- **Safe default:** Hide all elements requiring any specific permission.

---

### 6. `ux-content-hierarchy`

- **Name:** Content Structural Compiler
- **Frequency:** Per-Feature
- **Input:** `i18n` dictionary and UI components.
- **Output:** `content_hierarchy.json` (Semantic structure and placeholders).
- **Correctness Gates:**
  - Binary check: Every dynamic placeholder (e.g., `{{username}}`) must exist in the `ts-schema`.
  - Binary check: RTL structural inversion must be defined for all horizontal layouts.
- **Dependencies:** `i18n`, `ts-schema`.
- **Downstream Consumers:** `a11y-test`, `react-component`.
- **Spec file:** `{"region": "header", "h1": "welcome_title", "placeholders": ["user_name"]}`
- **Error codes:** `UX601` (Orphan Placeholder), `UX602` (Heading Level Skip), `UX603` (RTL Overflow Risk).
- **Key invariant:** Content cannot reference data keys not present in the compiled `ts-schema`.
- **Safe default:** Display raw translation keys as fallback text.

---

### 7. `ux-recovery-path`

- **Name:** Error Recovery Compiler
- **Frequency:** Per-Feature
- **Input:** `ux-state-matrix` and `api-route` failure modes.
- **Output:** `recovery_manifest.json` (Retry and Fallback logic).
- **Correctness Gates:**
  - Binary check: Every "Fatal Error" must provide a "Return to Safe State" action.
  - Binary check: Exponential backoff must be defined for all auto-retry patterns.
- **Dependencies:** `ux-state-matrix`, `api-route`.
- **Downstream Consumers:** `react-page`, `utility-fn`.
- **Spec file:** `{"trigger": "500_error", "action": "show_retry_btn", "maxRetries": 3}`
- **Error codes:** `UX701` (Infinite Retry Loop), `UX702` (Missing Escape Hatch), `UX703` (Vague Error Message).
- **Key invariant:** All error states must provide a path for the user to resume or exit the flow.
- **Safe default:** "An error occurred" message with a manual "Refresh" button.

---

### 8. `ux-variant-matrix`

- **Name:** Experiment Branch Compiler
- **Frequency:** Per-Experiment
- **Input:** `feature-flag` definitions and UX Variants.
- **Output:** `variant_ux_spec.json` (Experiment logic).
- **Correctness Gates:**
  - Binary check: Control (A) and Variant (B) must both terminate in valid terminal states.
  - Binary check: Analytics events must be identical in name across variants to ensure data parity.
- **Dependencies:** `feature-flag`, `analytics-event`.
- **Downstream Consumers:** `react-page`, `react-component`.
- **Spec file:** `{"flag": "new_onboarding", "variants": [{"id": "A", "flow": "legacy"}, {"id": "B", "flow": "modal_v2"}]}`
- **Error codes:** `UX801` (Variant Mismatch), `UX802` (Missing Control Branch), `UX803` (Tracking Disparity).
- **Key invariant:** An experiment variant cannot bypass mandatory security or schema constraints.
- **Safe default:** Fallback to the Control (A) variant.

---

## Recommended Build Order

The UX Compiler Network should be built using a **"Structure-to-State"** approach:

1.  **`ux-navigation-graph` (Foundation):** Necessary to map the reachability of the system.
2.  **`ux-state-matrix` (Coverage):** Defines the "what happens if" for every node in the graph.
3.  **`ux-permission-map`:** Layering access control onto the navigation and components.
4.  **`ux-user-flow` & `ux-form-logic`:** Building specific tasks on top of the map.
5.  **`ux-content-hierarchy`:** Defining the semantic and language-aware layer.
6.  **`ux-recovery-path`:** Hardening the flows against failure modes.
7.  **`ux-variant-matrix`:** Enabling experiments on top of the verified logic.
