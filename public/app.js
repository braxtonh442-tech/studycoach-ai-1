let token = localStorage.getItem("studycoach_7_token") || "";
let mode = "signup";
let currentUser = null;
let currentConversationId = null;
let tourStep = 0;

const years = ["Year 1","Year 2","Year 3","Year 4","Year 5","Year 6","Year 7","Year 8","Year 9","Year 10","Year 11","Year 12","Year 13","University","Adult Learner"];
const tourSlides = [
  { title:"🤖 AI Tutor", text:"Ask questions and get step-by-step help." },
  { title:"📄 Homework Upload", text:"Upload homework and get helpful feedback." },
  { title:"🏆 XP & Rewards", text:"Earn XP, unlock achievements, keep streaks, and claim daily rewards." },
  { title:"🎉 You're ready!", text:"Start studying and build your learning profile." }
];

let currentQuiz = [];
let currentQuizIndex = 0;
let currentFlashcards = [];
let currentFlashcardIndex = 0;
let flashcardShowingBack = false;
let flashcardTouchStartX = 0;

function el(id){ return document.getElementById(id); }
function value(id){ return el(id) ? el(id).value.trim() : ""; }
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function fillYears(id){
  const node = el(id);
  if(!node) return;
  node.innerHTML = "";
  years.forEach(year => {
    const option = document.createElement("option");
    option.textContent = year;
    node.appendChild(option);
  });
  node.value = "Year 7";
}
function setPage(pageName){
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  el(pageName + "Page")?.classList.add("active");
  el("sideMenu")?.classList.remove("open");
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
  if(el("authTitle")) el("authTitle").textContent = "Log in";
  if(el("authBtn")) el("authBtn").textContent = "Log in";
  if(el("name")) el("name").style.display = "none";
  if(el("authMsg")) el("authMsg").textContent = "";
}
function backHome(){
  el("auth")?.classList.add("hidden");
  el("marketing")?.classList.remove("hidden");
}
function toggleAuth(){ mode === "signup" ? showLogin() : showSignup(); }

async function authAction(){
  const endpoint = mode === "signup" ? "/api/signup" : "/api/login";
  const body = mode === "signup"
    ? { name:value("name"), email:value("email"), password:value("password"), country:value("country"), yearLevel:value("yearLevel") }
    : { email:value("email"), password:value("password") };

  const d = await post(endpoint, body, false);
  if(d.error){
    if(el("authMsg")) el("authMsg").textContent = d.error;
    return;
  }
  if(mode === "signup" && typeof gtag === "function"){
    gtag("event","sign_up",{method:"email"});
  }
  token = d.token;
  currentUser = d.user;
  localStorage.setItem("studycoach_7_token", token);
  await showApp();
}

async function forgotPassword(){
  const email = value("email");
  if(!email){
    if(el("authMsg")) el("authMsg").textContent = "Type your email first.";
    return;
  }
  const d = await post("/api/forgot-password",{email},false);
  if(el("authMsg")) el("authMsg").textContent = d.message || d.error || "If that email exists, a reset link has been sent.";
}

async function showApp(){
  const loading = el("loadingScreen");
  const fill = el("loadingFill");
  try{
    loading?.classList.remove("hidden");
    if(fill) fill.style.width = "20%";
    el("marketing")?.classList.add("hidden");
    el("auth")?.classList.add("hidden");
    el("app")?.classList.remove("hidden");
    if(fill) fill.style.width = "50%";
    await loadMe();
    if(fill) fill.style.width = "70%";
    await loadHistory();
    await loadDashboard();
    if(!localStorage.getItem("studycoach_tour_done")){
      el("welcomeTour")?.classList.remove("hidden");
    }
    if(fill) fill.style.width = "100%";
  }finally{
    setTimeout(() => loading?.classList.add("hidden"), 250);
  }
}

function nextTourStep(){
  tourStep++;
  if(tourStep >= tourSlides.length){
    el("welcomeTour")?.classList.add("hidden");
    localStorage.setItem("studycoach_tour_done","yes");
    return;
  }
  const slide = tourSlides[tourStep];
  if(el("tourContent")){
    el("tourContent").innerHTML = `
      <h1>Welcome to StudyCoach AI</h1>
      <h2>${slide.title}</h2>
      <p>${slide.text}</p>
      <button id="tourNextBtn">${tourStep === tourSlides.length - 1 ? "Start studying" : "Next →"}</button>
    `;
    el("tourNextBtn").onclick = nextTourStep;
  }
}

async function loadMe(){
  if(!token) return;
  const d = await get("/api/me");
  if(!d.user) return;
  currentUser = d.user;
  if(el("hello")) el("hello").textContent = "Hi " + currentUser.name;
  if(el("appYear")) el("appYear").value = currentUser.yearLevel || "Year 7";
  if(el("planText")) el("planText").textContent = currentUser.plan === "premium" ? "Premium plan" : "Free plan";
}
function logout(){
  localStorage.removeItem("studycoach_7_token");
  location.reload();
}

async function newChat(){
  setPage("chat");
  const d = await post("/api/conversations",{subject:value("subject")},true);
  if(d.error) return alert(d.error);
  currentConversationId = d.conversation.id;
  if(el("messages")){
    el("messages").innerHTML = `
      <div class="empty">
        <h2>What do you need help with?</h2>
        <div class="suggestions">
          <button data-prompt="Explain fractions for my year level">Explain fractions</button>
          <button data-prompt="Quiz me on photosynthesis">Quiz photosynthesis</button>
          <button data-prompt="Help me write an essay introduction">Essay introduction</button>
        </div>
      </div>`;
  }
  wirePromptButtons();
  await loadHistory();
}
function promptSend(text){
  setPage("chat");
  if(el("message")) el("message").value = text;
  send();
}
async function send(){
  const message = value("message");
  if(!message) return;
  if(!currentConversationId){
    const created = await post("/api/conversations",{subject:value("subject")},true);
    if(created.error) return alert(created.error);
    currentConversationId = created.conversation.id;
  }
  if(el("message")) el("message").value = "";
  document.querySelector(".empty")?.remove();
  addMsg("user",message);
  const waitingId = addMsg("bot","StudyCoach AI is thinking...");
  const d = await post("/api/chat",{
    message,
    subject:value("subject"),
    yearLevel:value("appYear"),
    country:currentUser?.country || "New Zealand",
    conversationId:currentConversationId
  },true);
  const box = document.querySelector("#"+waitingId+" .text");
  if(box) box.textContent = d.answer || d.error || "No answer.";
  await loadHistory();
  await loadDashboard();
}
function addMsg(role,text){
  const id = "m"+Date.now()+Math.random().toString(16).slice(2);
  const div = document.createElement("div");
  div.id = id;
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.innerHTML = `<div class="inner"><div class="text">${escapeHtml(text)}</div></div>`;
  el("messages")?.appendChild(div);
  if(el("messages")) el("messages").scrollTop = el("messages").scrollHeight;
  return id;
}
async function loadHistory(){
  if(!token || !el("history")) return;
  const d = await get("/api/conversations");
  const conversations = d.conversations || [];
  if(!conversations.length){
    el("history").innerHTML = "<p>No chats yet.</p>";
    return;
  }
  el("history").innerHTML = conversations.map(c => `
    <div class="history-row">
      <button class="hist" onclick="openConversation('${c.id}')">${escapeHtml(c.title || "New chat")}</button>
      <button class="delete-chat" onclick="deleteConversation('${c.id}',event)">×</button>
    </div>`).join("");
}
async function openConversation(id){
  currentConversationId = id;
  setPage("chat");
  const d = await get("/api/conversations/"+id+"/messages");
  if(d.error) return alert(d.error);
  if(el("messages")) el("messages").innerHTML = "";
  (d.messages || []).forEach(m => addMsg(m.role === "assistant" ? "bot" : "user",m.content));
}
async function deleteConversation(id,event){
  event?.stopPropagation();
  if(!confirm("Delete this chat permanently?")) return;
  const d = await del("/api/conversations/"+id);
  if(d.error) return alert(d.error);
  if(currentConversationId === id){
    currentConversationId = null;
    if(el("messages")) el("messages").innerHTML = "<div class='empty'><h2>What do you need help with?</h2></div>";
  }
  await loadHistory();
}

async function loadDashboard(){
  if(!token) return;
  const progress = await get("/api/progress");
  const profile = await get("/api/profile");
  const analytics = progress.analytics || {};
  const xp = progress.xp || 0;
  const level = progress.level || 1;
  const nextLevelXp = level * 100;
  const xpPercent = Math.min(100,Math.round((xp / nextLevelXp)*100));
  const name = currentUser?.name || "student";
  if(!el("dashboardPage")) return;

  el("dashboardPage").innerHTML = `
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
        <p><b>${xp}</b> / ${nextLevelXp} XP</p>
        <div class="progress-track"><div class="progress-fill" style="width:${xpPercent}%"></div></div>
      </div>
      <div class="dash-mini-card"><h3>🔥 ${progress.streak || 0}</h3><p>Day streak</p></div>
      <div class="dash-mini-card"><h3>📚 ${progress.total || 0}</h3><p>Study tasks</p></div>
      <div class="dash-mini-card"><h3>🎯 ${progress.progressPercent || 0}%</h3><p>Weekly goal</p></div>
    </div>
    <div class="dashboard-grid">
      <div class="panel">
        <h3>Quick actions</h3>
        <div class="flash-actions">
          <button onclick="newChat()">AI Tutor</button>
          <button onclick="setPage('quiz')">Quiz</button>
          <button onclick="setPage('flashcards')">Flashcards</button>
          <button onclick="setPage('plan')">Study plan</button>
        </div>
      </div>
      <div class="panel">
        <h3>Analytics</h3>
        <div class="analytics-grid">
          <div><h2>${analytics.studyTasks || 0}</h2><p>Tasks</p></div>
          <div><h2>${analytics.quizCount || 0}</h2><p>Quizzes</p></div>
          <div><h2>${analytics.homeworkAverage || 0}</h2><p>Homework</p></div>
          <div><h2>${analytics.flashcardCount || 0}</h2><p>Flashcards</p></div>
        </div>
      </div>
      <div class="panel">
        <h3>AI Daily Coach</h3>
        <p>${escapeHtml(profile.dailyCoach || "Complete one study task today.")}</p>
      </div>
    </div>`;
}

async function makePlan(){
  const d = await post("/api/study-plan",{goal:value("planGoal"),subject:value("subject"),days:value("planDays")},true);
  if(d.error){
    if(el("planOut")) el("planOut").textContent = d.error;
    return;
  }
  if(el("planOut")){
    el("planOut").textContent = `Goal: ${d.plan.goal}\n\n` + d.plan.days.map(x => `Day ${x.day}: ${x.task} (${x.minutes} min)`).join("\n");
  }
  await loadDashboard();
}

async function makeQuiz(){
  const d = await post("/api/quiz",{topic:value("quizTopic"),subject:value("subject")},true);
  if(d.error){
    if(el("quizOut")) el("quizOut").textContent = d.error;
    return;
  }
  currentQuiz = d.quiz?.questions || [];
  currentQuizIndex = 0;
  showQuizQuestion();
  await loadDashboard();
}
function showQuizQuestion(){
  if(!el("quizOut")) return;
  if(!currentQuiz.length){
    el("quizOut").innerHTML = "<p>No quiz questions found.</p>";
    return;
  }
  const question = currentQuiz[currentQuizIndex];
  el("quizOut").innerHTML = `
    <div class="quiz-card">
      <p class="eyebrow">Question ${currentQuizIndex+1} of ${currentQuiz.length}</p>
      <h2>${escapeHtml(question)}</h2>
      <textarea id="quizAnswer" placeholder="Type your answer here..."></textarea>
      <div class="quiz-actions">
        <button onclick="checkQuizAnswer()">Check answer</button>
        <button class="secondary" onclick="nextQuizQuestion()">Skip</button>
      </div>
      <div id="quizFeedback"></div>
    </div>`;
}
async function checkQuizAnswer(){
  const answer = value("quizAnswer");
  const question = currentQuiz[currentQuizIndex];
  if(!answer){
    if(el("quizFeedback")) el("quizFeedback").innerHTML = "<p>Please type an answer first.</p>";
    return;
  }
  if(el("quizFeedback")) el("quizFeedback").innerHTML = "<p>Checking answer...</p>";
  const d = await post("/api/check-quiz-answer",{question,answer,subject:value("subject"),yearLevel:value("appYear")},true);
  if(el("quizFeedback")){
    el("quizFeedback").innerHTML = d.error
      ? `<p>${escapeHtml(d.error)}</p>`
      : `<div class="feedback-card">${escapeHtml(d.result)}</div>`;
  }
  await loadDashboard();
}
function nextQuizQuestion(){
  currentQuizIndex++;
  if(currentQuizIndex >= currentQuiz.length){
    el("quizOut").innerHTML = `
      <div class="quiz-card">
        <h2>🎉 Quiz complete!</h2>
        <p>You worked through ${currentQuiz.length} questions.</p>
        <button onclick="makeQuiz()">Try again</button>
      </div>`;
    return;
  }
  showQuizQuestion();
}

function normaliseFlashcards(data){
  const cards = data?.flashcards?.cards || data?.cards || data?.flashcards || [];
  if(!Array.isArray(cards)) return [];
  return cards.map(card => {
    if(typeof card === "string"){
      const parts = card.split(":");
      return {front:(parts.shift() || "Question").trim(),back:parts.join(":").trim() || "Answer"};
    }
    return {
      front:String(card?.front ?? card?.question ?? card?.term ?? "").trim(),
      back:String(card?.back ?? card?.answer ?? card?.definition ?? "").trim()
    };
  }).filter(card => card.front && card.back);
}
async function makeFlash(){
  const topic = value("flashTopic");
  if(!topic){
    el("flashOut")?.classList.remove("hidden");
    if(el("flashOut")) el("flashOut").textContent = "Please enter a flashcard topic first.";
    return;
  }
  el("flashLoading")?.classList.remove("hidden");
  el("flashcardStudyArea")?.classList.add("hidden");
  const d = await post("/api/flashcards",{topic,subject:value("subject"),yearLevel:value("appYear")},true);
  el("flashLoading")?.classList.add("hidden");
  if(d.error){
    el("flashOut")?.classList.remove("hidden");
    if(el("flashOut")) el("flashOut").textContent = d.error;
    return;
  }
  currentFlashcards = normaliseFlashcards(d);
  currentFlashcardIndex = 0;
  flashcardShowingBack = false;
  if(!currentFlashcards.length){
    el("flashOut")?.classList.remove("hidden");
    if(el("flashOut")) el("flashOut").textContent = "No usable flashcards were returned.";
    return;
  }
  el("flashOut")?.classList.add("hidden");
  el("flashcardStudyArea")?.classList.remove("hidden");
  renderFlashcard();
  await loadDashboard();
}
function renderFlashcard(){
  if(!currentFlashcards.length) return;
  const card = currentFlashcards[currentFlashcardIndex];
  if(el("flashFrontText")) el("flashFrontText").textContent = card.front;
  if(el("flashBackText")) el("flashBackText").textContent = card.back;
  if(el("flashCounter")) el("flashCounter").textContent = `Card ${currentFlashcardIndex+1} of ${currentFlashcards.length}`;
  if(el("flashProgressFill")) el("flashProgressFill").style.width = `${((currentFlashcardIndex+1)/currentFlashcards.length)*100}%`;
  if(el("previousFlashcard")) el("previousFlashcard").disabled = currentFlashcardIndex === 0;
  if(el("nextFlashcard")) el("nextFlashcard").textContent = currentFlashcardIndex === currentFlashcards.length-1 ? "Finish ✓" : "Next →";
  flashcardShowingBack = false;
  el("studyFlashcard")?.classList.remove("flipped");
  el("flashExplainOut")?.classList.add("hidden");
}
function flipCurrentFlashcard(){
  if(!currentFlashcards.length) return;
  flashcardShowingBack = !flashcardShowingBack;
  el("studyFlashcard")?.classList.toggle("flipped",flashcardShowingBack);
}
function nextFlashcard(){
  if(!currentFlashcards.length) return;
  if(currentFlashcardIndex < currentFlashcards.length-1){
    currentFlashcardIndex++;
    renderFlashcard();
  }else{
    showAchievement("🎉 Flashcard set complete!",`You studied ${currentFlashcards.length} flashcards.`);
    currentFlashcardIndex = 0;
    renderFlashcard();
  }
}
function previousFlashcard(){
  if(currentFlashcardIndex <= 0) return;
  currentFlashcardIndex--;
  renderFlashcard();
}
function shuffleFlashcards(){
  for(let i=currentFlashcards.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [currentFlashcards[i],currentFlashcards[j]] = [currentFlashcards[j],currentFlashcards[i]];
  }
  currentFlashcardIndex = 0;
  renderFlashcard();
}
function readCurrentFlashcard(){
  if(!currentFlashcards.length) return alert("Create some flashcards first.");
  if(!("speechSynthesis" in window)) return alert("Read aloud is not supported in this browser.");
  speechSynthesis.cancel();
  const card = currentFlashcards[currentFlashcardIndex];
  const speech = new SpeechSynthesisUtterance(flashcardShowingBack ? card.back : card.front);
  speech.lang = "en-NZ";
  speech.rate = .95;
  speechSynthesis.speak(speech);
}
async function explainCurrentFlashcard(){
  if(!currentFlashcards.length) return alert("Create some flashcards first.");
  const out = el("flashExplainOut");
  const card = currentFlashcards[currentFlashcardIndex];
  if(!out) return;
  out.classList.remove("hidden");
  out.innerHTML = "<p>StudyCoach AI is explaining this card...</p>";
  const d = await post("/api/chat",{
    message:`Explain this flashcard clearly for ${value("appYear")}.\nQuestion: ${card.front}\nAnswer: ${card.back}\nGive a short explanation and one example.`,
    subject:value("subject"),
    yearLevel:value("appYear"),
    country:currentUser?.country || "New Zealand",
    conversationId:currentConversationId
  },true);
  out.innerHTML = d.error
    ? `<p>${escapeHtml(d.error)}</p>`
    : `<div class="flashcard-explanation"><h3>AI Explanation</h3><p>${escapeHtml(d.answer || "No explanation returned.")}</p></div>`;
}
function handleFlashcardKeyboard(event){
  if(!el("flashcardsPage")?.classList.contains("active") || !currentFlashcards.length) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if(["input","textarea","select"].includes(tag)) return;
  if(event.key === "ArrowRight"){ event.preventDefault(); nextFlashcard(); }
  if(event.key === "ArrowLeft"){ event.preventDefault(); previousFlashcard(); }
  if(event.key === " " || event.key === "Enter"){ event.preventDefault(); flipCurrentFlashcard(); }
}
function handleFlashcardTouchStart(event){ flashcardTouchStartX = event.changedTouches?.[0]?.screenX || 0; }
function handleFlashcardTouchEnd(event){
  const endX = event.changedTouches?.[0]?.screenX || 0;
  const diff = endX - flashcardTouchStartX;
  if(Math.abs(diff) < 50) return;
  diff < 0 ? nextFlashcard() : previousFlashcard();
}

async function uploadHomework(){
  const file = el("homeworkFile")?.files?.[0];
  const out = el("uploadOut");
  if(!file){
    if(out) out.textContent = "Please choose a homework file first.";
    return;
  }
  if(out) out.textContent = "Uploading...";
  const form = new FormData();
  form.append("file",file);
  form.append("note",value("homeworkNote"));
  try{
    const response = await fetch("/api/upload-homework",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
    const d = await response.json();
    if(d.error){
      if(out) out.textContent = d.error;
      return;
    }
    if(out) out.innerHTML = `<div class="feedback-card"><h2>Homework Assessment</h2><pre>${escapeHtml(d.message || "")}</pre></div>`;
    await loadDashboard();
  }catch(err){
    if(out) out.textContent = "Upload failed: " + err.message;
  }
}
function startVoice(){
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition) return alert("Voice input is not supported in this browser. Try Chrome.");
  const recognition = new Recognition();
  recognition.lang = "en-NZ";
  recognition.onresult = event => {
    if(el("message")) el("message").value = event.results[0][0].transcript;
  };
  recognition.start();
}
async function loadProgress(){
  setPage("progress");
  const d = await get("/api/progress");
  if(el("progressOut")){
    el("progressOut").innerHTML = `
      <h1>Progress</h1>
      <p><b>Total study tasks:</b> ${d.total || 0}</p>
      <p><b>Study streak:</b> ${d.streak || 0} days</p>
      <h3>By subject</h3>
      <pre>${escapeHtml(JSON.stringify(d.bySubject || {},null,2))}</pre>`;
  }
}
async function loadProfile(){
  setPage("profile");
  const d = await get("/api/profile");
  if(d.error){
    if(el("profileOut")) el("profileOut").innerHTML = `<div class="panel">${escapeHtml(d.error)}</div>`;
    return;
  }
  const p = d.profile || {};
  if(el("profileOut")){
    el("profileOut").innerHTML = `
      <div class="panel">
        <p class="eyebrow">AI Student Memory</p>
        <h1>${escapeHtml(p.name || currentUser?.name || "Student")}</h1>
        <div class="profile-grid">
          <div><h3>Favourite subject</h3><p>${escapeHtml(p.favourite_subject || "Not learned yet")}</p></div>
          <div><h3>Weak topics</h3><p>${escapeHtml(p.weak_topics || "None yet")}</p></div>
          <div><h3>Learning style</h3><p>${escapeHtml(p.learning_style || "Still learning")}</p></div>
          <div><h3>Goals</h3><p>${escapeHtml(p.goals || "Build strong study habits")}</p></div>
        </div>
      </div>`;
  }
}
function isPremium(){ return currentUser?.plan === "premium"; }
function requirePremium(name){
  if(isPremium()) return true;
  alert(name + " is a Premium feature.");
  setPage("pricing");
  return false;
}
async function loadParent(){
  if(!requirePremium("Parent dashboard")) return;
  setPage("parent");
  const d = await get("/api/progress");
  if(el("parentOut")) el("parentOut").innerHTML = `<h1>Parent summary</h1><p>Total tasks: ${d.total || 0}</p><p>Study streak: ${d.streak || 0} days</p>`;
}
async function loadTeacher(){
  if(!requirePremium("Teacher dashboard")) return;
  const d = await get("/api/teacher-summary");
  if(el("teacherOut")) el("teacherOut").textContent = (d.students || []).map(s => `${s.name} — ${s.yearLevel} — ${s.tasks} tasks — ${s.streak} day streak — ${s.plan}`).join("\n") || "No students yet.";
}
async function startTrial(){
  const d = await post("/api/start-trial",{},true);
  if(d.error) return alert(d.error);
  if(typeof gtag === "function"){
    gtag("event","trial_started",{plan:"premium",trial_length_days:7,value:14.99,currency:"NZD"});
  }
  alert("Your 7-day Premium Trial has started!");
  const me = await get("/api/me");
  if(me.user) currentUser = me.user;
  await loadDashboard();
  setPage("pricing");
}
async function stripeUpgrade(){
  const d = await post("/api/create-checkout-session",{},true);
  if(d.url) location.href = d.url;
  else alert(d.error || "Stripe checkout failed.");
}
function showAchievement(title,message){
  document.querySelector(".achievement-pop")?.remove();
  const pop = document.createElement("div");
  pop.className = "achievement-pop";
  pop.innerHTML = `<div class="achievement-box"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(),3500);
}
function wirePromptButtons(){
  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.onclick = () => promptSend(button.getAttribute("data-prompt"));
  });
}

async function post(url,body,needsAuth){
  try{
    const headers = {"Content-Type":"application/json"};
    if(needsAuth) headers.Authorization = "Bearer " + token;
    const response = await fetch(url,{method:"POST",headers,body:JSON.stringify(body)});
    const text = await response.text();
    try{ return JSON.parse(text); }
    catch{ return {error:`Server returned ${response.status} instead of JSON.\n${text.slice(0,300)}`}; }
  }catch(err){
    return {error:"Network/server error: "+err.message};
  }
}
async function get(url){
  try{
    const response = await fetch(url,{headers:{Authorization:"Bearer "+token}});
    const text = await response.text();
    try{ return JSON.parse(text); }
    catch{ return {error:`Server returned ${response.status} instead of JSON.\n${text.slice(0,300)}`}; }
  }catch(err){
    return {error:"Network/server error: "+err.message};
  }
}
async function del(url){
  try{
    const response = await fetch(url,{method:"DELETE",headers:{Authorization:"Bearer "+token}});
    const text = await response.text();
    try{ return JSON.parse(text); }
    catch{ return {error:`Server returned ${response.status} instead of JSON.`}; }
  }catch(err){
    return {error:"Network/server error: "+err.message};
  }
}

document.addEventListener("DOMContentLoaded",() => {
  const on = (id,fn) => { if(el(id)) el(id).onclick = fn; };
  fillYears("yearLevel");
  fillYears("appYear");

  on("loginTop",showLogin);
  on("startTop",showSignup);
  on("startHero",showSignup);
  on("pricingBtn",() => el("pricing")?.scrollIntoView({behavior:"smooth"}));
  on("startFreePrice",showSignup);
  on("premiumPrice",showSignup);
  on("authBtn",authAction);
  on("forgotPasswordBtn",forgotPassword);
  on("switchAuth",toggleAuth);
  on("backHome",backHome);
  on("newChat",newChat);
  on("navDashboard",() => { setPage("dashboard"); loadDashboard(); });
  on("navChat",() => setPage("chat"));
  on("navUpload",() => setPage("upload"));
  on("navPlan",() => setPage("plan"));
  on("navQuiz",() => setPage("quiz"));
  on("navFlashcards",() => setPage("flashcards"));
  on("navProgress",loadProgress);
  on("navProfile",loadProfile);
  on("navParent",loadParent);
  on("navTeacher",() => setPage("teacher"));
  on("navPricing",() => setPage("pricing"));
  on("mobileMenuBtn",() => el("sideMenu")?.classList.toggle("open"));
  on("logoutBtn",logout);
  on("sendBtn",send);
  on("voiceBtn",startVoice);
  on("uploadBtn",uploadHomework);
  on("makePlan",makePlan);
  on("makeQuiz",makeQuiz);
  on("makeFlash",makeFlash);
  on("studyFlashcard",flipCurrentFlashcard);
  on("flipFlashcard",flipCurrentFlashcard);
  on("nextFlashcard",nextFlashcard);
  on("previousFlashcard",previousFlashcard);
  on("shuffleFlashcards",shuffleFlashcards);
  on("readFlashcard",readCurrentFlashcard);
  on("explainFlashcard",explainCurrentFlashcard);
  on("loadTeacher",loadTeacher);
  on("startTrialBtn",startTrial);
  on("stripeUpgrade",stripeUpgrade);
  on("tourNextBtn",nextTourStep);

  el("message")?.addEventListener("keydown",event => {
    if(event.key === "Enter" && !event.shiftKey){
      event.preventDefault();
      send();
    }
  });
  document.addEventListener("keydown",handleFlashcardKeyboard);
  el("studyFlashcard")?.addEventListener("touchstart",handleFlashcardTouchStart,{passive:true});
  el("studyFlashcard")?.addEventListener("touchend",handleFlashcardTouchEnd,{passive:true});
  wirePromptButtons();
  if(token) showApp();
});
