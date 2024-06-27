import { mount } from "./src/mount.mjs";
import { unitTests, integrationTests } from "./test-all.mjs";

unitTests();
integrationTests(mount);
