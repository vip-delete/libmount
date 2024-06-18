import express from "express";
import serveStatic from "serve-static";
const app = express();

app.use(serveStatic("src/test/resources/", { index: ["debug.html"] }));
app.use(serveStatic("src/main/javascript/libmount/"));
app.use(serveStatic("dist/"));

app.listen(3000);
console.log("Listening \x1b[32mhttp://localhost:3000\x1b[0m");
