import dotenv from "dotenv";
import { createApp } from "./app.js";
import { startNearbySightingUpdateProcessor } from "./services/nearby-sighting-update-notifications.js";
import { startSightingDigestProcessor } from "./services/sighting-digest-queue.js";

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
  startSightingDigestProcessor();
  startNearbySightingUpdateProcessor();
});
