# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Also update major or/and minor or/and hotfix (ex. version 1.0.0)

# Production Readiness Guidelines: React Native & Expo

## 1. Architecture & Directory Topology

Enforce a Feature-First (Modular) Architecture. Layer-first (type-based) structures are prohibited.

### Directory Structure

* **`src/features/`**: Core domain boundaries (e.g., `auth`, `checklist`, `calendar`). Each directory must isolate its own components, hooks, and state logic.
* **`src/components/`**: Restricted to shared, generic UI components (e.g., global `Button`, `Input`).
* **`src/services/`**: Infrastructure abstractions (API clients, storage wrappers). Direct storage/network access from components is prohibited.
* **Barrel Exports**: Maintain an `index.ts` or `index.js` at the root of each feature directory. External modules must only import from this public API.

---

## 2. Navigation & Routing Engine

Implement declarative, decoupled navigation via Expo Router or React Navigation.

* **Centralized Routes**: Define route layouts statically within the designated folder (`app/` or `src/navigation/`). Hardcoded string navigation pathways are forbidden.
* **Deep Linking**: Configure native schemes (`app.json` -> `expo.scheme`) and universal link maps to manage external intents without state corruption.

---

## 3. Performance Engineering

### Rendering Optimization

* **List Recycling**: Use Shopify’s `@shopify/flash-list` instead of the core `FlatList` component for open-ended datasets to avoid blank spaces during fast scrolling.
* **Memoization Boundaries**: Apply `React.memo` to complex leaf components in lists. Wrap callback handlers passed to children in `useCallback`.

### Asset Management

* **Image Caching**: Prohibit primitive `<Image />` tags for remote network assets. Use `expo-image` for native disk/memory caching and blurhash support.

---

## 4. Extensibility & Regression Defenses

### Separation of Concerns

* **Hook Pattern**: Isolate business logic from layout views. Component files must handle only layout and styling. All state transitions and side effects must reside in custom hooks (e.g., `useChecklistData.js`).

### Automated Testing Hierarchy

| Test Category | Target Scope | Rule |
| --- | --- | --- |
| **Unit Tests** | Services, Hooks, Utilities | 100% path coverage for edge cases, math, and date modifications. |
| **Integration** | Complete Features / Interactivity | Mock network layers via MSW; verify UI state updates. |
| **End-to-End** | Critical Flows (Auth, Persistence) | Execute via Detox or Expo Test Runner on live emulators. |

---

## 5. UI/UX Production Standards

* **Design Tokens**: Hardcoded values (`color`, `padding`) inside component styles are prohibited. Use a global theme configuration or utility framework (e.g., `nativewind`).
* **Safe Areas**: Wrap terminal layouts within `<SafeAreaView>` or utilize `react-native-safe-area-context` to dynamically compute display notches and hardware offsets.
* **Asynchronous Interface States**: Every UI component binding to an async resource must explicitly handle and style four distinct states:
1. **Loading**: Skeletal layouts or active indicators.
2. **Success**: Populated data matrix.
3. **Empty**: Placeholder graphics/CTA when lists return length zero.
4. **Error**: Localized error capture with manual retry triggers.