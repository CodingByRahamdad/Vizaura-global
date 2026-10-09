import { createApp } from "./app/app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`VIZAURA GLOBAL backend listening on port ${env.port} (${env.nodeEnv})`);
});
