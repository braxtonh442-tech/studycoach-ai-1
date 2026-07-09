const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
const { Resend } = require("resend");

const config = {
  JWT_SECRET: process.env.JWT_SECRET || "change-this-secret",

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4.1-mini",

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || "",

  APP_URL: process.env.APP_URL || "https://studycoach.training",

  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // NEW
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  FROM_EMAIL: process.env.FROM_EMAIL || "StudyCoach AI <onboarding@resend.dev>"
};

const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = config.STRIPE_SECRET_KEY
  ? new Stripe(config.STRIPE_SECRET_KEY)
  : null;

// NEW
const resend = config.RESEND_API_KEY
  ? new Resend(config.RESEND_API_KEY)
  : null;

module.exports = {
  config,
  supabase,
  stripe,
  resend
};