let token = localStorage.getItem("studycoach_7_token") || "";
let mode = "signup";
let currentUser = null;
let currentConversationId = null;
let tourStep = 0;

const tourSlides = [
  {
    title: "🤖 AI Tutor",
    text: "Ask questions and get step-by-step help."
  },
  {
    title: "📄 Homework Upload",
    text: "Upload homework and get helpful feedback."
  },
  {
    title: "🏆 XP & Rewards",
    text: "Earn XP, unlock achievements, keep streaks, and claim daily rewards."
  },
  {
    title: "🎉 You're ready!",
    text: "Start studying and build your learning profile."
  }
];
const years = ["Year 1","Year 2","Year 3","Year 4","Year 5","Year 6","Year 7","Year 8","Year 9","Year 10","Year 11","Year 12","Year 13","University","Adult Learner"];

function el(id){ return document.getElementById(id); }
function value(id){ return el(id) ? el(id).value.trim() : ""; }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function fillYears(id){
  const s = el(id);
  if(!s) return;
  s.innerHTML = "";
  years.forEach(y => {
    const o = document.createElement("option");
    o.textContent = y;
    s.appendChild(o);
  });
  s.value = "Year 7";
}

function showSignup(){
  mode = "signup";
  el("marketing")?.classList.add("hidden");
  el("auth")?.classList.remove("hidden");
  if(el("authTitle")) el("authTitle").textContent = "Create account";
  if(el("authBtn")) el("authBtn").textContent = "Create account";
  if(el("name")) el("name").style.display = "block";
  if(el("authMsg")) el("authMsg").textContent = "";
}

function showLogin(){
  mode = "login";
  el("marketing")?.classList.add("hidden");
  el("auth")?.classList.remove("hidden");
  if(el("authTitle")) el("authTitle").textContent = "Login";
  if(el("authBtn")) el("authBtn").textContent = "Login";
  if(el("name")) el("name").style.display = "none";
  if(el("authMsg")) el("authMsg").textContent = "";
}

function backHome(){
  el("auth")?.classList.add("hidden");
  el("marketing")?.classList.remove("hidden");
}

function toggleAuth(){
  mode === "signup" ? showLogin() : showSignup();
}
async function forgotPassword(){

  const email = value("email");

  if(!email){
    alert("Please enter your email address first.");
    return;
  }

  try{

    const r = await fetch("/api/forgot-password",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({ email })
    });

    const d = await r.json();

    if(d.error){
      alert(d.error);
      return;
    }

    alert("If that email exists, we've sent a password reset link.");

  }catch(err){
    alert("Unable to send reset email.");
  }
}
async function authAction(){
  const endpoint = mode === "signup" ? "/api/signup" : "/api/login";
  const body = mode === "signup"
    ? {
        name: value("name"),
        email: value("email"),
        password: value("password"),
        country: value("country"),
        yearLevel: value("yearLevel")
      }
    : {
        email: value("email"),
        password: value("password")
      };

  const d = await post(endpoint, body, false);

if(d.error){
  if(el("authMsg")) el("authMsg").textContent = d.error;
  return;
}

// Track only successful new account registrations
if(mode === "signup" && typeof gtag === "function"){
  gtag("event", "sign_up", {
    method: "email"
  });
}

token = d.token;
currentUser = d.user;
localStorage.setItem("studycoach_7_token", token);
showApp();
}
async function forgotPassword(){
  const email = value("email");

  if(!email){
    if(el("authMsg")) el("authMsg").textContent = "Type your email first.";
    return;
  }

  const d = await post("/api/forgot-password", { email }, false);

  if(el("authMsg")){
    el("authMsg").textContent = d.message || d.error || "If that email exists, a reset link has been sent.";
  }
}

async function showApp() {
  const loading = el("loadingScreen");
  const fill = el("loadingFill");

  try {
    if (loading) loading.classList.remove("hidden");
    if (fill) fill.style.width = "20%";

    el("marketing")?.classList.add("hidden");
    el("auth")?.classList.add("hidden");
    const app = el("app");
app?.classList.remove("hidden");

setTimeout(() => {
  app?.classList.add("show");
}, 50);
    if (fill) fill.style.width = "50%";

    await loadMe();

    if (fill) fill.style.width = "70%";

    await loadHistory();
    await loadDashboard();
if(!localStorage.getItem("studycoach_tour_done")){
  el("welcomeTour")?.classList.remove("hidden");
  el("tourNextBtn").onclick = nextTourStep;
}
    if (fill) fill.style.width = "100%";
  } catch (err) {
    console.error("Loading error:", err);
  } finally {
    setTimeout(() => {
      if (loading) loading.classList.add("hidden");
    }, 300);
  }
}
function nextTourStep(){
  tourStep++;

  if(tourStep >= tourSlides.length){
    el("welcomeTour")?.classList.add("hidden");
    localStorage.setItem("studycoach_tour_done", "yes");
    return;
  }

  const slide = tourSlides[tourStep];

  el("tourContent").innerHTML = `
    <h1>👋 Welcome to StudyCoach AI</h1>
    <h2>${slide.title}</h2>
    <p>${slide.text}</p>
    <button id="tourNextBtn">${tourStep === tourSlides.length - 1 ? "Start studying" : "Next →"}</button>
  `;

  el("tourNextBtn").onclick = nextTourStep;
}

async function loadMe(){
  if(!token) return;
  const d = await get("/api/me");

  if(d.user){
    currentUser = d.user;
    if(el("hello")) el("hello").textContent = "Hi " + currentUser.name;
    if(el("dashTitle")) el("dashTitle").textContent = "Welcome back, " + currentUser.name;
    if(el("appYear")) el("appYear").value = currentUser.yearLevel || "Year 7";
    if(el("planText")) el("planText").textContent = currentUser.plan === "premium" ? "Premium plan" : "Free plan";
  }
}

function logout(){
  const footer = document.querySelector(".site-footer");
  if (footer) footer.style.display = "block";

  localStorage.removeItem("studycoach_7_token");
  location.reload();
}
function setPage(p){
  document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
  const page = el(p + "Page");
  if(page) page.classList.add("active");
}

async function newChat(){
  setPage("chat");

  const d = await post("/api/conversations", {
    subject: value("subject")
  }, true);

  if(d.error){
    alert(d.error);
    return;
  }

  currentConversationId = d.conversation.id;

  if(el("messages")){
    el("messages").innerHTML = `
      <div class="empty">
        <div class="logo big">
          <img src="/images/logo.svg" alt="StudyCoach AI">
        </div>

        <h2>What do you need help with?</h2>

        <div class="suggestions">
          <button data-prompt="Explain fractions for my year level">Explain fractions</button>
          <button data-prompt="Quiz me on photosynthesis">Quiz photosynthesis</button>
          <button data-prompt="Help me write an essay introduction">Essay intro</button>
        </div>
      </div>
    `;
  }

  wirePromptButtons();
  await loadHistory();
  
}

function promptSend(t){
  setPage("chat");
  if(el("message")) el("message").value = t;
  send();
}

async function send(){
  const m = value("message");
  if(!m) return;

  if(!currentConversationId){
    const created = await post("/api/conversations", {
      subject: value("subject")
    }, true);

    if(created.error){
      alert(created.error);
      return;
    }

    currentConversationId = created.conversation.id;
  }

  if(el("message")) el("message").value = "";
  document.querySelector(".empty")?.remove();

  addMsg("user", m);
  const wait = addMsg("bot", "🟢 StudyCoach AI is thinking...");

  const d = await post("/api/chat", {
    message: m,
    subject: value("subject"),
    yearLevel: value("appYear"),
    country: currentUser?.country || "New Zealand",
    conversationId: currentConversationId
  }, true);

  const textBox = document.querySelector("#" + wait + " .text");

  if(textBox){
    textBox.textContent = d.answer || d.error || "No answer.";
  }

  await loadHistory();
  await loadDashboard();
}

function addMsg(role, text){
  const mid = "m" + Date.now() + Math.random().toString(16).slice(2);
  const div = document.createElement("div");
  div.id = mid;
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.innerHTML = `
    <div class="inner">
    <div class="avatar">
  ${role === "user" ? "👤" : "🤖"}
</div>
      <div class="text">${escapeHtml(text)}</div>
    </div>`;

  el("messages")?.appendChild(div);
  if(el("messages")) el("messages").scrollTop = el("messages").scrollHeight;
  return mid;
}

async function loadHistory() {
  if (!token || !el("history")) return;

  const d = await get("/api/conversations");

  if (d.error) {
    console.error("Conversation history error:", d.error);
    el("history").innerHTML = `
      <p style="color:#f87171;font-size:13px;">
        ${escapeHtml(d.error)}
      </p>
    `;
    return;
  }

  const conversations = d.conversations || [];

  if (conversations.length === 0) {
    el("history").innerHTML = "<p>No chats yet.</p>";
    return;
  }

  el("history").innerHTML = conversations.map(c => `
    <div class="history-row ${c.id === currentConversationId ? "active" : ""}">
      <button
        class="hist"
        onclick="openConversation('${c.id}')">
        ${escapeHtml(c.title || "New chat")}
      </button>

      <button
        class="delete-chat"
        onclick="deleteConversation('${c.id}', event)"
        aria-label="Delete chat">
        ×
      </button>
    </div>
  `).join("");

  if (!currentConversationId) {
    await openConversation(conversations[0].id);
  }
}
async function openConversation(id){

  currentConversationId = id;

  setPage("chat");

  const d = await get("/api/conversations/" + id + "/messages");

  if(d.error){
    alert(d.error);
    return;
  }

  if(el("messages")){
    el("messages").innerHTML = "";
  }

  (d.messages || []).forEach(m => {

    addMsg(
      m.role === "assistant" ? "bot" : "user",
      m.content
    );

  });

}
async function deleteConversation(id, event) {
  event?.stopPropagation();

  const confirmed = confirm("Delete this chat permanently?");
  if (!confirmed) return;

  const d = await del("/api/conversations/" + id);

  if (d.error) {
    alert(d.error);
    return;
  }

  if (currentConversationId === id) {
    currentConversationId = null;

    if (el("messages")) {
      el("messages").innerHTML = `
        <div class="empty">
          <div class="logo big">
            <img src="/images/logo.svg" alt="StudyCoach AI">
          </div>
          <h2>What do you need help with?</h2>
        </div>
      `;
    }
  }

  await loadHistory();
}
async function loadDashboard(){
  if(!token) return;

  const d = await get("/api/progress");
  const profileData = await get("/api/profile");

  const analytics = d.analytics || {};
  const dailyCoach = profileData.dailyCoach || "Keep going — complete one study task today!";

  const hours = Math.round((d.estimatedStudyMinutes || 0) / 60);
  const progress = d.progressPercent || 0;
  const name = currentUser?.name || "student";

  const xp = d.xp || 0;
  const level = d.level || 1;
  const nextLevelXp = level * 100;
  const currentLevelStart = (level - 1) * 100;
  const xpIntoLevel = xp - currentLevelStart;
  const xpNeeded = nextLevelXp - currentLevelStart;
  const xpPercent = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));

  const chatCount = analytics.chatCount || 0;
  const quizAnswers = analytics.quizAnswerCount || 0;
  const homeworkCount = analytics.homeworkAverage || 0;

  const dailyChallenges = [
    { icon:"💬", title:"Ask 3 AI questions", progress:Math.min(3, chatCount), target:3 },
    { icon:"🧠", title:"Answer 3 quiz questions", progress:Math.min(3, quizAnswers), target:3 },
    { icon:"📄", title:"Upload 1 homework task", progress:Math.min(1, homeworkCount), target:1 }
  ];

  const dash = el("dashboardPage");
  if(!dash) return;

  dash.innerHTML = `
    <div class="dash-hero-pro">
      <div>
        <p class="eyebrow">StudyCoach AI</p>
        <h1>Good to see you, ${escapeHtml(name)} 👋</h1>
        <p>Ready to earn XP and keep your streak alive?</p>
      </div>
      <button onclick="newChat()">Start studying</button>
    </div>

    <div class="dash-top-grid">
      <div class="dash-main-card">
        <p class="eyebrow">Current Level</p>
        <h2>⭐ Level ${level}</h2>
     <p><b id="dashXp">0</b> / ${nextLevelXp} XP</p>
        <div class="progress-track">
      <div id="xpBarFill" class="progress-fill" style="width:0%"></div>
        </div>
      </div>
<div class="dash-mini-card"><span>🔥</span><h3 id="dashStreakNum">0</h3><p>Day streak</p></div>
<div class="dash-mini-card"><span>📚</span><h3 id="dashTasksNum">0</h3><p>Study tasks</p></div>
<div class="dash-mini-card"><span>🎯</span><h3 id="dashGoalNum">0%</h3><p>Weekly goal</p></div>
    </div>

    <div class="dashboard-grid">
      <div class="panel big-panel">
        <h3>🎯 Today's Mission</h3>
        <div class="mission-list">
          <div>☐ Ask the AI one study question</div>
          <div>☐ Complete one quiz or flashcard set</div>
          <div>☐ Study for 20 minutes</div>
        </div>
      </div>

<div class="panel">
  <div class="daily-reward-card">
  <div class="reward-icon">🎁</div>
  <div>
    <h3>Daily Reward</h3>
    <p>${d.claimedToday ? "Reward claimed today." : "Claim your daily +25 XP bonus."}</p>
    <button id="claimRewardBtn" onclick="claimDailyReward()" ${d.claimedToday ? "disabled" : ""}>
      ${d.claimedToday ? "✅ Come back tomorrow" : "🎁 Claim +25 XP"}
    </button>
  </div>
</div>

      <div class="panel big-panel">
        <h3>🏆 Daily Challenges</h3>
        <div class="challenge-list">
          ${dailyChallenges.map(c => `
            <div class="challenge-row">
              <span>${c.icon}</span>
              <div>
                <b>${c.title}</b>
                <p>${c.progress} / ${c.target} complete</p>
                <div class="challenge-track">
                  <div class="challenge-fill" style="width:${Math.round((c.progress / c.target) * 100)}%"></div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="panel big-panel">
        <h3>📊 Analytics</h3>
        <div class="analytics-grid">
          <div class="analytics-card"><span>📚</span><h2>${analytics.studyTasks || 0}</h2><p>Total Tasks</p></div>
          <div class="analytics-card"><span>🧪</span><h2>${analytics.quizCount || 0}</h2><p>Quizzes</p></div>
          <div class="analytics-card"><span>📄</span><h2>${analytics.homeworkAverage || 0}</h2><p>Homework</p></div>
          <div class="analytics-card"><span>🃏</span><h2>${analytics.flashcardCount || 0}</h2><p>Flashcards</p></div>
        </div>
      </div>

      <div class="panel">
        <h3>🤖 AI Daily Coach</h3>
        <pre class="coach-text">${escapeHtml(dailyCoach)}</pre>
      </div>

      <div class="panel">
        <h3>⚡ Quick Actions</h3>
        <div class="quick">
          <button data-prompt="Explain fractions for my year level">Explain fractions</button>
          <button data-prompt="Quiz me on photosynthesis">Quiz photosynthesis</button>
          <button onclick="setPage('quiz')">Open Quiz</button>
          <button onclick="setPage('flashcards')">Open Flashcards</button>
          <button onclick="setPage('profile')">View AI profile</button>
        </div>
      </div>
    </div>
  `;
function animateNumber(id, end, suffix = ""){
  const node = el(id);
  if(!node) return;

  let start = 0;
  const duration = 800;
  const startTime = performance.now();

  function tick(now){
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.round(start + (end - start) * progress);
    node.textContent = value + suffix;

    if(progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
  animateNumber("dashXp", xp);
animateNumber("dashStreakNum", d.streak || 0);
animateNumber("dashTasksNum", d.total || 0);
animateNumber("dashGoalNum", progress, "%");
  
  setTimeout(() => {
  const bar = el("xpBarFill");
  if (bar) {
    bar.style.width = xpPercent + "%";
  }
}, 200);
  wirePromptButtons();
}
async function loadProgress(){
  setPage("progress");
  const d = await get("/api/progress");
  const badges = (d.badges || [])
    .map(b => `<span class="badge">${escapeHtml(b)}</span>`)
    .join("") || "No badges yet.";

  if(el("progressOut")){
    el("progressOut").innerHTML = `
      <h3>Total study tasks: ${d.total || 0}</h3>
      <p><b>Streak:</b> ${d.streak || 0} days</p>
      <h3>By subject</h3>
      <pre>${escapeHtml(JSON.stringify(d.bySubject || {}, null, 2))}</pre>
        <h3>Badges</h3>
      <div>${badges}</div>`;
  }
}
async function loadProfile() {
  setPage("profile");

  const d = await get("/api/profile");
  const progressData = await get("/api/progress");
  const currentStreak = progressData.currentStreak || 0;
const bestStreak = progressData.bestStreak || 0;
const studyDates = progressData.studyDates || [];
const achievementData = await get("/api/achievements");
const earnedAchievements = achievementData.achievements || [];
 const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
const monthLabel = today.toLocaleDateString("en-NZ", {
  month: "long",
  year: "numeric"
});
const calendarDays = [];

const startDate = new Date(today);
const dayOfWeek = startDate.getDay(); // Sun=0, Mon=1
const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
startDate.setDate(today.getDate() - mondayOffset - 21);

for (let i = 0; i < 28; i++) {
const d = new Date(startDate);
d.setDate(startDate.getDate() + i);
  const dateKey = d.toISOString().slice(0, 10);

 calendarDays.push({
  day: d.getDate(),
  dateKey,
  studied: studyDates.includes(dateKey),
  isToday: dateKey === todayKey
});
}
const allAchievements = [
  {
    key: "first-ai-question",
    icon: "💬",
    title: "First AI Question",
    description: "Ask your first AI question."
  },
  
  {
    key: "first-quiz-answer",
    icon: "🧠",
    title: "First Quiz Answer",
    description: "Answer your first quiz question."
  },
  {
    key: "first-flashcards",
    icon: "🃏",
    title: "First Flashcards",
    description: "Create your first flashcard set."
  },
  {
    key: "first-homework",
    icon: "📄",
    title: "First Homework Upload",
    description: "Upload your first homework."
  },
  {
    key: "study-starter",
    icon: "🚀",
    title: "Study Starter",
    description: "Complete 10 study activities."
  }
];
  if (d.error) {
    el("profileOut").innerHTML = `<p>${escapeHtml(d.error)}</p>`;
    return;
  }

  const p = d.profile || {};
  const xp = d.xp || 0;
  const level = d.level || 1;
  const nextLevelXp = level * 100;
  const xpPercent = Math.min(100, Math.round((xp / nextLevelXp) * 100));

  el("profileOut").innerHTML = `
    <div class="profile-hero">
      <div>
        <p class="eyebrow">AI Student Memory</p>
        <h1>🧠 ${escapeHtml(p.name || currentUser?.name || "Student")}</h1>
        <p>${escapeHtml(p.year_level || currentUser?.yearLevel || "Year level")} • ${escapeHtml(p.country || currentUser?.country || "New Zealand")}</p>
      </div>
      <div class="profile-level">
        <h2>⭐ Level ${level}</h2>
        <p>${xp} XP</p>
      </div>
    </div>

    <div class="level-card">
      <p class="eyebrow">Progress to Level ${level + 1}</p>
      <div class="progress-track">
        <div class="progress-fill" style="width:${xpPercent}%"></div>
      </div>
      <p><b>${xp}</b> / ${nextLevelXp} XP</p>
    </div>

    <div class="profile-grid">
      <div class="panel">
        <h3>📚 Learning Profile</h3>
        <p><b>Favourite Subject:</b> ${escapeHtml(p.favourite_subject || "Not learned yet")}</p>
        <p><b>Weak Subject:</b> ${escapeHtml(p.weak_subject || "Not learned yet")}</p>
        <p><b>Weak Topics:</b> ${escapeHtml(p.weak_topics || "None yet")}</p>
        <p><b>Recently Learned:</b> ${escapeHtml(p.recently_learned || "Nothing yet")}</p>
      </div>

      <div class="panel">
        <h3>🧠 AI Brain</h3>
        <p><b>Learning Style:</b> ${escapeHtml(p.learning_style || "Still learning")}</p>
        <p><b>Memory Notes:</b></p>
        <p>${escapeHtml(p.memory_notes || "The AI is still learning about this student.")}</p>
      </div>

      <div class="panel">
        <h3>🎯 Goals</h3>
        <p>${escapeHtml(p.goals || "Build strong study habits")}</p>
      </div>

      <div class="panel">
        <h3>📊 Scores</h3>
        <p><b>Homework Average:</b> ${p.homework_average || 0}/10</p>
        <p><b>Quiz Average:</b> ${p.quiz_average || 0}/10</p>
      </div>
    </div>
    
<div class="panel">
<h3>🔥 Study Streak Calendar</h3>

<h4 class="calendar-month">${monthLabel}</h4>
<div class="streak-stats">
  <div class="streak-stat">
    <h2>🔥 ${currentStreak}</h2>
    <p>Current Streak</p>
  </div>

  <div class="streak-stat">
    <h2>🏆 ${bestStreak}</h2>
    <p>Best Streak</p>
  </div>
</div>
<div class="streak-weekdays">
  <span>Mon</span>
  <span>Tue</span>
  <span>Wed</span>
  <span>Thu</span>
  <span>Fri</span>
  <span>Sat</span>
  <span>Sun</span>
</div>

<div class="streak-calendar">
    ${calendarDays.map(d => `
    <div class="streak-day ${d.studied ? "studied" : ""} ${d.isToday ? "today" : ""}" title="${d.dateKey}">
  ${d.day}
</div>
    `).join("")}
  </div>
</div>

  <div class="panel">
  <h3>🏆 Achievement Gallery</h3>

  <div class="achievement-gallery">
    ${allAchievements.map(a => {
      const earned = earnedAchievements.find(e => e.achievement_key === a.key);

      return `
        <div class="achievement-card ${earned ? "unlocked" : "locked"}">
          <div class="achievement-icon">${earned ? a.icon : "🔒"}</div>
          <h4>${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(a.description)}</p>
          <span>${earned ? "Unlocked" : "Locked"}</span>
        </div>
      `;
    }).join("")}
  </div>
</div>
  `;
}
async function loadParent(){
  if(!requirePremium("Parent dashboard")) return;
  
  setPage("parent");
  const d = await get("/api/progress");

  if(el("parentOut")){
    el("parentOut").innerHTML = `
      <h3>Parent summary</h3>
      <p><b>Total tasks:</b> ${d.total || 0}</p>
      <p><b>Study streak:</b> ${d.streak || 0} days</p>`;
  }
}

async function makePlan(){
  const d = await post("/api/study-plan", {
    goal: value("planGoal"),
    subject: value("subject"),
    days: value("planDays")
  }, true);

  if(d.error){
    if(el("planOut")) el("planOut").textContent = d.error;
    return;
  }

  if(el("planOut")){
    el("planOut").textContent = `Goal: ${d.plan.goal}\n\n` +
      d.plan.days.map(x => `Day ${x.day}: ${x.task} (${x.minutes} min)`).join("\n");
  }

  await loadDashboard();
}

let currentQuiz = [];
let currentQuizIndex = 0;
let currentQuizScore = 0;
let currentQuizAnswered = false;

let currentFlashcards = [];
let currentFlashcardIndex = 0;
let flashcardShowingBack = false;
let flashcardTouchStartX = 0;

async function makeQuiz(){
  const topic = value("quizTopic");

  if(!topic){
    if(el("quizOut")){
      el("quizOut").innerHTML = "<p>Please enter a quiz topic first.</p>";
    }
    return;
  }

  if(el("quizOut")){
    el("quizOut").innerHTML = `
      <div class="quiz-card quiz-loading">
        <h2>Creating your quiz...</h2>
        <p>StudyCoach AI is preparing questions for you.</p>
      </div>
    `;
  }

  const d = await post("/api/quiz",{
    topic,
    subject: value("subject")
  }, true);

  if(d.error){
    if(el("quizOut")) el("quizOut").textContent = d.error;
    return;
  }

  currentQuiz = d.quiz?.questions || [];
  currentQuizIndex = 0;
  currentQuizScore = 0;
  currentQuizAnswered = false;

  showQuizQuestion();
  await loadDashboard();
}

function showQuizQuestion(){
  if(!el("quizOut")) return;

  if(currentQuiz.length === 0){
    el("quizOut").innerHTML = "<p>No quiz questions found.</p>";
    return;
  }

  const q = currentQuiz[currentQuizIndex];
  const progress = Math.round(
    ((currentQuizIndex + 1) / currentQuiz.length) * 100
  );

  el("quizOut").innerHTML = `
    <div class="quiz-card">
      <div class="quiz-top-row">
        <p class="eyebrow">
          Question ${currentQuizIndex + 1} of ${currentQuiz.length}
        </p>
        <p class="quiz-score">Score: ${currentQuizScore}</p>
      </div>

      <div class="quiz-progress-track">
        <div class="quiz-progress-fill" style="width:${progress}%"></div>
      </div>

      <h2>${escapeHtml(q)}</h2>

      <textarea
        id="quizAnswer"
        placeholder="Type your answer here..."
        aria-label="Quiz answer"
      ></textarea>

      <div class="quiz-actions">
        <button id="checkQuizBtn" onclick="checkQuizAnswer()">
          Check answer
        </button>
        <button
          id="skipQuizBtn"
          class="secondary"
          onclick="nextQuizQuestion()">
          Skip
        </button>
      </div>

      <div id="quizFeedback" aria-live="polite"></div>
    </div>
  `;

  currentQuizAnswered = false;

  el("quizAnswer")?.addEventListener("keydown", event => {
    if(event.key === "Enter" && !event.shiftKey){
      event.preventDefault();
      checkQuizAnswer();
    }
  });
}

async function checkQuizAnswer(){
  if(currentQuizAnswered) return;

  const answer = value("quizAnswer");
  const q = currentQuiz[currentQuizIndex];

  if(!answer){
    el("quizFeedback").innerHTML =
      "<p class='quiz-warning'>Please type an answer first.</p>";
    return;
  }

  el("quizFeedback").innerHTML = "<p>Checking answer...</p>";

  const checkBtn = el("checkQuizBtn");
  const skipBtn = el("skipQuizBtn");

  if(checkBtn) checkBtn.disabled = true;
  if(skipBtn) skipBtn.disabled = true;

  const d = await post("/api/check-quiz-answer", {
    question: q,
    answer,
    subject: value("subject"),
    yearLevel: value("appYear")
  }, true);

  if(d.error){
    el("quizFeedback").innerHTML = `<p>${escapeHtml(d.error)}</p>`;
    if(checkBtn) checkBtn.disabled = false;
    if(skipBtn) skipBtn.disabled = false;
    return;
  }

  currentQuizAnswered = true;

  const resultText = String(d.result || "");
  const isCorrect =
    d.correct === true ||
    /(correct|great job|well done|excellent)/i.test(resultText);

  if(isCorrect){
    currentQuizScore++;
  }

  const card = document.querySelector("#quizOut .quiz-card");
  card?.classList.add(isCorrect ? "quiz-correct" : "quiz-incorrect");

  el("quizFeedback").innerHTML = `
    <div class="${isCorrect ? "feedback-good" : "feedback-review"}">
      <h3>${isCorrect ? "✅ Correct!" : "📘 Review this answer"}</h3>
      <p>${escapeHtml(resultText || "Answer checked.")}</p>
      <button onclick="nextQuizQuestion()">
        ${currentQuizIndex === currentQuiz.length - 1
          ? "See results"
          : "Next question →"}
      </button>
    </div>
  `;

  await loadDashboard();

  if(isCorrect){
    showAchievement(
      "🎉 +10 XP Earned!",
      "Great work! Your dashboard and level have been updated."
    );
  }
}

function nextQuizQuestion(){
  currentQuizIndex++;

  if(currentQuizIndex >= currentQuiz.length){
    const percentage = currentQuiz.length
      ? Math.round((currentQuizScore / currentQuiz.length) * 100)
      : 0;

    el("quizOut").innerHTML = `
      <div class="quiz-card quiz-complete">
        <div class="quiz-finish-icon">🏆</div>
        <p class="eyebrow">Quiz complete</p>
        <h2>You scored ${currentQuizScore} out of ${currentQuiz.length}</h2>
        <div class="quiz-final-score">${percentage}%</div>
        <p>
          ${percentage >= 80
            ? "Excellent work — you know this topic well."
            : percentage >= 50
              ? "Good effort — review the questions and try again."
              : "Keep practising — every attempt builds your knowledge."}
        </p>
        <div class="quiz-actions">
          <button onclick="makeQuiz()">Try this quiz again</button>
          <button class="secondary" onclick="setPage('flashcards')">
            Study with flashcards
          </button>
        </div>
      </div>
    `;
    return;
  }

  showQuizQuestion();
}

 
function normaliseFlashcards(data){
  const cards =
    data?.flashcards?.cards ||
    data?.cards ||
    data?.flashcards ||
    data?.results ||
    [];

  if(!Array.isArray(cards)) return [];

  const clean = value => String(value ?? "").trim();

  const firstDifferentAnswer = (front, candidates) => {
    const frontClean = clean(front).toLowerCase();

    for(const candidate of candidates){
      const answer = clean(candidate);

      if(answer && answer.toLowerCase() !== frontClean){
        return answer;
      }
    }

    return "";
  };

  return cards.map(card => {
    if(Array.isArray(card)){
      const front = clean(card[0]);
      const back = firstDifferentAnswer(front, card.slice(1));

      return { front, back };
    }

    if(typeof card === "string"){
      const raw = card.trim();

      const labelled = raw.match(
        /(?:question|front|term)\s*:\s*([\s\S]*?)(?:\n|\r\n?|\s{2,})(?:answer|back|definition)\s*:\s*([\s\S]*)/i
      );

      if(labelled){
        return {
          front: clean(labelled[1]),
          back: clean(labelled[2])
        };
      }

      const separators = ["|||", " :: ", " — ", " - ", "\n"];

      for(const separator of separators){
        if(raw.includes(separator)){
          const parts = raw.split(separator);
          const front = clean(parts.shift());
          const back = clean(parts.join(separator));

          if(front && back && front.toLowerCase() !== back.toLowerCase()){
            return { front, back };
          }
        }
      }

      const colonIndex = raw.indexOf(":");

      if(colonIndex > 0){
        const front = clean(raw.slice(0, colonIndex));
        const back = clean(raw.slice(colonIndex + 1));

        return {
          front,
          back:
            back && back.toLowerCase() !== front.toLowerCase()
              ? back
              : "Answer unavailable for this card."
        };
      }

      return {
        front: raw,
        back: "Answer unavailable for this card."
      };
    }

    const front = clean(
      card?.question ??
      card?.Question ??
      card?.front ??
      card?.Front ??
      card?.term ??
      card?.Term ??
      card?.prompt ??
      card?.title
    );

    const back = firstDifferentAnswer(front, [
      card?.answer,
      card?.Answer,
      card?.definition,
      card?.Definition,
      card?.back,
      card?.Back,
      card?.response,
      card?.explanation,
      card?.meaning,
      card?.content
    ]);

    return {
      front,
      back: back || "Answer unavailable for this card."
    };
  }).filter(card => card.front);
}

async function makeFlash(){
  const topic = value("flashTopic");

  if(!topic){
    if(el("flashOut")){
      el("flashOut").classList.remove("hidden");
      el("flashOut").textContent =
        "Please enter a flashcard topic first.";
    }
    return;
  }

  el("flashLoading")?.classList.remove("hidden");
  el("flashcardStudyArea")?.classList.add("hidden");
  el("flashOut")?.classList.add("hidden");

  const d = await post("/api/flashcards", {
    topic,
    subject: value("subject")
  }, true);

  el("flashLoading")?.classList.add("hidden");

  if(d.error){
    if(el("flashOut")){
      el("flashOut").classList.remove("hidden");
      el("flashOut").textContent = d.error;
    }
    return;
  }

  currentFlashcards = normaliseFlashcards(d);
  currentFlashcardIndex = 0;
  flashcardShowingBack = false;

  if(currentFlashcards.length === 0){
    if(el("flashOut")){
      el("flashOut").classList.remove("hidden");
      el("flashOut").textContent =
        "No usable flashcards were returned.";
    }
    return;
  }

  el("flashcardStudyArea")?.classList.remove("hidden");
  renderFlashcard();
  await loadDashboard();
}

function renderFlashcard(){
  if(currentFlashcards.length === 0) return;

  const card = currentFlashcards[currentFlashcardIndex];

  if(el("flashFrontText")) el("flashFrontText").textContent = card.front;
  if(el("flashBackText")) el("flashBackText").textContent = card.back;

  if(el("flashCounter")){
    el("flashCounter").textContent =
      `Card ${currentFlashcardIndex + 1} of ${currentFlashcards.length}`;
  }

  if(el("flashProgressFill")){
    const percent =
      ((currentFlashcardIndex + 1) / currentFlashcards.length) * 100;
    el("flashProgressFill").style.width = percent + "%";
  }

  if(el("previousFlashcard")){
    el("previousFlashcard").disabled =
      currentFlashcardIndex === 0;
  }

  if(el("nextFlashcard")){
    el("nextFlashcard").textContent =
      currentFlashcardIndex === currentFlashcards.length - 1
        ? "Finish ✓"
        : "Next →";
  }

  flashcardShowingBack = false;
  el("studyFlashcard")?.classList.remove("flipped");
  el("flashExplainOut")?.classList.add("hidden");
}

function flipCurrentFlashcard(){
  if(currentFlashcards.length === 0) return;

  flashcardShowingBack = !flashcardShowingBack;
  el("studyFlashcard")?.classList.toggle(
    "flipped",
    flashcardShowingBack
  );
}

function nextFlashcard(){
  if(currentFlashcards.length === 0) return;

  if(currentFlashcardIndex < currentFlashcards.length - 1){
    currentFlashcardIndex++;
    renderFlashcard();
    return;
  }

  const studyArea = el("flashcardStudyArea");

  if(studyArea){
    studyArea.innerHTML = `
      <div class="flashcards-complete">
        <div class="flash-finish-icon">🎉</div>
        <p class="eyebrow">Set complete</p>
        <h2>You studied ${currentFlashcards.length} flashcards</h2>
        <p>Great work. Repeat the set or create a new topic.</p>
        <div class="flashcard-controls">
         <button onclick="restartFlashcards()">Study again</button>
          <button class="secondary" onclick="focusFlashTopic()">
            New topic
          </button>
        </div>
      </div>
    `;
  }

  showAchievement(
    "🎉 Flashcard set complete!",
    `You studied ${currentFlashcards.length} flashcards.`
  );
}

function restartFlashcards(){
  currentFlashcardIndex = 0;
  flashcardShowingBack = false;
  restoreFlashcardStudyMarkup();
  renderFlashcard();
}

function focusFlashTopic(){
  el("flashcardStudyArea")?.classList.add("hidden");
  el("flashTopic")?.focus();
}
function restoreFlashcardStudyMarkup(){
  const area = el("flashcardStudyArea");
  if(!area) return;

  area.innerHTML = `
    <div class="flashcard-meta">
      <span id="flashCounter">Card 1 of 1</span>
      <div class="flashcard-meta-actions">
        <button id="shuffleFlashcards" class="secondary" type="button">
          🔀 Shuffle
        </button>
      </div>
    </div>

    <div class="flash-progress-track" aria-label="Flashcard progress">
      <div id="flashProgressFill" class="flash-progress-fill"></div>
    </div>

    <div
      id="studyFlashcard"
      class="study-flashcard"
      role="button"
      tabindex="0"
      aria-label="Flashcard. Press Enter or Space to flip.">
      <div class="study-flashcard-inner">
        <div class="study-flashcard-face study-flashcard-front">
          <p class="flash-side-label">QUESTION</p>
          <div id="flashFrontText" class="flashcard-text"></div>
          <small>Tap the card to flip</small>
        </div>

        <div class="study-flashcard-face study-flashcard-back">
          <p class="flash-side-label">ANSWER</p>
          <div id="flashBackText" class="flashcard-text"></div>
          <small>Tap the card to see the question</small>
        </div>
      </div>
    </div>

    <div class="flashcard-controls">
      <button id="previousFlashcard" class="secondary" type="button">
        ← Previous
      </button>
      <button id="flipFlashcard" type="button">Flip</button>
      <button id="nextFlashcard" type="button">Next →</button>
    </div>

    <p class="flashcard-help">
      Keyboard: ← previous, Space to flip, → next.
    </p>

    <div id="flashExplainOut" class="output hidden"></div>
  `;

  wireFlashcardControls();
}

function previousFlashcard(){
  if(currentFlashcards.length === 0) return;
  if(currentFlashcardIndex === 0) return;

  currentFlashcardIndex--;
  renderFlashcard();
}

function shuffleFlashcards(){
  if(currentFlashcards.length === 0) return;

  for(let i = currentFlashcards.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [currentFlashcards[i], currentFlashcards[j]] =
      [currentFlashcards[j], currentFlashcards[i]];
  }

  currentFlashcardIndex = 0;
  renderFlashcard();

  showAchievement(
    "🔀 Cards shuffled",
    "Your flashcards are now in a new order."
  );
}

function readCurrentFlashcard(){
  if(currentFlashcards.length === 0){
    alert("Create some flashcards first.");
    return;
  }

  if(!("speechSynthesis" in window)){
    alert("Read aloud is not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const card = currentFlashcards[currentFlashcardIndex];
  const textToRead =
    flashcardShowingBack ? card.back : card.front;

  const speech = new SpeechSynthesisUtterance(textToRead);
  speech.lang = "en-NZ";
  speech.rate = 0.95;
  window.speechSynthesis.speak(speech);
}

async function explainCurrentFlashcard(){
  if(currentFlashcards.length === 0){
    alert("Create some flashcards first.");
    return;
  }

  const out = el("flashExplainOut");
  const card = currentFlashcards[currentFlashcardIndex];

  if(!out) return;

  out.classList.remove("hidden");
  out.innerHTML =
    "<p>StudyCoach AI is explaining this card...</p>";

  const d = await post("/api/chat", {
    message:
      `Explain this flashcard clearly for ${value("appYear")}.
` +
      `Question: ${card.front}
` +
      `Answer: ${card.back}
` +
      "Give a short explanation and one useful example.",
    subject: value("subject"),
    yearLevel: value("appYear"),
    country: currentUser?.country || "New Zealand",
    conversationId: currentConversationId
  }, true);

  if(d.error){
    out.innerHTML = `<p>${escapeHtml(d.error)}</p>`;
    return;
  }

  out.innerHTML = `
    <div class="flashcard-explanation">
      <h3>🤖 AI Explanation</h3>
      <p>${escapeHtml(d.answer || "No explanation returned.")}</p>
    </div>
  `;
}

function handleFlashcardKeyboard(event){
  const flashcardsPage = el("flashcardsPage");

  if(
    !flashcardsPage ||
    !flashcardsPage.classList.contains("active") ||
    currentFlashcards.length === 0
  ){
    return;
  }

  const activeTag = document.activeElement?.tagName?.toLowerCase();

  if(
    activeTag === "input" ||
    activeTag === "textarea" ||
    activeTag === "select"
  ){
    return;
  }

  if(event.key === "ArrowRight"){
    event.preventDefault();
    nextFlashcard();
  }else if(event.key === "ArrowLeft"){
    event.preventDefault();
    previousFlashcard();
  }else if(event.key === " " || event.key === "Enter"){
    event.preventDefault();
    flipCurrentFlashcard();
  }
}

function handleFlashcardTouchStart(event){
  flashcardTouchStartX =
    event.changedTouches?.[0]?.screenX || 0;
}

function handleFlashcardTouchEnd(event){
  const endX = event.changedTouches?.[0]?.screenX || 0;
  const difference = endX - flashcardTouchStartX;

  if(Math.abs(difference) < 50) return;

  if(difference < 0){
    nextFlashcard();
  }else{
    previousFlashcard();
  }
}

function wireFlashcardControls(){
  const card = el("studyFlashcard");

  if(card){
    card.onclick = flipCurrentFlashcard;
    card.addEventListener(
      "touchstart",
      handleFlashcardTouchStart,
      { passive: true }
    );
    card.addEventListener(
      "touchend",
      handleFlashcardTouchEnd,
      { passive: true }
    );
  }

  if(el("flipFlashcard")) el("flipFlashcard").onclick = flipCurrentFlashcard;
  if(el("nextFlashcard")) el("nextFlashcard").onclick = nextFlashcard;
  if(el("previousFlashcard")) el("previousFlashcard").onclick = previousFlashcard;
  if(el("shuffleFlashcards")) el("shuffleFlashcards").onclick = shuffleFlashcards;
}


async function uploadHomework(){

  // Remove this line temporarily while we build the feature.
  // if(!requirePremium("Homework upload")) return;

  const fileBox = el("homeworkFile");
  const noteBox = el("homeworkNote");
  const out = el("uploadOut");

  const file = fileBox?.files?.[0];

  if(!file){
    out.textContent = "Please choose a homework file first.";
    return;
  }

  out.textContent = "Uploading...";

  const form = new FormData();
  form.append("file", file);
  form.append("note", noteBox?.value || "");

 // Use the global token variable that's already loaded

  const r = await fetch("/api/upload-homework", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: form
  });

  const d = await r.json();

  if(d.error){
  out.textContent = d.error;
  return;
}

const txt = d.message || "";

const get = (heading) => {
  const match = txt.match(
    new RegExp(heading + ":\\s*([\\s\\S]*?)(?=SCORE:|STRENGTHS:|IMPROVEMENTS:|REVISION:|NEXT_STEPS:|$)")
  );
  return match ? match[1].trim() : "";
};

out.innerHTML = `
<div class="feedback-card">

<h2>📄 Homework Assessment</h2>

<div class="score-box">
<h1>⭐ ${get("SCORE")}</h1>
</div>

<div class="feedback-section">
<h3>✅ Strengths</h3>
<ul>
${get("STRENGTHS").split("\n").map(x=>`<li>${x.replace("-","").trim()}</li>`).join("")}
</ul>
</div>

<div class="feedback-section">
<h3>⚠️ Improvements</h3>
<ul>
${get("IMPROVEMENTS").split("\n").map(x=>`<li>${x.replace("-","").trim()}</li>`).join("")}
</ul>
</div>

<div class="feedback-section">
<h3>📚 Revision</h3>
<ul>
${get("REVISION").split("\n").map(x=>`<li>${x.replace("-","").trim()}</li>`).join("")}
</ul>
</div>

<div class="feedback-section">
<h3>🎯 Next Steps</h3>
<ul>
${get("NEXT_STEPS").split("\n").map(x=>`<li>${x.replace("-","").trim()}</li>`).join("")}
</ul>
</div>

</div>
`;
  
}


function startVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(!SR){
    alert("Voice input is not supported in this browser. Try Chrome.");
    return;
  }

  const rec = new SR();
  rec.lang = "en-NZ";
  rec.onresult = e => {
    if(el("message")) el("message").value = e.results[0][0].transcript;
  };
  rec.start();
}

async function loadTeacher(){
  if(!requirePremium("Teacher dashboard")) return;
  
  const d = await get("/api/teacher-summary");

  if(el("teacherOut")){
    el("teacherOut").textContent = (d.students || [])
      .map(s => `${s.name} — ${s.yearLevel} — ${s.tasks} tasks — ${s.streak} day streak — ${s.plan}`)
      .join("\n") || "No students yet.";
  }
}
function isPremium(){
  return currentUser && currentUser.plan === "premium";
}

function requirePremium(featureName){
  if(isPremium()) return true;

  alert(featureName + " is a Premium feature. Please upgrade to unlock it.");
  setPage("pricing");
  return false;
}
async function startTrial(){

  const d = await post("/api/start-trial", {}, true);

  if(d.error){
    alert(d.error);
    return;
  }

  // Track a successfully started trial
  if(typeof gtag === "function"){
    gtag("event", "trial_started", {
      plan: "premium",
      trial_length_days: 7,
      value: 14.99,
      currency: "NZD"
    });
  }

  alert("🎉 Your 7-Day Premium Trial has started!");

  await loadDashboard();
  await loadProfile();

  const me = await get("/api/me");

  if(me.user){
    currentUser = me.user;
  }

  setPage("pricing");
  
}

async function stripeUpgrade(){
  const d = await post("/api/create-checkout-session", {}, true);

  if(d.url){
    location.href = d.url;
    return;
  }

  alert(d.error || "Stripe checkout failed.");
}

async function runDebug(){
  const d = await fetch("/api/health")
    .then(r => r.json())
    .catch(e => ({ error: e.message }));

  if(el("debugOut")){
    el("debugOut").innerHTML = `<pre>${escapeHtml(JSON.stringify(d, null, 2))}</pre>`;
  }
}

async function post(url, body, needsAuth) {
  try {
    const headers = {
      "Content-Type": "application/json"
    };

    if (needsAuth) {
      headers.Authorization = "Bearer " + token;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        error:
          `Server returned ${response.status} instead of JSON.\n\n` +
          rawText.substring(0, 300)
      };
    }

    return data;

  } catch (err) {
    return {
      error: "Network/server error: " + err.message
    };
  }
}
async function del(url) {
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        error: `Server returned ${response.status} instead of JSON.`
      };
    }

    return data;
  } catch (err) {
    return {
      error: "Network/server error: " + err.message
    };
  }
}
async function get(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        error:
          `Server returned ${response.status} instead of JSON.\n\n` +
          rawText.substring(0, 300)
      };
    }

    return data;

  } catch (err) {
    return {
      error: "Network/server error: " + err.message
    };
  }
}
function showAchievement(title, message){
  const old = document.querySelector(".achievement-pop");
  if(old) old.remove();

  const pop = document.createElement("div");
  pop.className = "achievement-pop";

  pop.innerHTML = `
    <div class="achievement-box">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  document.body.appendChild(pop);

  setTimeout(() => {
    pop.remove();
  }, 3500);
}
function wirePromptButtons(){
  document.querySelectorAll("[data-prompt]").forEach(btn => {
    btn.onclick = () => promptSend(btn.getAttribute("data-prompt"));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  function on(id, fn){
    const x = el(id);
    if(x) x.onclick = fn;
  }

  function key(id, fn){
    const x = el(id);
    if(x) x.addEventListener("keydown", fn);
  }

  fillYears("yearLevel");
  fillYears("appYear");

  on("loginTop", showLogin);
  on("startTop", showSignup);
  on("startHero", showSignup);
  on("pricingBtn", () => {
    const p = el("pricing");
    if(p) p.scrollIntoView();
  });
  on("startFreePrice", showSignup);
  on("premiumPrice", showSignup);
  on("forgotPasswordBtn", forgotPassword);
  on("authBtn", authAction);
  on("switchAuth", toggleAuth);
  on("backHome", backHome);
  on("newChat", newChat);
  on("navDashboard", () => { setPage("dashboard"); loadDashboard(); });
  on("navLibrary", () => setPage("library"));
  on("navChat", () => setPage("chat"));
  on("navUpload", () => setPage("upload"));
  on("navPlan", () => setPage("plan"));
  on("navQuiz", () => setPage("quiz"));
  on("navFlashcards", () => setPage("flashcards"));
  on("navProgress", loadProgress);
  on("navProfile", loadProfile);
  on("navParent", loadParent);
  on("navTeacher", () => setPage("teacher"));
  on("navPricing", () => setPage("pricing"));
  on("navDebug", () => setPage("debug"));
on("mobileMenuBtn", () => {
  el("sideMenu")?.classList.toggle("open");
});
  on("logoutBtn", logout);
  on("sendBtn", send);
  on("voiceBtn", startVoice);
  on("uploadBtn", uploadHomework);
  on("makePlan", makePlan);
  on("quickPlan", () => {
    setPage("plan");
    const p = el("planGoal");
    if(p) p.value = "Improve this week";
  });
  on("makeQuiz", makeQuiz);
  on("makeFlash", makeFlash);
  on("readFlashcard", readCurrentFlashcard);
  on("explainFlashcard", explainCurrentFlashcard);
  wireFlashcardControls();
  on("loadTeacher", loadTeacher);
  on("startTrialBtn", startTrial);
  on("stripeUpgrade", stripeUpgrade);
  on("runDebug", runDebug);

  key("message", e => {
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  document.addEventListener(
    "keydown",
    handleFlashcardKeyboard
  );

  wirePromptButtons();

  if(token) showApp();
});
