
/* ===================== UNIFIED MODEL STORE ===================== */

const modelsStore = {
  defaults: [],
  custom: [],
  get all() {
    return [...this.defaults, ...this.custom];
  }
};

/* ===================== INITIALIZATION ===================== */

document.addEventListener("DOMContentLoaded", async () => {
  await loadDefaultModels();
  loadCustomModels();
  setupDropdowns();
  renderModelManagement();
  showAllModels();
});

async function loadDefaultModels() {
  console.log("Loading default models...");
  try {
    console.log("Fetching from /pricing/normalized-pricing.json...");
    const res = await fetch("/pricing/normalized-pricing.json");
    console.log("Fetch response status:", res.status, res.statusText);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const awsPricing = await res.json();
    console.log("Raw S3 data:", awsPricing);
    
    if (awsPricing && awsPricing.length > 0) {
      // Store full S3 data for reference pricing
      bedrockPricing = awsPricing.map(model => ({
        ...model,
        name: model.name || model.modelName,
        provider: "AWS"
      }));
      
      // Filter S3 data to only include the 5 default models
      const filteredModels = [];
      DEFAULT_MODELS.forEach(defaultModel => {
        const s3Model = awsPricing.find(model => 
          (model.name || model.modelName) === defaultModel.name && 
          model.region === defaultModel.region
        );
        if (s3Model) {
          filteredModels.push({
            ...defaultModel,
            inputCost: s3Model.inputCost || s3Model.input_cost || defaultModel.inputCost,
            outputCost: s3Model.outputCost || s3Model.output_cost || defaultModel.outputCost
          });
        } else {
          filteredModels.push(defaultModel);
        }
      });
      
      modelsStore.defaults = filteredModels;
      console.log("✅ Filtered AWS pricing loaded:", modelsStore.defaults.length);
    } else {
      loadFallbackData();
    }
  } catch (e) {
    console.error("❌ AWS pricing load failed:", e);
    loadFallbackData();
  }
}

// Define the 5 default models
const DEFAULT_MODELS = [
  { provider: "AWS", name: "Claude 3 Haiku", region: "us-east-1", inputCost: 0.00025, outputCost: 0.00125, source: "default" },
  { provider: "AWS", name: "Claude 3 Sonnet", region: "us-east-1", inputCost: 0.003, outputCost: 0.015, source: "default" },
  { provider: "AWS", name: "Claude 3 Opus", region: "us-east-1", inputCost: 0.015, outputCost: 0.075, source: "default" },
  { provider: "AWS", name: "Titan Text G1", region: "us-east-1", inputCost: 0.0005, outputCost: 0.0065, source: "default" },
  { provider: "AWS", name: "Llama 3 Instruct (70B)", region: "mumbai", inputCost: 0.00265, outputCost: 0.0035, source: "default" }
];

// Allowed regions
const ALLOWED_REGIONS = ["us-east-1", "mumbai"];

// Providers without API pricing
const PROVIDERS_WITHOUT_API_PRICING = new Set([
  "Anthropic",
  "Stability AI",
  "Writer",
  "Cohere",
  "AI21 Labs"
]);

// Provider to model keywords map
const PROVIDER_KEYWORDS = {
  "Amazon": ["titan", "nova"],

  // ❌ Anthropic not present in your data
  "Anthropic": ["claude"],

  "Google": ["gemma"],

  "Meta": ["llama"],

  "Mistral AI": [
    "mistral",
    "mixtral",
    "ministral",
    "magistral"
  ],

  "OpenAI": ["gpt"],

  "Cohere": ["command"],
  "AI21 Labs": ["jamba"],

  "DeepSeek": ["deepseek"],

  "Moonshot AI": ["kimi"],

  "MiniMax AI": ["minimax"],

  "NVIDIA": ["nemotron"],

  "Qwen": ["qwen"],

  // ❌ Stability not present
  "Stability AI": ["sdxl", "stable"],

  "TwelveLabs": ["voxtral"],

  // ❌ Writer not present
  "Writer": ["palmyra"]
};

// Store for full S3 pricing data
let bedrockPricing = [];

function loadFallbackData() {
  console.log("Loading fallback data for dropdowns...");
  modelsStore.defaults = [...DEFAULT_MODELS];
}



function loadCustomModels() {
  const stored = localStorage.getItem("customModels");
  modelsStore.custom = stored ? JSON.parse(stored) : [];
}

function saveCustomModels() {
  localStorage.setItem("customModels", JSON.stringify(modelsStore.custom));
}

/* ===================== TOKEN CALCULATOR (LEFT TOP) ===================== */

function setupDropdowns() {
  console.log("Setting up dropdowns, total models:", modelsStore.all.length);
  
  const regionSelect = document.getElementById("regionSelect");
  const providerSelect = document.getElementById("providerFilter");
  const modelSelect = document.getElementById("modelSelect");

  // Populate regions from all models (default + custom)
  const allRegions = [...new Set(modelsStore.all.map(m => m.region))];
  regionSelect.innerHTML = `<option value="">Select Region</option>`;
  allRegions.forEach(r => {
    regionSelect.innerHTML += `<option value="${r}">${r}</option>`;
  });

  // Clear other dropdowns
  providerSelect.innerHTML = `<option value="">Select Provider</option>`;
  modelSelect.innerHTML = `<option value="">Select Model</option>`;

  regionSelect.onchange = updateProviders;
  providerSelect.onchange = updateModels;
}

function updateProviders() {
  const selectedRegion = document.getElementById("regionSelect").value;
  const providerSelect = document.getElementById("providerFilter");
  
  // Show models from both default and custom models
  const filteredModels = selectedRegion ? 
    modelsStore.all.filter(m => m.region === selectedRegion) : 
    modelsStore.all;
  
  const providers = [...new Set(filteredModels.map(m => m.provider))];
  providerSelect.innerHTML = `<option value="">Select Provider</option>`;
  providers.forEach(p => {
    providerSelect.innerHTML += `<option value="${p}">${p}</option>`;
  });
  
  updateModels();
}

function updateModels() {
  const selectedRegion = document.getElementById("regionSelect").value;
  const selectedProvider = document.getElementById("providerFilter").value;
  const modelSelect = document.getElementById("modelSelect");

  modelSelect.innerHTML = `<option value="">Select Model</option>`;

  if (selectedRegion) {
    // Show all models (default + custom) that match the filters
    modelsStore.all.forEach((m, i) => {
      const matchesRegion = m.region === selectedRegion;
      const matchesProvider = !selectedProvider || m.provider === selectedProvider;

      if (matchesRegion && matchesProvider) {
        modelSelect.innerHTML += `<option value="${i}">${m.name}</option>`;
      }
    });
  }
}

function calculateCost() {
  // Update button states
  document.getElementById('calculateBtn').className = '';
  document.getElementById('compareBtn').className = 'secondary';
  document.getElementById('comparison').style.display = 'none';
  
  const modelIndex = document.getElementById("modelSelect").value;
  const inputTokens = Number(document.getElementById("inputTokens").value);
  const outputTokens = Number(document.getElementById("outputTokens").value);
  const requests = Number(document.getElementById("requestsPerMonth").value);

  if (modelIndex === "" || [inputTokens, outputTokens, requests].some(isNaN)) {
    alert("Please select a model and enter valid numbers.");
    return;
  }

  const model = modelsStore.all[parseInt(modelIndex)];
  const totalInputTokens = inputTokens * requests;
  const totalOutputTokens = outputTokens * requests;
  const monthlyInputCost = (model.inputCost / 1000) * totalInputTokens;
  const monthlyOutputCost = (model.outputCost / 1000) * totalOutputTokens;
  const totalCost = monthlyInputCost + monthlyOutputCost;

  document.getElementById("results").innerHTML = `
    <div class="card results-card">
      <b>Selected Model:</b> ${model.name} (${model.provider})<br/><br/>
      <b>Monthly Input Token Cost:</b> ${monthlyInputCost.toFixed(4)} USD<br/>
      <b>Monthly Output Token Cost:</b> ${monthlyOutputCost.toFixed(4)} USD<br/>
      <b>Total Monthly Cost:</b> <b>${totalCost.toFixed(4)} USD</b>
    </div>

    <div class="card">
      <b>Token Calculations</b><br/>
      Input: ${inputTokens} × ${requests} = ${totalInputTokens}<br/>
      Output: ${outputTokens} × ${requests} = ${totalOutputTokens}
    </div>

    <div class="card">
      <b>Cost Breakdown</b><br/>
      Input Cost: (${model.inputCost}/1000) × ${totalInputTokens} = ${monthlyInputCost.toFixed(4)} USD<br/>
      Output Cost: (${model.outputCost}/1000) × ${totalOutputTokens} = ${monthlyOutputCost.toFixed(4)} USD
    </div>
  `;
}

/* ===================== ADD MODEL (LEFT BOTTOM) ===================== */

function getReferencePricingForProvider(provider) {
  const keywords = PROVIDER_KEYWORDS[provider];
  if (!keywords) return [];

  return bedrockPricing.filter(p => {
    const name = p.name?.toLowerCase() || "";
    return keywords.some(k => name.includes(k));
  });
}

function renderReferencePricingTable(referenceModels) {
  if (referenceModels.length === 0) return "";
  
  let html = `<div class="card"><b>Reference Pricing for ${document.getElementById("providerName").value}</b><br/>`;
  html += `<div style="max-height: 300px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--accent-blue) var(--bg-secondary);">`;
  html += `<style>
    .card div::-webkit-scrollbar { width: 8px; }
    .card div::-webkit-scrollbar-track { background: var(--bg-secondary); }
    .card div::-webkit-scrollbar-thumb { background: var(--accent-blue); border-radius: 4px; }
    .card div::-webkit-scrollbar-thumb:hover { background: var(--accent-blue-light); }
  </style>`;
  html += `<table style="width: 100%; margin-top: 10px; border-collapse: collapse;">`;
  html += `<tr style="background: var(--bg-tertiary); font-weight: bold;">`;
  html += `<td style="padding: 8px; border: 1px solid var(--border-color);">Model</td>`;
  html += `<td style="padding: 8px; border: 1px solid var(--border-color);">Region</td>`;
  html += `<td style="padding: 8px; border: 1px solid var(--border-color);">Input Cost</td>`;
  html += `<td style="padding: 8px; border: 1px solid var(--border-color);">Output Cost</td>`;
  html += `</tr>`;
  
  referenceModels.forEach(model => {
    html += `<tr>`;
    html += `<td style="padding: 8px; border: 1px solid var(--border-color); font-size: 12px;">${model.name}</td>`;
    html += `<td style="padding: 8px; border: 1px solid var(--border-color); font-size: 12px;">${model.region}</td>`;
    html += `<td style="padding: 8px; border: 1px solid var(--border-color); font-size: 12px;">$${(model.inputCost || model.input_cost || 0).toFixed(6)}</td>`;
    html += `<td style="padding: 8px; border: 1px solid var(--border-color); font-size: 12px;">$${(model.outputCost || model.output_cost || 0).toFixed(6)}</td>`;
    html += `</tr>`;
  });
  
  html += `</table>`;
  html += `</div></div>`;
  return html;
}

function showReferencePricing() {
  const selectedProvider = document.getElementById("providerName").value;
  const referenceDiv = document.getElementById("referencePricing");
  const regionSelectionRow = document.getElementById("regionSelectionRow");
  
  if (!selectedProvider || selectedProvider === "Other") {
    referenceDiv.innerHTML = "";
    regionSelectionRow.style.display = "none";
    return;
  }

  // Show region selection for all providers
  regionSelectionRow.style.display = "block";
  populateRegionCheckboxes(selectedProvider);
  
  // Reset dropdown text
  document.getElementById("regionDropdownText").textContent = "Select Region";
  document.getElementById("regionDropdownContent").style.display = "none";
  document.querySelector(".dropdown-arrow").classList.remove("rotated");

  // Initially show all models for the provider
  updateReferencePricingTable(selectedProvider);
}

function updateReferencePricingTable(selectedProvider) {
  const referenceDiv = document.getElementById("referencePricing");
  const selectedRegions = getSelectedRegions();
  
  let referenceModels = getReferencePricingForProvider(selectedProvider);
  
  // Filter by selected regions if any are selected
  if (selectedRegions.length > 0) {
    referenceModels = referenceModels.filter(model => 
      selectedRegions.includes(model.region)
    );
  }
  
  if (referenceModels.length === 0 && PROVIDERS_WITHOUT_API_PRICING.has(selectedProvider)) {
    referenceDiv.innerHTML = `
      <div class="card" style="padding: 12px 16px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); margin: 8px; font-size: 14px; min-width: 180px;">
        
        Refer <a href="https://aws.amazon.com/bedrock/pricing/" target="_blank" style="color: var(--accent-blue-light); text-decoration: underline;">
        AWS Bedrock Pricing</a> for the latest pricing details.
      </div>
    `;
    return;
  }

  if (referenceModels.length === 0) {
    const message = selectedRegions.length > 0 ? 
      `No models available for ${selectedProvider} in the selected regions` :
      `No reference pricing available for ${selectedProvider}`;
    referenceDiv.innerHTML = `<div class="card"><b>${message}</b></div>`;
    return;
  }

  referenceDiv.innerHTML = renderReferencePricingTable(referenceModels, selectedRegions.length > 0);
}

function populateRegionCheckboxes(selectedProvider) {
  const regionDropdownContent = document.getElementById("regionDropdownContent");
  
  // Hardcoded list of common AWS regions
  const hardcodedRegions = [
    'us-east-1',
    'us-east-2', 
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-west-2',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-south-1',
    'ca-central-1',
    'sa-east-1',
    'mumbai'
  ];
  
  regionDropdownContent.innerHTML = '';
  hardcodedRegions.forEach((region, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.innerHTML = `
      <input type="checkbox" id="region_${index}" value="${region}" onchange="updateRegionSelection('${selectedProvider}')">
      <label for="region_${index}" style="margin: 0; cursor: pointer;">${region}</label>
    `;
    regionDropdownContent.appendChild(optionDiv);
  });
}

function toggleRegionDropdown() {
  const content = document.getElementById("regionDropdownContent");
  const arrow = document.querySelector(".dropdown-arrow");
  
  if (content.style.display === "none") {
    content.style.display = "block";
    arrow.classList.add("rotated");
  } else {
    content.style.display = "none";
    arrow.classList.remove("rotated");
  }
}

function updateRegionSelection(selectedProvider) {
  const checkboxes = document.querySelectorAll('#regionDropdownContent input[type="checkbox"]:checked');
  const selectedRegions = Array.from(checkboxes).map(cb => cb.value);
  const dropdownText = document.getElementById("regionDropdownText");
  
  if (selectedRegions.length === 0) {
    dropdownText.textContent = "Select Region";
  } else if (selectedRegions.length === 1) {
    dropdownText.textContent = selectedRegions[0];
  } else {
    dropdownText.textContent = `${selectedRegions.length} regions selected`;
  }
  
  updateReferencePricingTable(selectedProvider);
}

function getRegionsForProvider(selectedProvider) {
  // Map the selected provider to the actual provider names in the data
  const providerMapping = {
    "Amazon": "AWS Bedrock",
    "Anthropic": "AWS Bedrock", // Claude models are on AWS Bedrock
    "Google": "AWS Bedrock", // Gemma models are on AWS Bedrock
    "MiniMax AI": "AWS Bedrock",
    "Mistral AI": "AWS Bedrock",
    "Moonshot AI": "AWS Bedrock",
    "NVIDIA": "AWS Bedrock",
    "OpenAI": "AWS Bedrock",
    "Qwen": "AWS Bedrock",
    "Stability AI": "AWS Bedrock",
    "TwelveLabs": "AWS Bedrock",
    "Writer": "AWS Bedrock"
  };
  
  const actualProvider = providerMapping[selectedProvider] || selectedProvider;
  
  // Get models for this provider using keywords
  const keywords = PROVIDER_KEYWORDS[selectedProvider];
  if (!keywords) return [];
  
  const providerModels = bedrockPricing.filter(model => {
    const name = model.name?.toLowerCase() || "";
    return keywords.some(k => name.includes(k));
  });
  
  // Extract unique regions
  const regions = [...new Set(providerModels.map(model => model.region))].sort();
  return regions;
}

function selectAllRegions(selectedProvider) {
  const checkboxes = document.querySelectorAll('#regionCheckboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => checkbox.checked = true);
  updateReferencePricingTable(selectedProvider);
}

function deselectAllRegions(selectedProvider) {
  const checkboxes = document.querySelectorAll('#regionCheckboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => checkbox.checked = false);
  updateReferencePricingTable(selectedProvider);
}

function getSelectedRegions() {
  const checkboxes = document.querySelectorAll('#regionDropdownContent input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

function addModel() {
  const providerSelect = document.getElementById("providerName");
  const customProviderInput = document.getElementById("customProvider");
  const provider = providerSelect.value === "Other" ? customProviderInput.value.trim() : providerSelect.value;
  
  const name = document.getElementById("modelName").value.trim();
  const inputCost = parseFloat(document.getElementById("inputCost").value);
  const outputCost = parseFloat(document.getElementById("outputCost").value);
  
  // Get selected regions
  const selectedRegions = providerSelect.value === "Other" ? 
    [document.getElementById("region").value.trim()] : 
    getSelectedRegions();

  if (!provider || !name || isNaN(inputCost) || isNaN(outputCost)) {
    alert("Please fill all fields correctly");
    return;
  }
  
  if (providerSelect.value !== "Other" && selectedRegions.length === 0) {
    alert("Please select at least one region");
    return;
  }
  
  if (providerSelect.value === "Other" && !selectedRegions[0]) {
    alert("Please enter a region");
    return;
  }

  // Add models for each selected region
  selectedRegions.forEach(region => {
    if (region.trim()) {
      modelsStore.custom.push({
        provider,
        name,
        region: region.trim(),
        inputCost,
        outputCost,
        source: "custom"
      });
    }
  });

  saveCustomModels();
  
  // Clear form
  providerSelect.value = "";
  customProviderInput.value = "";
  document.getElementById("customProviderRow").style.display = "none";
  document.getElementById("regionSelectionRow").style.display = "none";
  document.getElementById("modelName").value = "";
  document.getElementById("region").value = "";
  document.getElementById("inputCost").value = "";
  document.getElementById("outputCost").value = "";
  document.getElementById("referencePricing").innerHTML = "";

  // Refresh UI
  setupDropdowns();
  renderModelManagement();
  
  const regionCount = selectedRegions.length;
  const message = regionCount > 1 ? 
    `Model added successfully for ${regionCount} regions!` : 
    "Model added successfully!";
  alert(message);
}

/* ===================== MODEL MANAGEMENT (RIGHT) ===================== */

let currentView = "all";
let filteredModels = [];

function renderModelManagement() {
  // Only show the 5 default models + custom models in Model Management
  let defaultModels, customModels;
  
  if (currentView === "filter" && filteredModels.length >= 0) {
    // Filter to only include default models and custom models
    const relevantFiltered = filteredModels.filter(m => 
      modelsStore.defaults.includes(m) || modelsStore.custom.includes(m)
    );
    defaultModels = relevantFiltered.filter(m => m.source === "default");
    customModels = relevantFiltered.filter(m => m.source === "custom");
  } else {
    // Show only the 5 default models + custom models
    defaultModels = [...modelsStore.defaults];
    customModels = [...modelsStore.custom];
  }
  
  const modelList = document.getElementById("modelList");
  
  modelList.innerHTML = "";

  if (defaultModels.length === 0 && customModels.length === 0 && currentView === "filter") {
    modelList.innerHTML = '<div class="card"><b>No models match the selected filters</b></div>';
    return;
  }

  // Render Default Models Section
  if (defaultModels.length > 0) {
    modelList.innerHTML += '<h3 style="margin: 1rem 0 0.5rem 0; color: brown;">Default Models</h3>';
    modelList.innerHTML += '<div style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">';
    
    defaultModels.forEach((model) => {
      const actualIndex = modelsStore.all.indexOf(model);
      
      modelList.innerHTML += `
        <div class="accordion-item">
          <div class="accordion-header" onclick="toggleAccordion(${actualIndex})">
            <div class="accordion-title">
              <div class="model-name">${model.name} <span class="label">${model.source}</span></div>
              <div class="model-info">Provider: ${model.provider}</div>
            </div>
            <div class="accordion-icon" id="icon-${actualIndex}">▼</div>
          </div>
          <div class="accordion-content" id="content-${actualIndex}">
            <div class="accordion-body">
              <div class="accordion-field">
                <label>Region:</label>
                <input id="region-${actualIndex}" value="${model.region}" readonly style="background: var(--bg-tertiary); cursor: not-allowed;" />
              </div>
              <div class="accordion-field">
                <label>Input Cost:</label>
                <input id="in-${actualIndex}" value="${model.inputCost}" readonly style="background: var(--bg-tertiary); cursor: not-allowed;" placeholder="$ per 1K tokens" />
              </div>
              <div class="accordion-field">
                <label>Output Cost:</label>
                <input id="out-${actualIndex}" value="${model.outputCost}" readonly style="background: var(--bg-tertiary); cursor: not-allowed;" placeholder="$ per 1K tokens" />
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    modelList.innerHTML += '</div>';
  }

  // Render Added Models Section
  if (customModels.length > 0) {
    modelList.innerHTML += '<h3 style="margin: 1.5rem 0 0.5rem 0; color: orange;">Added Models</h3>';
    modelList.innerHTML += '<div style="max-height: 200px; overflow-y: auto;">';
    
    customModels.forEach((model) => {
      const actualIndex = modelsStore.all.indexOf(model);
      
      modelList.innerHTML += `
        <div class="accordion-item">
          <div class="accordion-header" onclick="toggleAccordion(${actualIndex})">
            <div class="accordion-title">
              <div class="model-name">${model.name} <span class="label">${model.source}</span></div>
              <div class="model-info">Provider: ${model.provider}</div>
            </div>
            <div class="accordion-icon" id="icon-${actualIndex}">▼</div>
          </div>
          <div class="accordion-content" id="content-${actualIndex}">
            <div class="accordion-body">
              <div class="accordion-field">
                <label>Region:</label>
                <input id="region-${actualIndex}" value="${model.region}" />
              </div>
              <div class="accordion-field">
                <label>Input Cost:</label>
                <input id="in-${actualIndex}" value="${model.inputCost}" placeholder="$ per 1K tokens" />
              </div>
              <div class="accordion-field">
                <label>Output Cost:</label>
                <input id="out-${actualIndex}" value="${model.outputCost}" placeholder="$ per 1K tokens" />
              </div>
              <div class="accordion-actions">
                <button class="secondary" onclick="updateModel(${actualIndex})">Save</button>
                <button class="danger" onclick="deleteModel(${actualIndex})">Remove</button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    modelList.innerHTML += '</div>';
  }
}

function toggleAccordion(index) {
  const content = document.getElementById(`content-${index}`);
  const icon = document.getElementById(`icon-${index}`);
  const header = content.previousElementSibling;
  
  const isExpanded = content.classList.contains('expanded');
  
  if (isExpanded) {
    content.classList.remove('expanded');
    icon.classList.remove('rotated');
    header.classList.remove('active');
  } else {
    content.classList.add('expanded');
    icon.classList.add('rotated');
    header.classList.add('active');
  }
}

function updateModel(index) {
  const model = modelsStore.all[index];
  const isDefault = model.source === "default";
  
  if (isDefault) {
    // Update default model in the defaults array
    const defaultIndex = modelsStore.defaults.indexOf(model);
    if (defaultIndex >= 0) {
      modelsStore.defaults[defaultIndex].region = document.getElementById(`region-${index}`).value.trim();
      modelsStore.defaults[defaultIndex].inputCost = parseFloat(document.getElementById(`in-${index}`).value);
      modelsStore.defaults[defaultIndex].outputCost = parseFloat(document.getElementById(`out-${index}`).value);
    }
  } else {
    // Update custom model
    const customIndex = index - modelsStore.defaults.length;
    if (customIndex >= 0) {
      modelsStore.custom[customIndex].region = document.getElementById(`region-${index}`).value.trim();
      modelsStore.custom[customIndex].inputCost = parseFloat(document.getElementById(`in-${index}`).value);
      modelsStore.custom[customIndex].outputCost = parseFloat(document.getElementById(`out-${index}`).value);
      saveCustomModels();
    }
  }
  
  setupDropdowns();
  renderModelManagement();
}

function deleteModel(index) {
  const model = modelsStore.all[index];
  const isDefault = model.source === "default";
  
  if (!confirm("Delete this model?")) return;
  
  if (isDefault) {
    // Remove from defaults array
    const defaultIndex = modelsStore.defaults.indexOf(model);
    if (defaultIndex >= 0) {
      modelsStore.defaults.splice(defaultIndex, 1);
    }
  } else {
    // Remove from custom array
    const customIndex = index - modelsStore.defaults.length;
    if (customIndex >= 0) {
      modelsStore.custom.splice(customIndex, 1);
      saveCustomModels();
    }
  }
  
  setupDropdowns();
  renderModelManagement();
}

function resetDefaults() {
  if (!confirm("Remove all custom models?")) return;
  
  modelsStore.custom = [];
  saveCustomModels();
  setupDropdowns();
  renderModelManagement();
  document.getElementById("results").innerHTML = "";
}

/* ===================== FILTERING ===================== */

function showAllModels() {
  currentView = "all";
  document.getElementById("allTab").className = "secondary";
  document.getElementById("filterTab").className = "";
  document.getElementById("filterControls").style.display = "none";
  renderModelManagement();
}

function showFilteredModels() {
  currentView = "filter";
  document.getElementById("allTab").className = "";
  document.getElementById("filterTab").className = "secondary";
  document.getElementById("filterControls").style.display = "block";
  populateFilterDropdowns();
  renderModelManagement();
}

function populateFilterDropdowns() {
  const filterProvider = document.getElementById("filterProvider");
  const filterRegion = document.getElementById("filterRegion");

  // Only show providers from the 5 default models + custom models
  const relevantModels = [...modelsStore.defaults, ...modelsStore.custom];
  const providers = [...new Set(relevantModels.map(m => m.provider))];
  filterProvider.innerHTML = `<option value="">Select Provider</option>`;
  providers.forEach(p => {
    filterProvider.innerHTML += `<option value="${p}">${p}</option>`;
  });

  // Show all regions from default and custom models
  const regions = [...new Set(relevantModels.map(m => m.region))];
  filterRegion.innerHTML = `<option value="">Select Region</option>`;
  regions.forEach(r => {
    filterRegion.innerHTML += `<option value="${r}">${r}</option>`;
  });
}

function applyFilter() {
  const selectedProvider = document.getElementById("filterProvider").value;
  const selectedRegion = document.getElementById("filterRegion").value;

  // Only filter from the 5 default models + custom models
  const relevantModels = [...modelsStore.defaults, ...modelsStore.custom];
  
  if (!selectedProvider && !selectedRegion) {
    filteredModels = relevantModels;
  } else {
    filteredModels = relevantModels.filter(m => {
      const matchesProvider = !selectedProvider || m.provider === selectedProvider;
      const matchesRegion = !selectedRegion || m.region === selectedRegion;
      return matchesProvider && matchesRegion;
    });
  }
  renderModelManagement();
}

function clearFilter() {
  document.getElementById("filterProvider").value = "";
  document.getElementById("filterRegion").value = "";
  filteredModels = [];
  renderModelManagement();
}

/* ===================== GLOBAL FUNCTIONS ===================== */

function toggleCustomProvider() {
  const select = document.getElementById("providerName");
  const customProviderRow = document.getElementById("customProviderRow");
  const regionSelectionRow = document.getElementById("regionSelectionRow");
  
  if (select.value === "Other") {
    customProviderRow.style.display = "block";
    regionSelectionRow.style.display = "none";
  } else {
    customProviderRow.style.display = "none";
    // Region selection visibility is handled by showReferencePricing()
  }
}

function compareAllModels() {
  // Update button states
  document.getElementById('calculateBtn').className = 'secondary';
  document.getElementById('compareAllBtn').className = '';
  document.getElementById('compareBtn').className = 'secondary';
  document.getElementById('results').innerHTML = '';
  document.getElementById('modelSelection').style.display = 'none';
  
  const selectedRegion = document.getElementById("regionSelect").value;
  const selectedModelIndex = document.getElementById("modelSelect").value;
  const inputTokens = Number(document.getElementById("inputTokens").value);
  const outputTokens = Number(document.getElementById("outputTokens").value);
  const requests = Number(document.getElementById("requestsPerMonth").value);

  // Validation
  if (!selectedRegion || [inputTokens, outputTokens, requests].some(isNaN) || inputTokens <= 0 || outputTokens <= 0 || requests <= 0) {
    alert("Please select a region and enter valid token counts and requests per month.");
    return;
  }

  // Get all models in the selected region
  const regionModels = modelsStore.all.filter(m => m.region === selectedRegion);
  
  if (regionModels.length === 0) {
    alert("No models available in the selected region.");
    return;
  }

  // Calculate costs for all models in region
  const comparisons = regionModels.map(model => {
    const totalInputTokens = inputTokens * requests;
    const totalOutputTokens = outputTokens * requests;
    const monthlyInputCost = (model.inputCost / 1000) * totalInputTokens;
    const monthlyOutputCost = (model.outputCost / 1000) * totalOutputTokens;
    const totalCost = monthlyInputCost + monthlyOutputCost;
    
    return {
      model,
      totalCost,
      monthlyInputCost,
      monthlyOutputCost,
      totalInputTokens,
      totalOutputTokens,
      isSelected: selectedModelIndex !== "" && modelsStore.all[parseInt(selectedModelIndex)] === model
    };
  });

  // Sort by cost (cheapest first)
  comparisons.sort((a, b) => a.totalCost - b.totalCost);

  // Calculate price differences
  const selectedComparison = comparisons.find(c => c.isSelected);
  const baseCost = selectedComparison ? selectedComparison.totalCost : comparisons[0].totalCost;

  // Generate comparison HTML with accordions
  let html = `<div class="card results-card"><h3>Model Comparison for ${selectedRegion}</h3>`;
  html += `<p>Based on ${inputTokens} input tokens, ${outputTokens} output tokens, ${requests} requests/month</p>`;
  
  comparisons.forEach((comp, index) => {
    const priceDiff = comp.totalCost - baseCost;
    const diffClass = priceDiff > 0 ? 'positive' : priceDiff < 0 ? 'negative' : '';
    const diffText = priceDiff === 0 ? 'Base' : (priceDiff > 0 ? `+$${priceDiff.toFixed(4)}` : `-$${Math.abs(priceDiff).toFixed(4)}`);
    
    html += `
      <div class="accordion-item">
        <div class="accordion-header ${comp.isSelected ? 'selected' : ''}" onclick="toggleComparisonAccordion(${index})">
          <div class="accordion-title">
            <div class="model-name">${comp.model.name}</div>
            <div class="model-info">${comp.model.provider} • $${comp.totalCost.toFixed(4)}/month</div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="price-diff ${diffClass}">${diffText}</div>
            <div class="accordion-icon" id="comp-icon-${index}">▼</div>
          </div>
        </div>
        <div class="accordion-content" id="comp-content-${index}">
          <div class="accordion-body" style="max-height: 200px; overflow-y: auto;">
            <div class="card">
              <b>Selected Model:</b> ${comp.model.name} (${comp.model.provider})<br/><br/>
              <b>Monthly Input Token Cost:</b> ${comp.monthlyInputCost.toFixed(4)} USD<br/>
              <b>Monthly Output Token Cost:</b> ${comp.monthlyOutputCost.toFixed(4)} USD<br/>
              <b>Total Monthly Cost:</b> <b>${comp.totalCost.toFixed(4)} USD</b>
            </div>
            <div class="card">
              <b>Token Calculations</b><br/>
              Input: ${inputTokens} × ${requests} = ${comp.totalInputTokens}<br/>
              Output: ${outputTokens} × ${requests} = ${comp.totalOutputTokens}
            </div>
            <div class="card">
              <b>Cost Breakdown</b><br/>
              Input Cost: (${comp.model.inputCost}/1000) × ${comp.totalInputTokens} = ${comp.monthlyInputCost.toFixed(4)} USD<br/>
              Output Cost: (${comp.model.outputCost}/1000) × ${comp.totalOutputTokens} = ${comp.monthlyOutputCost.toFixed(4)} USD
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  
  const comparisonDiv = document.getElementById("comparison");
  comparisonDiv.innerHTML = html;
  comparisonDiv.style.display = "block";
}

function showModelSelection() {
  // Update button states
  document.getElementById('calculateBtn').className = 'secondary';
  document.getElementById('compareAllBtn').className = 'secondary';
  document.getElementById('compareBtn').className = '';
  document.getElementById('results').innerHTML = '';
  document.getElementById('comparison').style.display = 'none';
  
  const selectedRegion = document.getElementById("regionSelect").value;
  
  if (!selectedRegion) {
    alert("Please select a region first.");
    return;
  }
  
  const regionModels = modelsStore.all.filter(m => m.region === selectedRegion);
  
  if (regionModels.length === 0) {
    alert("No models available in the selected region.");
    return;
  }
  
  let html = `<div class="card results-card">`;
  html += `<h3>Select Models to Compare (${selectedRegion})</h3>`;
  html += `<p>Choose at least 2 models to compare:</p>`;
  
  regionModels.forEach((model, index) => {
    html += `
      <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px; border: 1px solid var(--border-secondary); border-radius: 8px;">
        <input type="checkbox" id="model-${index}" value="${index}" onchange="updateCompareButton()" style="width: auto;">
        <label for="model-${index}" style="flex: 1; margin: 0; cursor: pointer;">
          <strong>${model.name}</strong><br>
          <small>${model.provider} • Input: $${model.inputCost}/1K • Output: $${model.outputCost}/1K</small>
        </label>
      </div>
    `;
  });
  
  html += `<button id="compareSelectedBtn" onclick="compareSelectedModels()" disabled style="margin-top: 15px;">Compare Selected Models</button>`;
  html += `</div>`;
  
  const selectionDiv = document.getElementById("modelSelection");
  selectionDiv.innerHTML = html;
  selectionDiv.style.display = "block";
}

function updateCompareButton() {
  const checkboxes = document.querySelectorAll('#modelSelection input[type="checkbox"]:checked');
  const compareBtn = document.getElementById('compareSelectedBtn');
  compareBtn.disabled = checkboxes.length < 2;
}

function compareSelectedModels() {
  console.log("compareSelectedModels called - displaying in modal");
  const checkboxes = document.querySelectorAll('#modelSelection input[type="checkbox"]:checked');
  const selectedRegion = document.getElementById("regionSelect").value;
  const selectedModelIndex = document.getElementById("modelSelect").value;
  const inputTokens = Number(document.getElementById("inputTokens").value);
  const outputTokens = Number(document.getElementById("outputTokens").value);
  const requests = Number(document.getElementById("requestsPerMonth").value);
  
  if (checkboxes.length < 2) {
    alert("Please select at least 2 models to compare.");
    return;
  }
  
  const regionModels = modelsStore.all.filter(m => m.region === selectedRegion);
  const selectedModels = Array.from(checkboxes).map(cb => regionModels[parseInt(cb.value)]);
  
  // Get the selected model from dropdown
  const selectedModel = selectedModelIndex !== "" ? modelsStore.all[parseInt(selectedModelIndex)] : null;
  
  // Calculate costs for selected models
  const comparisons = selectedModels.map(model => {
    const totalInputTokens = inputTokens * requests;
    const totalOutputTokens = outputTokens * requests;
    const monthlyInputCost = (model.inputCost / 1000) * totalInputTokens;
    const monthlyOutputCost = (model.outputCost / 1000) * totalOutputTokens;
    const totalCost = monthlyInputCost + monthlyOutputCost;
    
    return {
      model,
      totalCost,
      monthlyInputCost,
      monthlyOutputCost,
      totalInputTokens,
      totalOutputTokens
    };
  });
  
  // Calculate base cost from the dropdown-selected model
  let baseCost;
  if (selectedModel) {
    const totalInputTokens = inputTokens * requests;
    const totalOutputTokens = outputTokens * requests;
    const monthlyInputCost = (selectedModel.inputCost / 1000) * totalInputTokens;
    const monthlyOutputCost = (selectedModel.outputCost / 1000) * totalOutputTokens;
    baseCost = monthlyInputCost + monthlyOutputCost;
  } else {
    // Fallback to cheapest model if no model selected in dropdown
    comparisons.sort((a, b) => a.totalCost - b.totalCost);
    baseCost = comparisons[0].totalCost;
  }
  
  // Generate comparison HTML for modal
  let html = `<h2 style="margin-top: 0;">Selected Models Comparison for ${selectedRegion}</h2>`;
  html += `<p>Based on ${inputTokens} input tokens, ${outputTokens} output tokens, ${requests} requests/month</p>`;
  html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 20px;">`;
  
  comparisons.forEach((comp, index) => {
    const priceDiff = comp.totalCost - baseCost;
    const diffClass = priceDiff > 0 ? 'positive' : priceDiff < 0 ? 'negative' : '';
    const diffText = priceDiff === 0 ? 'Base' : (priceDiff > 0 ? `+$${priceDiff.toFixed(4)}` : `-$${Math.abs(priceDiff).toFixed(4)}`);
    
    html += `
      <div class="card" style="background: var(--bg-secondary); padding: 15px; font-size: 12px;">
        <div style="font-size: 16px; font-weight: bold; color: var(--accent-blue); margin-bottom: 8px;">
          ${comp.model.name} (${comp.model.provider})
          <span class="price-diff ${diffClass}" style="font-size: 11px; margin-left: 8px;">${diffText}</span>
        </div>
        
        <div class="card" style="background: var(--bg-tertiary); padding: 10px; margin: 10px 0;">
          <h4 style="font-size: 13px; margin: 0 0 8px 0;">Cost Summary</h4>
          <p style="font-size: 11px; margin: 4px 0;"><strong>Monthly Input Token Cost:</strong> ${comp.monthlyInputCost.toFixed(4)} USD</p>
          <p style="font-size: 11px; margin: 4px 0;"><strong>Monthly Output Token Cost:</strong> ${comp.monthlyOutputCost.toFixed(4)} USD</p>
          <p style="font-size: 11px; margin: 4px 0;"><strong>Total Monthly Cost:</strong> <strong>${comp.totalCost.toFixed(4)} USD</strong></p>
        </div>
        
        <div class="card" style="background: var(--bg-primary); padding: 8px; margin: 8px 0;">
          <h4 style="font-size: 13px; margin: 0 0 8px 0;">Token Calculations</h4>
          <p style="font-size: 11px; margin: 4px 0;">Input: ${inputTokens} × ${requests} = ${comp.totalInputTokens}</p>
          <p style="font-size: 11px; margin: 4px 0;">Output: ${outputTokens} × ${requests} = ${comp.totalOutputTokens}</p>
        </div>
        
        <div class="card" style="background: var(--bg-primary); padding: 8px; margin: 8px 0;">
          <h4 style="font-size: 13px; margin: 0 0 8px 0;">Cost Breakdown</h4>
          <p style="font-size: 11px; margin: 4px 0;">Input Cost: (${comp.model.inputCost}/1000) × ${comp.totalInputTokens} = ${comp.monthlyInputCost.toFixed(4)} USD</p>
          <p style="font-size: 11px; margin: 4px 0;">Output Cost: (${comp.model.outputCost}/1000) × ${comp.totalOutputTokens} = ${comp.monthlyOutputCost.toFixed(4)} USD</p>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  
  // Show modal with comparison results
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("comparisonModal").style.display = "block";
  
  // Hide model selection
  document.getElementById("modelSelection").style.display = "none";
}

function closeComparisonModal() {
  document.getElementById("comparisonModal").style.display = "none";
}

function toggleComparisonAccordion(index) {
  const content = document.getElementById(`comp-content-${index}`);
  const icon = document.getElementById(`comp-icon-${index}`);
  const header = content.previousElementSibling;
  
  const isExpanded = content.classList.contains('expanded');
  
  if (isExpanded) {
    content.classList.remove('expanded');
    icon.classList.remove('rotated');
    header.classList.remove('active');
  } else {
    content.classList.add('expanded');
    icon.classList.add('rotated');
    header.classList.add('active');
  }
}

window.calculateCost = calculateCost;
window.addModel = addModel;
window.updateModel = updateModel;
window.deleteModel = deleteModel;
window.resetDefaults = resetDefaults;
window.showAllModels = showAllModels;
window.showFilteredModels = showFilteredModels;
window.applyFilter = applyFilter;
window.clearFilter = clearFilter;
window.showReferencePricing = showReferencePricing;
window.updateReferencePricingTable = updateReferencePricingTable;
window.toggleAccordion = toggleAccordion;
window.compareAllModels = compareAllModels;
window.showModelSelection = showModelSelection;
window.updateCompareButton = updateCompareButton;
window.compareSelectedModels = compareSelectedModels;
window.closeComparisonModal = closeComparisonModal;
window.toggleComparisonAccordion = toggleComparisonAccordion;
window.toggleCustomProvider = toggleCustomProvider;
window.toggleRegionDropdown = toggleRegionDropdown;
window.updateRegionSelection = updateRegionSelection;

// Embedding calculation functions
const embeddingModels = {
  'titan-v1': { name: 'Amazon Titan Text Embedding V1', price: 0.0001 },
  'titan-v2': { name: 'Amazon Titan Text Embedding V2', price: 0.000024 },
  'cohere-embed': { name: 'Cohere Embed English', price: 0.0001 },
  'cohere-embed-multilingual': { name: 'Cohere Embed Multilingual', price: 0.0001 }
};

function updateEmbeddingPrice() {
  const modelId = document.getElementById('embeddingModel').value;
  const model = embeddingModels[modelId];
  document.getElementById('modelPrice').value = model.price;
}

function calculateEmbedding() {
  const modelId = document.getElementById('embeddingModel').value;
  const inputType = document.getElementById('inputType').value;
  const inputValue = parseFloat(document.getElementById('inputValue').value);
  const modelPrice = parseFloat(document.getElementById('modelPrice').value);
  
  if (!inputValue || inputValue <= 0) {
    alert('Please enter a valid value');
    return;
  }
  
  if (!modelPrice || modelPrice <= 0) {
    alert('Please enter a valid model price');
    return;
  }
  
  const model = embeddingModels[modelId];
  let tokens = 0;
  
  if (inputType === 'data-size') {
    tokens = inputValue * 161000000;
  } else if (inputType === 'token-count') {
    tokens = inputValue;
  } else if (inputType === 'character-count') {
    tokens = inputValue / 4;
  }
  
  const totalCost = (modelPrice / 1000) * tokens;
  
  document.getElementById('embeddingResults').innerHTML = `
    <div class="form-grid" style="margin-top: 2rem;">
      <div class="card">
        <b>Selected Model:</b> ${model.name}<br/>
        <b>Total Monthly Embedding Cost:</b> ${totalCost.toFixed(4)} USD
      </div>
      <div class="card">
        <h4 style="color: var(--accent-blue); margin: 0 0 0.5rem 0;">Model Details</h4>
        <b>Model:</b> ${model.name}<br/>
        <b>Price:</b> $${modelPrice}/1000 tokens<br/><br/>
        <h4 style="color: var(--accent-blue); margin: 1rem 0 0.5rem 0;">Input Details</h4>
        <b>Type:</b> ${inputType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}<br/>
        <b>Value:</b> ${inputValue} ${inputType === 'data-size' ? 'GB' : inputType === 'token-count' ? 'tokens' : 'characters'}<br/><br/>
        <h4 style="color: var(--accent-blue); margin: 1rem 0 0.5rem 0;">Token Calculation</h4>
        Converting ${inputType === 'data-size' ? 'GB to Tokens' : inputType === 'character-count' ? 'Characters to Tokens' : 'Direct Token Count'}: ${inputValue} ${inputType === 'data-size' ? 'GB × 161,000,000 tokens/GB' : inputType === 'character-count' ? 'characters ÷ 4' : 'tokens'} = ${tokens.toLocaleString()} tokens<br/><br/>
        <h4 style="color: var(--accent-blue); margin: 1rem 0 0.5rem 0;">Cost Calculation</h4>
        <b>Token Price:</b> $${modelPrice} per 1000 tokens<br/>
        <b>Total Cost:</b> (${modelPrice} / 1000) × ${tokens.toLocaleString()} tokens = ${totalCost.toFixed(4)} USD
      </div>
    </div>
  `;
}

function resetEmbedding() {
  document.getElementById('embeddingModel').value = 'titan-v2';
  document.getElementById('inputType').value = 'data-size';
  document.getElementById('inputValue').value = '1';
  document.getElementById('modelPrice').value = '0.000024';
  document.getElementById('embeddingResults').innerHTML = '';
}

window.updateEmbeddingPrice = updateEmbeddingPrice;
window.calculateEmbedding = calculateEmbedding;
window.resetEmbedding = resetEmbedding;

// Token Counter functions
const modelTokenizers = {
  'gpt': { name: 'OpenAI GPT', ratio: 3.8, method: 'tiktoken-based' },
  'claude': { name: 'Anthropic Claude', ratio: 4.2, method: 'Claude tokenizer' },
  'llama': { name: 'Meta Llama', ratio: 4.0, method: 'SentencePiece' },
  'gemma': { name: 'Google Gemma', ratio: 3.9, method: 'SentencePiece' }
};

function toggleCountingMode() {
  const mode = document.getElementById('countingMode').value;
  const modelField = document.getElementById('modelSelectionField');
  
  if (mode === 'model-specific') {
    modelField.style.display = 'block';
  } else {
    modelField.style.display = 'none';
  }
}

function countTokens() {
  const text = document.getElementById('inputText').value.trim();
  const mode = document.getElementById('countingMode').value;
  
  if (!text) {
    alert('Please enter some text to count tokens');
    return;
  }
  
  const characters = text.length;
  const words = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  
  let estimatedTokens, method, modelInfo;
  
  if (mode === 'simple') {
    estimatedTokens = Math.ceil(characters / 4);
    method = 'Simple character-based estimation';
    modelInfo = 'Generic (~4 characters per token)';
  } else {
    const modelId = document.getElementById('tokenModel').value;
    const tokenizer = modelTokenizers[modelId];
    estimatedTokens = Math.ceil(characters / tokenizer.ratio);
    method = `${tokenizer.name} tokenization`;
    modelInfo = `${tokenizer.name} (~${tokenizer.ratio} characters per token)`;
  }
  
  document.getElementById('tokenResults').innerHTML = `
    <div class="form-grid" style="margin-top: 2rem;">
      <div class="card">
        <h4 style="color: var(--accent-blue); margin: 0 0 0.5rem 0;">Text Statistics</h4>
        <b>Characters:</b> ${characters.toLocaleString()}<br/>
        <b>Words:</b> ${words.toLocaleString()}<br/>
        <b>Sentences:</b> ${sentences.toLocaleString()}<br/>
        <b>Estimated Tokens:</b> ${estimatedTokens.toLocaleString()}
      </div>
      <div class="card">
        <h4 style="color: var(--accent-blue); margin: 0 0 0.5rem 0;">Tokenization Details</h4>
        <b>Method:</b> ${method}<br/>
        <b>Model:</b> ${modelInfo}<br/>
        <b>Calculation:</b> ${characters} characters ÷ ${mode === 'simple' ? '4' : modelTokenizers[document.getElementById('tokenModel')?.value]?.ratio || '4'} = ${estimatedTokens} tokens<br/><br/>
        <small style="color: var(--text-secondary);">Note: ${mode === 'simple' ? 'This is a basic approximation.' : 'Model-specific estimation is more accurate but still approximate.'} Actual token counts may vary.</small>
      </div>
    </div>
  `;
}

function clearTokenCounter() {
  document.getElementById('inputText').value = '';
  document.getElementById('tokenResults').innerHTML = '';
}

window.toggleCountingMode = toggleCountingMode;
window.countTokens = countTokens;
window.clearTokenCounter = clearTokenCounter;


