const express = require("express");

const studyRouter = express.Router();

studyRouter.get("/study-test", (req, res) => {
  res.json({
    message: "Study router is working!"
  });
});

module.exports = {
  studyRouter
};
