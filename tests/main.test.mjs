import { vi } from "vitest";

if (process.env.NODE_ENV === "development") {
  vi.mock("libmount", () => import("../src/index.mjs"));
}

import "./index.mjs";
