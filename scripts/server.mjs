import express from "express";
import serveStatic from "serve-static";
const app = express();

app.use("*.gz", (req, res, next) => {
  res.setHeader("Content-Encoding", "gzip");
  next();
});

app.use(serveStatic("public", { index: ["debug.html"] }));
app.use("/src", serveStatic("src"));
app.use("/dist", serveStatic("dist"));

app.listen(3000);
console.log("Listening \x1b[92mhttp://localhost:3000\x1b[0m");
