import express from "express";
import serveStatic from "serve-static";
const app = express();

app.use(serveStatic("public", { index: ["debug.html"] }));
app.use(serveStatic("src"));
app.use(serveStatic("dist"));

app.listen(3000);
console.log("Listening \x1b[92mhttp://localhost:3000\x1b[0m");
