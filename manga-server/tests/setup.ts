// Test setup - Mock server functionality for isolated testing
import { beforeAll, afterAll } from "bun:test";

console.log(`
⚠️  IMPORTANT: Integration tests require the server to be running.

Please start the server in another terminal before running tests:
   bun run start

Or run the server in test mode with smaller cache:
   CACHE_SIZE_MB=512 MAX_CONNECTIONS=1000 bun run start

Then run tests in this terminal:
   bun run test
`);