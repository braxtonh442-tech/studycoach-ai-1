const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { config, supabase } = require("./config");

const authRouter = express.Router();

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, {
    expiresIn: "30d"
  });
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

authRouter.post("/signup", async (req, res) => {
  try {
    const { name, email, password, yearLevel, country } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: "Email already exists." });
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
    res.status(500).json({ error: err.message });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const cleanEmail = String(req.body.email || "").toLowerCase().trim();

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(401).json({ error: "Wrong email or password." });
    }

    const ok = await bcrypt.compare(req.body.password || "", user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Wrong email or password." });
    }

    res.json({
      token: makeToken(user),
      user: safeUser(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");

    if (!token) {
      return res.json({ user: null });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

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
    res.json({ user: null });
  }
});

module.exports = {
  authRouter
};
