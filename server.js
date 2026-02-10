import express from "express";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static("."));

// Use local pricing file instead of S3 so AWS credentials are not required
const LOCAL_PRICING_PATH = path.resolve(process.cwd(), "normalized-pricing.json");

// Pricing endpoint
app.get("/pricing/normalized-pricing.json", async (req, res) => {
  const fallbackData = [
    { name: "Claude 3 Haiku", region: "us-east-1", inputCost: 0.00025, outputCost: 0.00125 },
    { name: "Claude 3 Sonnet", region: "us-east-1", inputCost: 0.003, outputCost: 0.015 },
    { name: "Claude 3 Opus", region: "us-east-1", inputCost: 0.015, outputCost: 0.075 },
    { name: "Titan Text G1", region: "us-east-1", inputCost: 0.0005, outputCost: 0.0065 },
    { name: "Llama 3 Instruct (70B)", region: "mumbai", inputCost: 0.00265, outputCost: 0.0035 }
  ];

  try {
    // Try to read local pricing file
    try {
      const jsonString = await fs.readFile(LOCAL_PRICING_PATH, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.send(jsonString);
      console.log("Pricing data served from local file:", LOCAL_PRICING_PATH);
      return;
    } catch (e) {
      console.log("Local pricing file not found or unreadable, using fallback data:", e.message);
    }
  } catch (err) {
    console.error("Failed to fetch pricing:", err.message);
    console.error("Error code:", err.code);
    console.error("Error name:", err.name);
    
    res.status(200).setHeader("Content-Type", "application/json");
    res.json(fallbackData);
    console.log("Sent fallback pricing data due to error:", err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  const fallbackData = [
    { name: "Claude 3 Haiku", region: "us-east-1", inputCost: 0.00025, outputCost: 0.00125 },
    { name: "Claude 3 Sonnet", region: "us-east-1", inputCost: 0.003, outputCost: 0.015 },
    { name: "Claude 3 Opus", region: "us-east-1", inputCost: 0.015, outputCost: 0.075 },
    { name: "Titan Text G1", region: "us-east-1", inputCost: 0.0005, outputCost: 0.0065 },
    { name: "Llama 3 Instruct (70B)", region: "mumbai", inputCost: 0.00265, outputCost: 0.0035 }
  ];
  res.status(200).json(fallbackData);
});
