import js from "./index.mjs";

js.forEach((it) => {
  const script = document.createElement("script");
  script.setAttribute("src", it);
  document.head.appendChild(script);
});

function createElement(name, classes, text) {
  const element = document.createElement(name);
  classes.forEach((it) => element.classList.add(it));
  if (text) {
    element.innerText = text;
  }
  return element;
}

const container = document.getElementById("app");

function createRow(fs, f, name) {
  const directory = f.isDirectory();
  const row = createElement("span", ["row", "link"]);
  const icon = createElement("i", ["icon", directory ? "dir" : "file"]);
  const link = createElement("span", [], name);
  if (directory) {
    row.addEventListener("click", () => {
      showDir(fs, f);
    });
  } else {
    row.addEventListener("click", () => {
      const buf = fs.readFile(f);
      var blob = new Blob([buf]);
      var url = URL.createObjectURL(blob);
      const a = createElement("a", []);
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  row.appendChild(icon);
  row.appendChild(link);
  return row;
}

function showDir(fs, dir) {
  container.innerHTML = "";
  container.appendChild(createElement("div", ["row"], dir.getAbsolutePath()));

  const files = fs.listFiles(dir);
  if (dir.parent) {
    container.appendChild(createRow(fs, dir.parent, ".."));
  }
  files.forEach((f) => {
    f.parent = dir;
    container.appendChild(createRow(fs, f, f.getName()));
  });
}

async function onLoad() {
  const response = await fetch("freedos722.img");
  const buf = await response.arrayBuffer();
  const fs = LibMount.mount(buf);
  const root = fs.getRoot();
  showDir(fs, root);
}

addEventListener("load", onLoad);