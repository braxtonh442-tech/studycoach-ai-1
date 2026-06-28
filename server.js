require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { healthRouter } = require("./lib/health");
const { authRouter } = require("./lib/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

app.use("/api", healthRouter);
app.use("/api", authRouter);

app.listen(PORT, () => {
  console.log(`StudyCoach AI running on port ${PORT}`);
});
