let token = localStorage.getItem("studycoach_7_token") || "";
let mode = "signup";
let currentUser = null;

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

  token = d.token;
  currentUser = d.user;
  localStorage.setItem("studycoach_7_token", token);
  showApp();
}

async function showApp(){
  el("marketing")?.classList.add("hidden");
  el("auth")?.classList.add("hidden");
  el("app")?.classList.remove("hidden");

  const footer = document.querySelector(".site-footer");
  if (footer) footer.style.display = "none";

  await loadMe();
  await loadHistory();
  await loadDashboard();
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

function newChat(){
  setPage("chat");
  if(el("messages")){
    el("messages").innerHTML = `
      <div class="empty">
        <div class="logo big">S</div>
        <h2>👋 Welcome to StudyCoach AI</h2>

<p style="opacity:.8;margin-top:8px;">
Ask anything about school, upload homework,
create quizzes or build study plans.
</p>
        <div class="suggestions">
          <button data-prompt="Explain fractions for my year level">Explain fractions</button>
          <button data-prompt="Quiz me on photosynthesis">Quiz photosynthesis</button>
          <button data-prompt="Help me write an essay introduction">Essay intro</button>
        </div>
      </div>`;
  }
  wirePromptButtons();
}

function promptSend(t){
  setPage("chat");
  if(el("message")) el("message").value = t;
  send();
}

async function send(){
  const m = value("message");
  if(!m) return;

  if(el("message")) el("message").value = "";
  document.querySelector(".empty")?.remove();

  addMsg("user", m);
 const wait = addMsg("bot", "🟢 StudyCoach AI is thinking...");

  const d = await post("/api/chat", {
    message: m,
    subject: value("subject"),
    yearLevel: value("appYear"),
    country: currentUser?.country || "New Zealand"
  }, true);

  const textBox = document.querySelector("#" + wait + " .text");
  if(textBox) textBox.textContent = d.answer || d.error || "No answer.";

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

async function loadHistory(){
  if(!token || !el("history")) return;

  const d = await get("/api/history");
  const chats = d.chats || [];

  if(chats.length === 0){
    el("history").innerHTML = "<p>No chats yet.</p>";
    return;
  }

  el("history").innerHTML = chats.map(c => `
    <button class="hist" onclick="openHistoryChat('${c.id}')">
      ${escapeHtml(c.message || "Untitled chat")}
    </button>
  `).join("");
  
}

async function openHistoryChat(id){
  setPage("chat");

  const d = await get("/api/chat/" + id);

  if(d.error){
    alert(d.error);
    return;
  }

  const chat = d.chat;

  if(el("messages")){
    el("messages").innerHTML = "";
  }

  addMsg("user", chat.message);
  addMsg("bot", chat.answer);
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

  const achievements = d.achievements || [];

  const dash = el("dashboardPage");
  if(!dash) return;

  dash.innerHTML = `
    <div class="premium-hero">
      <div>
        <p class="eyebrow">StudyCoach AI</p>
        <h1>Welcome back, ${escapeHtml(name)} 👋</h1>
        <p>Your personal AI tutor is ready for today's study.</p>
      </div>
      <button onclick="newChat()">Start studying</button>
    </div>

    <div class="level-card">
      <p class="eyebrow">Current Level</p>
      <h2>⭐ Level ${level}</h2>
      <p><b>${xp}</b> / ${nextLevelXp} XP to reach Level ${level + 1}</p>
      <div class="progress-track">
        <div class="progress-fill" style="width:${xpPercent}%"></div>
      </div>
    </div>

    <div class="pro-stats">
      <div class="pro-card"><span>🔥</span><b>${d.streak || 0}</b><p>Day streak</p></div>
      <div class="pro-card"><span>📚</span><b>${d.total || 0}</b><p>Study tasks</p></div>
      <div class="pro-card"><span>⏱️</span><b>${hours}h</b><p>Study time</p></div>
      <div class="pro-card"><span>🎯</span><b>${progress}%</b><p>Weekly goal</p></div>
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

      <div class="panel big-panel">
        <h3>📊 Analytics</h3>
        <div class="analytics-grid">
          <div class="analytics-card"><span>📚</span><h2>${analytics.studyTasks || 0}</h2><p>Total Study Tasks</p></div>
          <div class="analytics-card"><span>🧪</span><h2>${analytics.quizCount || 0}</h2><p>Quizzes Completed</p></div>
          <div class="analytics-card"><span>📄</span><h2>${analytics.homeworkAverage || 0}</h2><p>Homework Uploaded</p></div>
          <div class="analytics-card"><span>🃏</span><h2>${analytics.flashcardCount || 0}</h2><p>Flashcard Sessions</p></div>
        </div>
      </div>
<div class="chart-panel">
  <h3>📈 Weekly Study Activity</h3>
<div class="chart-panel">
  <h3>📚 Subject Breakdown</h3>

  <div class="subject-bars">
    ${Object.entries(analytics.subjectData || {}).length
      ? Object.entries(analytics.subjectData || {}).map(([subject, count]) => `
        <div class="subject-row">
          <div class="subject-top">
            <b>${escapeHtml(subject)}</b>
            <span>${count}</span>
          </div>
          <div class="subject-track">
            <div class="subject-fill" style="width:${Math.min(100, count * 15)}%"></div>
          </div>
        </div>
      `).join("")
      : "<p>No subject data yet.</p>"
    }
  </div>
</div>
  <div class="bar-chart">
    ${(analytics.weeklyStudy || [0,0,0,0,0,0,0]).map((v, i) => `
      <div class="bar-wrap">
        <div class="bar" style="height:${Math.max(8, v * 12)}px"></div>
        <span>${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</span>
      </div>
    `).join("")}
  </div>
</div>
      <div class="panel">
        <h3>🤖 AI Daily Coach</h3>
        <pre class="coach-text">${escapeHtml(dailyCoach)}</pre>
      </div>

      <div class="panel">
        <h3>🏆 Achievements</h3>
        <div class="badge-list">
          ${achievements.length
            ? achievements.slice(0, 6).map(a => `<span class="badge">${escapeHtml(a)}</span>`).join("")
            : "<p>No achievements unlocked yet.</p>"
          }
        </div>
      </div>

      <div class="panel">
        <h3>⚡ Quick Start</h3>
        <div class="quick">
          <button data-prompt="Explain fractions for my year level">Explain fractions</button>
          <button data-prompt="Quiz me on photosynthesis">Quiz photosynthesis</button>
          <button data-prompt="Help me write an essay introduction">Essay help</button>
          <button onclick="setPage('profile')">View AI profile</button>
        </div>
      </div>

    </div>
  `;

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

async function makeQuiz(){
  const d = await post("/api/quiz",{
    topic: value("quizTopic"),
    subject: value("subject")
  }, true);

  if(d.error){
    if(el("quizOut")) el("quizOut").textContent = d.error;
    return;
  }

  currentQuiz = d.quiz.questions || [];
  currentQuizIndex = 0;

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

  el("quizOut").innerHTML = `
    <div class="quiz-card">
      <p class="eyebrow">Question ${currentQuizIndex + 1} of ${currentQuiz.length}</p>
      <h2>${escapeHtml(q)}</h2>

      <textarea id="quizAnswer" placeholder="Type your answer here..."></textarea>

      <div class="quiz-actions">
        <button onclick="checkQuizAnswer()">Check answer</button>
        <button class="secondary" onclick="nextQuizQuestion()">Skip</button>
      </div>

      <div id="quizFeedback"></div>
    </div>
  `;
}

async function checkQuizAnswer(){
  const answer = value("quizAnswer");
  const q = currentQuiz[currentQuizIndex];

  if(!answer){
    el("quizFeedback").innerHTML = "<p>Please type an answer first.</p>";
    return;
  }

  el("quizFeedback").innerHTML = "<p>Checking answer...</p>";

  const d = await post("/api/check-quiz-answer", {
    question: q,
    answer,
    subject: value("subject"),
    yearLevel: value("appYear")
  }, true);

  if(d.error){
    el("quizFeedback").innerHTML = `<p>${escapeHtml(d.error)}</p>`;
    return;
  }

  el("quizFeedback").innerHTML = `
    <div class="feedback-good">
      ${escapeHtml(d.result)}
    </div>
  `;
}

  el("quizFeedback").innerHTML = `
    <div class="feedback-good">
      ✅ Nice effort. Compare your answer with the question and ask the AI if you want help improving it.
    </div>
  `;
}

function nextQuizQuestion(){
  currentQuizIndex++;

  if(currentQuizIndex >= currentQuiz.length){
    el("quizOut").innerHTML = `
      <div class="quiz-card">
        <h2>🎉 Quiz complete!</h2>
        <p>You worked through ${currentQuiz.length} questions.</p>
        <button onclick="makeQuiz()">Try again</button>
      </div>
    `;
    return;
  }

  showQuizQuestion();
}

 
async function makeFlash(){
  const d = await post("/api/flashcards", {
    topic: value("flashTopic"),
    subject: value("subject")
  }, true);

  if(d.error){
    if(el("flashOut")) el("flashOut").textContent = d.error;
    return;
  }

  if(el("flashOut")){
    el("flashOut").textContent = d.flashcards.cards
      .map(c => `${c.front}: ${c.back}`)
      .join("\n\n");
  }

  await loadDashboard();
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

async function post(url, body, needsAuth){
  try{
    const headers = { "Content-Type": "application/json" };
    if(needsAuth) headers.Authorization = "Bearer " + token;

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    return await r.json();
  }catch(e){
    return { error: "Network/server error: " + e.message };
  }
}

async function get(url){
  try{
    const r = await fetch(url, {
      headers: { Authorization: "Bearer " + token }
    });

    return await r.json();
  }catch(e){
    return { error: "Network/server error: " + e.message };
  }
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

  on("authBtn", authAction);
  on("switchAuth", toggleAuth);
  on("backHome", backHome);

  on("newChat", newChat);
  on("navDashboard", () => { setPage("dashboard"); loadDashboard(); });
  on("navChat", () => setPage("chat"));
  on("navUpload", () => setPage("upload"));
  on("navPlan", () => setPage("plan"));
  on("navTools", () => setPage("tools"));
  on("navProgress", loadProgress);
  on("navProfile", loadProfile);
  on("navParent", loadParent);
  on("navTeacher", () => setPage("teacher"));
  on("navPricing", () => setPage("pricing"));
  on("navDebug", () => setPage("debug"));

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
  on("loadTeacher", loadTeacher);
  on("stripeUpgrade", stripeUpgrade);
  on("runDebug", runDebug);

  key("message", e => {
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  wirePromptButtons();

  if(token) showApp();
});
