// backend/index.js (or app.js)
import express from "express";
const app = express();

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from backend!" });
});

app.listen(3001, () => {
  console.log("Backend running on port 3001");
});
