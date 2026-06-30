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
        <h2>What do you need help with?</h2>
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
  const wait = addMsg("bot", "Thinking...");

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
      <div class="avatar">${role === "user" ? "U" : "S"}</div>
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

  const hours = Math.round((d.estimatedStudyMinutes || 0) / 60);
  const progress = d.progressPercent || 0;
  const badges = d.badges || [];

  const stats = document.querySelector("#dashboardPage .stats");
  if(stats){
    stats.innerHTML = `
      <div class="stat"><b>${d.streak || 0}</b><span>🔥 Day streak</span></div>
      <div class="stat"><b>${d.total || 0}</b><span>📚 Questions</span></div>
      <div class="stat"><b>${hours}h</b><span>⏱ Study time</span></div>
      <div class="stat"><b>${badges.length}</b><span>🏆 Badges</span></div>
    `;
  }

  const dash = el("dashboardPage");
  if(dash && !el("proDashboard")){
    dash.insertAdjacentHTML("beforeend", `
      <div id="proDashboard" class="panel">
        <h3>Progress overview</h3>
        <p><b>Favourite subject:</b> ${escapeHtml(d.favouriteSubject || "None")}</p>
        <p><b>Focus area:</b> ${escapeHtml((d.weakAreas || [])[0] || "None")}</p>

        <div style="background:#e5e7eb;border-radius:999px;overflow:hidden;height:18px;margin:14px 0;">
          <div style="width:${progress}%;height:18px;background:#111827;"></div>
        </div>

        <p><b>${progress}%</b> weekly progress</p>

        <h3>Badges</h3>
        <p>${badges.length ? badges.map(b => "🏅 " + escapeHtml(b)).join("<br>") : "No badges yet."}</p>
      </div>
    `);
  }
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

async function makeQuiz(){

  const d = await post("/api/quiz",{
    topic: value("quizTopic"),
    subject: value("subject")
  }, true);

  if(d.error){
    if(el("quizOut")) el("quizOut").textContent = d.error;
    return;
  }

  if(el("quizOut")){
    el("quizOut").innerHTML = `
      <h3>🧠 ${escapeHtml(d.quiz.topic)}</h3>
      <ol>
        ${d.quiz.questions.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
      </ol>
    `;
  }

  await loadDashboard();
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

  const token = localStorage.getItem("token");

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

  out.textContent = d.message || "Homework uploaded successfully!";
}
  const fd = new FormData();
  fd.append("homework", f);
  fd.append("note", value("homeworkNote"));

  const r = await fetch("/api/upload-homework", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd
  });

  const d = await r.json();
  if(el("uploadOut")) el("uploadOut").textContent = d.message || d.error || "Uploaded.";
  await loadDashboard();
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
