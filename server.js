require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { healthRouter } = require("./lib/health.js");
const { authRouter } = require("./lib/auth.js");
const { studyRouter } = require("./lib/study.js");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", studyRouter);
app.listen(PORT, () => {
  console.log(`StudyCoach AI running on port ${PORT}`);
});
