const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { config, supabase, resend } = require("./config");
const authRouter = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    yearLevel: user.year_level,
    country: user.country,
    role: user.role,
    plan: user.plan
  };
}

/* ===========================
   SIGN UP
=========================== */

authRouter.post("/signup", async (req, res) => {
  try {

    const { name, email, password, yearLevel, country } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email and password are required."
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        error: "Email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        name,
        email: cleanEmail,
        password_hash: passwordHash,
        year_level: yearLevel || "Year 7",
        country: country || "New Zealand",
        role: "student",
        plan: "free"
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from("student_profiles")
      .insert({
        user_id: user.id,
        name: user.name,
        year_level: user.year_level,
        country: user.country,
        favourite_subject: "Not learned yet",
        weak_subject: "Not learned yet",
        learning_style: "Not learned yet",
        goals: "Build strong study habits"
      });

    res.json({
      token: makeToken(user),
      user: safeUser(user)
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* ===========================
   LOGIN
=========================== */

authRouter.post("/login", async (req, res) => {

  try {

    const cleanEmail = String(req.body.email || "")
      .toLowerCase()
      .trim();

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(401).json({
        error: "Wrong email or password."
      });
    }

    const ok = await bcrypt.compare(
      req.body.password || "",
      user.password_hash
    );

    if (!ok) {
      return res.status(401).json({
        error: "Wrong email or password."
      });
    }

    res.json({
      token: makeToken(user),
      user: safeUser(user)
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* ===========================
   CURRENT USER
=========================== */

authRouter.get("/me", async (req, res) => {

  try {

    const token = (req.headers.authorization || "")
      .replace("Bearer ", "");

    if (!token) {
      return res.json({
        user: null
      });
    }

    const decoded = jwt.verify(
      token,
      config.JWT_SECRET
    );

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .maybeSingle();

    if (error) throw error;

    res.json({
      user: user ? safeUser(user) : null
    });

  } catch {

    res.json({
      user: null
    });

  }

});

/* ===========================
   FORGOT PASSWORD
=========================== */

authRouter.post("/forgot-password", async (req, res) => {

  try {

    const email = String(req.body.email || "")
      .toLowerCase()
      .trim();

    if (!email) {
      return res.status(400).json({
        error: "Email is required."
      });
    }

    const token = crypto.randomUUID();

    const expires = new Date(
      Date.now() + 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("password_resets")
      .insert({
        id: crypto.randomUUID(),
        email,
        token,
        expires_at: expires
      });

    const resetLink = `${config.APP_URL}/reset-password.html?token=${token}`;

if (!resend) {
  return res.status(500).json({
    error: "Email service is not set up. Check RESEND_API_KEY in Render."
  });
}

const emailResult = await resend.emails.send({
  from: config.FROM_EMAIL,
  to: email,
  subject: "Reset your StudyCoach AI password",
  html: `
    <h2>StudyCoach AI</h2>
    <p>Click below to reset your password:</p>
    <p><a href="${resetLink}">Reset password</a></p>
    <p>This link expires in one hour.</p>
  `
});

console.log("RESEND RESULT:", JSON.stringify(emailResult));
    res.json({
      message: "Password reset email queued."
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* ===========================
   EXPORT
=========================== */
authRouter.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const { data: reset, error } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .maybeSingle();

    if (error) throw error;

    if (!reset) {
      return res.status(400).json({ error: "Reset link is invalid or already used." });
    }

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: "Reset link has expired." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("email", reset.email);

    await supabase
      .from("password_resets")
      .update({ used: true })
      .eq("id", reset.id);

    res.json({
      success: true,
      message: "Password updated. You can now log in."
    });

  } catch (err) {
    res.status(500).json({
      error: "Reset password error: " + err.message
    });
  }
});
authRouter.post("/start-trial", async (req, res) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Not logged in." });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .single();

    if (error) throw error;

    if (user.trial_used) {
      return res.status(400).json({
        error: "You have already used your free trial."
      });
    }

    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from("users")
      .update({
        plan: "premium",
        trial_used: true,
        trial_started_at: start.toISOString(),
        trial_ends_at: end.toISOString()
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "Your 7-day Premium Trial has started!",
      trialEnds: end.toISOString()
    });

  } catch (err) {
    res.status(500).json({
      error: "Start trial error: " + err.message
    });
  }
});
module.exports = {
  authRouter
};
