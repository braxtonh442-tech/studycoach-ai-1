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

 let answer = data.output_text;

if (!answer && Array.isArray(data.output)) {
  for (const item of data.output) {
    if (Array.isArray(item.content)) {
      for (const c of item.content) {
        if (typeof c.text === "string") answer = c.text;
        if (c.text && typeof c.text.value === "string") answer = c.text.value;
      }
    }
  }
}

return {
  mode: "live",
  answer: answer || "No answer returned."
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
studyRouter.get("/chat/:id", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: "Chat not found."
      });
    }

    res.json({
      chat: data
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
studyRouter.get("/study-test", (req, res) => {
  res.json({
    message: "Study router is working!"
  });
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

    res.json({
      chats: data || []
    });

  } catch (err) {
    res.status(500).json({
      error: "History error: " + err.message,
      chats: []
    });
  }
});

studyRouter.get("/progress", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data, error } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const progress = data || [];

    const bySubject = {};
    for (const item of progress) {
      const subject = item.subject || "Study";
      bySubject[subject] = (bySubject[subject] || 0) + 1;
    }

    const total = progress.length;
    const favouriteSubject = Object.entries(bySubject).sort((a,b)=>b[1]-a[1])[0]?.[0] || "None";
    const weakArea = total < 5 ? "Build consistency" : "Revision consistency";

    const days = new Set(
      progress.map(x => String(x.created_at || "").slice(0,10))
    );

    let streak = 0;
    let d = new Date();

    while(days.has(d.toISOString().slice(0,10))){
      streak++;
      d.setDate(d.getDate() - 1);
    }

    const badges = [];
    if(total >= 1) badges.push("First Study Session");
    if(total >= 5) badges.push("5 Tasks Complete");
    if(total >= 10) badges.push("10 Tasks Complete");
    if(streak >= 3) badges.push("3 Day Streak");
    if(streak >= 7) badges.push("7 Day Streak");

    res.json({
      total,
      bySubject,
      streak,
      badges,
      favouriteSubject,
      weakAreas: [weakArea],
      progressPercent: Math.min(100, total * 10),
      estimatedStudyMinutes: total * 8,
      recent: progress.slice(0, 10)
    });

  } catch (err) {
    res.status(500).json({
      error: "Progress error: " + err.message,
      total: 0,
      bySubject: {},
      streak: 0,
      badges: [],
      favouriteSubject: "None",
      weakAreas: [],
      progressPercent: 0,
      estimatedStudyMinutes: 0,
      recent: []
    });
  }
});

// ... your /progress route ends here

studyRouter.post("/quiz", async (req, res) => {
  try {
    const userId = getUserId(req);
    const topic = req.body.topic || "your topic";
    const subject = req.body.subject || "Study";

    let questions = [];

    if (config.OPENAI_API_KEY) {
      const ai = await askAI({
        message: `Create a 5 question quiz about ${topic}. Return only the questions as a numbered list.`,
        subject,
        yearLevel: req.body.yearLevel || "Year 7",
        country: "New Zealand"
      });

      questions = ai.answer
        .split("\n")
        .map(x => x.replace(/^\d+[\).\s-]*/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    if (questions.length === 0) {
      questions = [
        `What is ${topic}?`,
        `Give one example of ${topic}.`,
        `What is one common mistake with ${topic}?`,
        `Explain ${topic} in your own words.`,
        `Create one question about ${topic}.`
      ];
    }

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
        questions
      }
    });
  } catch (err) {
    res.status(500).json({
      error: "Quiz error: " + err.message
    });
  }
});
studyRouter.post("/upload-homework", async (req, res) => {
  res.json({
    message: "Homework upload endpoint is working. File handling comes next."
  });
});
studyRouter.post("/create-checkout-session", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!config.STRIPE_SECRET_KEY || !config.STRIPE_PRICE_ID) {
      return res.status(500).json({
        error: "Stripe keys are missing in Render Environment."
      });
    }

    const Stripe = require("stripe");
    const stripe = new Stripe(config.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: config.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: config.APP_URL + "/success.html",
      cancel_url: config.APP_URL + "/cancel.html",
      metadata: {
        userId
      }
    });

    res.json({
      url: session.url
    });

  } catch (err) {
    res.status(500).json({
      error: "Stripe checkout error: " + err.message
    });
  }
});
studyRouter.post("/flashcards", async (req, res) => {
  try {
    const userId = getUserId(req);
    const topic = req.body.topic || "your topic";
    const subject = req.body.subject || "Study";

    let cards = [];

    if (config.OPENAI_API_KEY) {
      const ai = await askAI({
        message: `Create 5 flashcards about ${topic}. Format each one like Question: ... Answer: ...`,
        subject,
        yearLevel: req.body.yearLevel || "Year 7",
        country: "New Zealand"
      });

      cards = ai.answer
        .split("\n")
        .filter(x => x.trim())
        .slice(0, 10);
    }

    if (cards.length === 0) {
      cards = [
        `Question: What is ${topic}? Answer: A key idea in ${subject}.`,
        `Question: Give an example of ${topic}. Answer: Example depends on the topic.`,
        `Question: Why is ${topic} important? Answer: It helps you understand ${subject}.`
      ];
    }

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
        cards: cards.map(x => ({
          front: x.split("Answer:")[0].replace("Question:", "").trim(),
          back: x.includes("Answer:") ? x.split("Answer:")[1].trim() : x
        }))
      }
    });
  } catch (err) {
    res.status(500).json({
      error: "Flashcards error: " + err.message
    });
  }
});

module.exports = {
  studyRouter
};
