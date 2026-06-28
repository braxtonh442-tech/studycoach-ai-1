const express = require("express");
const { config } = require("./config");

const healthRouter = express.Router();

healthRouter.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "StudyCoach AI",
    hasOpenAIKey: Boolean(config.OPENAI_API_KEY),
    hasStripeSecretKey: Boolean(config.STRIPE_SECRET_KEY),
    hasStripePriceId: Boolean(config.STRIPE_PRICE_ID),
    hasSupabaseUrl: Boolean(config.SUPABASE_URL),
    hasSupabaseServiceRoleKey: Boolean(config.SUPABASE_SERVICE_ROLE_KEY),
    appUrl: config.APP_URL
  });
});

module.exports = { healthRouter };
