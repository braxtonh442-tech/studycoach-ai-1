const msg = document.getElementById("resetMsg");
const btn = document.getElementById("resetBtn");
const password = document.getElementById("newPassword");

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

btn.onclick = async () => {
  if(!password.value || password.value.length < 6){
    msg.textContent = "Password must be at least 6 characters.";
    return;
  }

  const r = await fetch("/api/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token,
      password: password.value
    })
  });

  const d = await r.json();

  msg.textContent = d.message || d.error || "Done.";

  if(d.success){
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  }
};
