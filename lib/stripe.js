const express = require("express");
const Stripe = require("stripe");
const { config, supabase } = require("./config");

const stripe = new Stripe(config.STRIPE_SECRET_KEY);
const stripeRouter = express.Router();

stripeRouter.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;

      if (userId) {
        await supabase
          .from("users")
          .update({ plan: "premium" })
          .eq("id", userId);
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).json({
      error: "Webhook error: " + err.message
    });
  }
});

module.exports = {
  stripeRouter
};
