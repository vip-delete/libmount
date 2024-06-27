import { integrationTests, unitTests } from "./test-all.mjs";
import { mount } from "./src/mount.mjs";

unitTests();
integrationTests(mount);
