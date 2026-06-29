const express = require("express");
const Stripe = require("stripe");
const { config, supabase } = require("./config");

const stripe = new Stripe(config.STRIPE_SECRET_KEY);
const stripeRouter = express.Router();

// We'll add the webhook handler here next.

module.exports = {
  stripeRouter
};
