import https from "https";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });

const PRICING_URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/index.json";

const OUTPUT_BUCKET = "bedrock-pricing-cache";
const OUTPUT_KEY = "bedrock/normalized-pricing.json";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
  });
}

export const handler = async () => {

  const pricingData = await fetchJson(PRICING_URL);
  const products = pricingData.products;
  const onDemand = pricingData.terms.OnDemand;

  const normalized = [];

for (const sku in products) {
  const product = products[sku];
  const attrs = product.attributes;

  // 1️⃣ Only Bedrock
  if (attrs.servicecode !== "AmazonBedrock") continue;
  if (!attrs.usagetype || !attrs.regionCode) continue;

  const usagetype = attrs.usagetype.toLowerCase();

  // 2️⃣ Only TEXT token pricing
  if (!usagetype.includes("-input-tokens") && !usagetype.includes("-output-tokens"))
    continue;

  // ❌ Skip non-text modalities & irrelevant charges
  if (
    usagetype.includes("image") ||
    usagetype.includes("audio") ||
    usagetype.includes("video") ||
    usagetype.includes("embedding") ||
    usagetype.includes("guardrail") ||
    usagetype.includes("customization") ||
    usagetype.includes("storage") ||
    usagetype.includes("provisionedthroughput")
  ) {
    continue;
  }

  const pricingTerms = onDemand[sku];
  if (!pricingTerms) continue;

  const priceDimensions =
    Object.values(pricingTerms)[0]?.priceDimensions;
  if (!priceDimensions) continue;

  const pricePerUnit =
    Object.values(priceDimensions)[0]?.pricePerUnit?.USD;
  if (!pricePerUnit) continue;

  // 3️⃣ Extract model name from usagetype
  // Example: "usw2-titantextg1-lite-input-tokens"
  const cleaned = usagetype
    .replace(/^(use1|usw2|aps\d+|eu\w+|can\d+|eun\d+|eus\d+|apn\d+)-/, "")
    .replace("-input-tokens", "")
    .replace("-output-tokens", "")
    .replace(/-(batch|priority|flex|cross-region-global)/g, "");

  const modelName = cleaned;

  // 4️⃣ Find or create entry
  let entry = normalized.find(
    (m) =>
      m.name === modelName &&
      m.region === attrs.regionCode
  );

  if (!entry) {
    entry = {
      provider: attrs.providerName || "AWS Bedrock",
      name: modelName,
      region: attrs.regionCode,
      inputCost: null,
      outputCost: null,
      source: "default",
    };
    normalized.push(entry);
  }

  // 5️⃣ Assign prices
  if (usagetype.includes("-input-tokens")) {
    entry.inputCost = parseFloat(pricePerUnit);
  }

  if (usagetype.includes("-output-tokens")) {
    entry.outputCost = parseFloat(pricePerUnit);
  }
}

  const finalData = normalized.filter((m) => m.inputCost !== null && m.outputCost !== null);

  console.log(`Normalized ${finalData.length} entries`);

  await s3.send(
    new PutObjectCommand({
      Bucket: OUTPUT_BUCKET,
      Key: OUTPUT_KEY,
      Body: JSON.stringify(finalData, null, 2),
      ContentType: "application/json",
    })
 );

  return {
    statusCode: 200,
    body: "Bedrock pricing sync completed",
  };
};