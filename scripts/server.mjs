import express from "express";
import Path from "path";
import { fileURLToPath } from "url";

const app = express();

/**
 * @param {string} rel
 * @returns {string}
 */
export const abs = (rel) => Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), "../" + rel);

app.use("/.gz$/", (req, res, next) => {
  res.setHeader("Content-Encoding", "gzip");
  next();
});

["src", "static", "images"].forEach((dir) => {
  app.use("/" + dir, express.static(abs(dir)));
});

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(abs("index.html"));
});

app.listen(3000);
console.log("Listening \x1b[92mhttp://localhost:3000\x1b[0m");
