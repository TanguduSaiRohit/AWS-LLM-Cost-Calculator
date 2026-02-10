import { handler } from "./bedrock-pricing.mjs";

handler()
  .then(() => console.log("Local test completed"))
  .catch(console.error);
