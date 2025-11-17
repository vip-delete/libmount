import { vi } from "vitest";

if (process.env.NODE_ENV === "development") {
  vi.mock("libmount", () => import("../src/index.mjs"));
  // uncomment to run tests against dist files instead of source files
  // vi.mock("libmount", () => import("../dist/libmount.mjs"));
  // vi.mock("libmount", () => import("../dist/libmount.min.mjs"));
}

import "./index.mjs";
