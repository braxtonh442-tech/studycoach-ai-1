const express = require("express");
const jwt = require("jsonwebtoken");
const { config, supabase } = require("./config");

const studyRouter = express.Router();

function getUserId(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const decoded = jwt.verify(token, config.JWT_SECRET);
  return decoded.id;
}

function subjectCounts(progress) {
  const counts = {};
  for (const item of progress) {
    const subject = item.subject || "Study";
    counts[subject] = (counts[subject] || 0) + 1;
  }
  return counts;
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
    res.status(500).json({ error: "Chat error: " + err.message });
  }
});

studyRouter.get("/history", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ chats: data || [] });
  } catch (err) {
    res.status(500).json({ error: "History error: " + err.message });
  }
});

studyRouter.get("/progress", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data: progress, error } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      total: progress.length,
      bySubject: subjectCounts(progress),
      streak: progress.length > 0 ? 1 : 0,
      badges: progress.length > 0 ? ["First Study Session"] : [],
      weakAreas: ["Revision consistency"],
      recent: progress.slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: "Progress error: " + err.message });
  }
});

studyRouter.post("/study-plan", async (req, res) => {
  try {
    const userId = getUserId(req);
    const goal = req.body.goal || "Improve this week";
    const subject = req.body.subject || "Study";
    const daysCount = Math.min(Math.max(Number(req.body.days || 7), 3), 14);

    const days = [];

    for (let i = 1; i <= daysCount; i++) {
      days.push({
        day: i,
        task: i === 1 ? `Learn the basics of ${goal}` : `Practise ${subject} for 15 minutes`,
        minutes: 15
      });
    }

    await supabase.from("progress").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "plan",
      subject,
      title: goal
    });

    res.json({
      plan: {
        id: crypto.randomUUID(),
        userId,
        goal,
        subject,
        days
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Study plan error: " + err.message });
  }
});

studyRouter.post("/quiz", async (req, res) => {
  try {
    const userId = getUserId(req);
    const topic = req.body.topic || "your topic";
    const subject = req.body.subject || "Study";

    await supabase.from("progress").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "quiz",
      subject,
      title: topic
    });

    res.json({
      quiz: {
        topic,
        subject,
        questions: [
          `What is ${topic}?`,
          `Give one example of ${topic}.`,
          `What is one mistake with ${topic}?`,
          `Explain ${topic} in your own words.`,
          `Create a question about ${topic}.`
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Quiz error: " + err.message });
  }
});

studyRouter.post("/flashcards", async (req, res) => {
  try {
    const userId = getUserId(req);
    const topic = req.body.topic || "your topic";
    const subject = req.body.subject || "Study";

    await supabase.from("progress").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "flashcards",
      subject,
      title: topic
    });

    res.json({
      flashcards: {
        topic,
        subject,
        cards: [
          { front: "Definition", back: `What does ${topic} mean?` },
          { front: "Example", back: `Give one example of ${topic}.` },
          { front: "Mistake", back: `What should you avoid with ${topic}?` }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Flashcards error: " + err.message });
  }
});

module.exports = { studyRouter };
