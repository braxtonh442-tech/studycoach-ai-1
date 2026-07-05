const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { config, supabase } = require("./config");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

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
}async function updateStudentMemory(userId, message, subject, answer) {
  try {
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const brain = await askAI({
      subject: "Student Memory",
      yearLevel: profile?.year_level || "Year 7",
      country: profile?.country || "New Zealand",
      message: `
You are updating a student's long-term learning memory.

Current profile:
Name: ${profile?.name || "Unknown"}
Favourite subject: ${profile?.favourite_subject || "Not learned yet"}
Weak subject: ${profile?.weak_subject || "Not learned yet"}
Weak topics: ${profile?.weak_topics || ""}
Recently learned: ${profile?.recently_learned || ""}
Learning style: ${profile?.learning_style || "Not learned yet"}
Goals: ${profile?.goals || ""}
Memory notes: ${profile?.memory_notes || ""}

New student message:
${message}

AI answer:
${answer}

Subject:
${subject}

Return ONLY valid JSON like this:
{
  "weak_subject": "",
  "weak_topics": "",
  "recently_learned": "",
  "learning_style": "",
  "memory_notes": ""
}

Rules:
- Keep existing useful memory.
- Add new useful learning observations.
- Do not invent facts.
- If unsure, keep the current value.
- Keep each field short.
`
    });

    let parsed = null;

    try {
      parsed = JSON.parse(brain.answer);
    } catch {
      return;
    }

    await supabase
      .from("student_profiles")
      .update({
        weak_subject: parsed.weak_subject || profile?.weak_subject,
        weak_topics: parsed.weak_topics || profile?.weak_topics,
        recently_learned: parsed.recently_learned || subject || profile?.recently_learned,
        learning_style: parsed.learning_style || profile?.learning_style,
        memory_notes: parsed.memory_notes || profile?.memory_notes,
        last_ai_summary: String(answer || "").slice(0, 300),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

  } catch (err) {
    console.log("Memory update error:", err.message);
  }
}
async function unlockAchievement(userId, key, title, description, icon = "🏆") {
  const { error } = await supabase
    .from("achievements")
    .upsert(
      {
        user_id: userId,
        achievement_key: key,
        title,
        description,
        icon
      },
      {
        onConflict: "user_id,achievement_key"
      }
    );

  return !error;
}
studyRouter.post("/chat", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { message, subject, yearLevel, country } = req.body;
const { data: profile } = await supabase
  .from("student_profiles")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle();
    if (!message) {
      return res.status(400).json({ error: "Message required." });
    }

    const { data: oldChats } = await supabase
      .from("chats")
      .select("message, answer")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const memory = (oldChats || [])
      .reverse()
      .map(c => `Student: ${c.message}\nStudyCoach: ${c.answer}`)
      .join("\n\n");
const result = await askAI({
   message: `
Student profile:

Name: ${profile?.name || "Unknown"}
Year Level: ${profile?.year_level || yearLevel}
Favourite Subject: ${profile?.favourite_subject || "Not learned yet"}
Weak Subject: ${profile?.weak_subject || "Not learned yet"}
Learning Style: ${profile?.learning_style || "Not learned yet"}
Goals: ${profile?.goals || "Build strong study habits"}

Weak Topics: ${profile?.weak_topics || "None yet"}
Recently Learned: ${profile?.recently_learned || "None yet"}
Homework Average: ${profile?.homework_average || 0}/10
Quiz Average: ${profile?.quiz_average || 0}/10
Memory Notes: ${profile?.memory_notes || "None yet"}

Recent conversation:
${memory || "No previous conversation yet."}

New student question:
${message}

Use the student profile and the recent conversation to personalise your answer. Use follow-up words like "she", "it", "that", and "they" correctly based on the conversation.
`,
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
await updateStudentMemory(
  userId,
  message,
  subject || "Study",
  result.answer
);
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
studyRouter.get("/profile", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data: profile, error } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    const { data: progress } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", userId);

    const xp = (progress || []).length * 10;
    const level = Math.floor(xp / 100) + 1;
    const nextLevelXp = level * 100;
const dailyCoach = `
Today's Mission

✅ Ask one AI question

📚 Complete one quiz

⏱️ Study for at least 20 minutes

🎯 Current focus:
${profile?.weak_subject || "Keep building your strongest subject!"}

⭐ You're Level ${level}.
Only ${Math.max(0, nextLevelXp - xp)} XP until Level ${level + 1}!

Keep going—you've got this! 🚀
`;
   res.json({
  profile,
  xp,
  level,
  dailyCoach
});

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
studyRouter.get("/achievements", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data, error } = await supabase
      .from("achievements")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      achievements: data || []
    });

  } catch (err) {
    res.status(500).json({
      error: "Achievements error: " + err.message,
      achievements: []
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
    if (favouriteSubject !== "None") {
  await supabase
    .from("student_profiles")
    .update({
      favourite_subject: favouriteSubject,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
}
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
const xp = progress.length * 10;
const level = Math.floor(xp / 100) + 1;
    const achievements = [];

if (total >= 1)
  achievements.push("🎉 First Study Session");

if (progress.filter(x => x.type === "chat").length >= 10)
  achievements.push("💬 Asked 10 Questions");

if (progress.filter(x => x.type === "quiz").length >= 5)
  achievements.push("🧠 Quiz Starter");

if (progress.filter(x => x.type === "flashcards").length >= 5)
  achievements.push("📚 Flashcard Master");

if (progress.filter(x => x.type === "homework").length >= 1)
  achievements.push("📄 First Homework");

if (streak >= 3)
  achievements.push("🔥 3 Day Streak");

if (level >= 2)
  achievements.push("⭐ Level 2");

if (level >= 5)
  achievements.push("🏆 Level 5");
    const analytics = {
  studyTasks: total,
  xp,
  level,
  streak,

  weeklyStudy: [
    Math.max(0, total - 6),
    Math.max(0, total - 5),
    Math.max(0, total - 4),
    Math.max(0, total - 3),
    Math.max(0, total - 2),
    Math.max(0, total - 1),
    total
  ],

  subjectData: bySubject,

  homeworkAverage:
    progress.filter(x => x.type === "homework").length,

  quizCount:
    progress.filter(x => x.type === "quiz").length,

  flashcardCount:
    progress.filter(x => x.type === "flashcards").length
};
    res.json({
  analytics,
  total,
  bySubject,
  streak,
  badges,
  achievements,
  xp,
  level,
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
studyRouter.post("/check-quiz-answer", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { question, answer, subject, yearLevel } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        error: "Question and answer are required."
      });
      }
    const ai = await askAI({
      subject: subject || "Quiz",
      yearLevel: yearLevel || "Year 7",
      country: "New Zealand",
      message: `
A student answered a quiz question.

Question:
${question}

Student answer:
${answer}

Mark the answer.

Return EXACTLY this format:

RESULT:
Correct or Not quite

SCORE:
number out of 10

FEEDBACK:
short helpful feedback

BETTER_ANSWER:
a better answer if needed
`
    });
// Award XP for completing a quiz answer
await supabase.from("progress").insert({
  id: crypto.randomUUID(),
  user_id: userId,
  type: "quiz-answer",
  subject: subject || "Quiz",
  title: "Answered quiz question"
});
      const unlocked = await unlockAchievement(
  userId,
  "first-quiz-answer",
  "First Quiz Answer",
  "Answered your first AI-marked quiz question.",
  "🧠"
);

console.log("Achievement unlocked:", unlocked);
    res.json({
      result: ai.answer
    });

  } catch (err) {
    res.status(500).json({
      error: "Check quiz answer error: " + err.message
    });
  }
});

studyRouter.post("/upload-homework", upload.single("file"), async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!req.file) {
      return res.status(400).json({
        error: "No homework file received."
      });
    }

    const note = req.body.note || "No extra note provided.";
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const fileSizeKb = Math.round(req.file.size / 1024);

    let feedback = "";

    if (fileType.startsWith("image/") && config.OPENAI_API_KEY) {
      const base64 = req.file.buffer.toString("base64");

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
              content: "You are StudyCoach AI, a helpful teacher. Read homework images carefully and give clear feedback."
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `
A student uploaded homework.

Student note: ${note}

Return your answer using EXACTLY this format.

SCORE:
(number out of 10)

STRENGTHS:
- item
- item
- item

IMPROVEMENTS:
- item
- item
- item

REVISION:
- item
- item

NEXT_STEPS:
- item
- item

Do not use any other headings.
`
                },
                
                {
                  type: "input_image",
                  image_url: `data:${fileType};base64,${base64}`
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        feedback = "AI image reading error: " + (data.error?.message || "Unknown error");
      } else {
     let text = data.output_text;

if (!text && Array.isArray(data.output)) {
  for (const item of data.output) {
    if (Array.isArray(item.content)) {
      for (const c of item.content) {
        if (typeof c.text === "string") text = c.text;
        if (c.text && typeof c.text.value === "string") text = c.text.value;
      }
    }
  }
}

feedback = text || "No feedback returned.";
      }

    } else {
      const ai = await askAI({
        message: `
A student uploaded homework.

File name: ${fileName}
File type: ${fileType}
File size: ${fileSizeKb} KB
Student note: ${note}

Please give helpful feedback. Be honest that you cannot fully read this file type yet unless it is an image.
`,
        subject: "Homework",
        yearLevel: req.body.yearLevel || "Year 7",
        country: "New Zealand"
      });

      feedback = ai.answer;
    }

    await supabase.from("progress").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "homework",
      subject: "Homework",
      title: fileName
    });

    res.json({
      message: feedback
    });

  } catch (err) {
    res.status(500).json({
      error: "Homework upload error: " + err.message
    });
  }
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
