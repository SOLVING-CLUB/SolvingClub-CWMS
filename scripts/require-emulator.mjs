// `pnpm test:fast` skips the emulators:exec wrapper to save its ~60s startup,
// so it needs an emulator already listening. Without this check the rules tests
// fail with opaque gRPC timeouts instead of saying what's wrong.
import { createConnection } from "node:net";

const HOST = "127.0.0.1";
const PORT = 8080; // firebase.json → emulators.firestore.port

const reachable = await new Promise((resolve) => {
  const socket = createConnection({ host: HOST, port: PORT });
  const settle = (result) => { socket.destroy(); resolve(result); };
  socket.setTimeout(1500);
  socket.once("connect", () => settle(true));
  socket.once("timeout", () => settle(false));
  socket.once("error", () => settle(false));
});

if (!reachable) {
  console.error(
    `\nNo Firestore emulator on ${HOST}:${PORT}.\n\n` +
    `  Start one in another terminal:  pnpm emu\n` +
    `  Or run the self-contained suite: pnpm test\n`,
  );
  process.exit(1);
}
