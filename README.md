# LLM Cost Calculator

Static site that calculates LLM token costs. To host on GitHub Pages, push this repository to GitHub and enable Pages or use the included Actions workflow.

Local run:

```bash
npm install
npm run start
# or
node server.js
```

Notes:
- `normalized-pricing.json` should be at the repo root for the app to use updated pricing. The `lambda-function` can generate it if you run it with appropriate AWS credentials.
- `.env` contains placeholders; do not commit secrets.
