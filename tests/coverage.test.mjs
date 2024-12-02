import { integrationTests, unitTests } from "./test-all.mjs";
import { mount } from "../src/lm.mjs";

unitTests();
integrationTests(mount);
