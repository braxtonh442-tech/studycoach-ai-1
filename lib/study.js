const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { config, supabase } = require("./config");

const studyRouter = express.Router();

function getUserId(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const decoded = jwt.verify(token, config.JWT_SECRET);
  return decoded.id;
}

async function askAI({ message, subject, yearLevel, country }) {
  if (!config.OPENAI_API_KEY) {
    return {
      mode: "demo",
      answer: `Demo answer for ${yearLevel} ${subject}.\n\nYou asked: ${message}\n\nConnect OpenAI to get live AI.`
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: `You are StudyCoach AI, a friendly tutor for ${yearLevel} students in ${country}. Teach step by step.`
        },
        {
          role: "user",
          content: message
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      mode: "error",
      answer: "AI error: " + (data.error?.message || "Unknown error")
    };
  }

  return {
    mode: "live",
    answer: data.output_text || "No answer returned."
  };
}

studyRouter.post("/chat", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { message, subject, yearLevel, country } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required." });
    }

    const result = await askAI({
      message,
      subject: subject || "Study",
      yearLevel: yearLevel || "Year 7",
      country: country || "New Zealand"
    });

    await supabase.from("chats").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      message,
      answer: result.answer,
      mode: result.mode,
      subject: subject || "Study"
    });

    await supabase.from("progress").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "chat",
      subject: subject || "Study",
      title: message.slice(0, 80)
    });

    res.json({
      answer: result.answer,
      mode: result.mode
    });

  } catch (err) {
    res.status(500).json({
      error: "Chat error: " + err.message
    });
  }
});

studyRouter.get("/study-test", (req, res) => {
  res.json({
    message: "Study router is working!"
  });
});

module.exports = {
  studyRouter
};
