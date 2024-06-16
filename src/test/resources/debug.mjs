import js from "./index.mjs";

const mountFile = "freedos722.img";

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

const app = document.getElementById("app");
const container = createElement("div", []);
app.appendChild(container);

function createRow(fs, f, name) {
  const directory = f.isDirectory();
  const row = createElement("span", ["row", "link"]);
  const del = createElement("i", ["icon", "del"]);
  del.title = "Delete";
  const icon = createElement("i", ["icon", directory ? "dir" : "file"]);
  const link = createElement("span", ["name"], name);
  del.addEventListener("click", () => {
    fs.deleteFile(f);
    showDir(fs, f.parent);
  });
  if (directory) {
    link.addEventListener("click", () => {
      showDir(fs, f);
    });
  } else {
    link.addEventListener("click", () => {
      const buf = fs.readFile(f);
      if (buf) {
        download(buf, name);
      }
    });
  }
  row.appendChild(del);
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

function download(buf, name) {
  var blob = new Blob([buf]);
  var url = URL.createObjectURL(blob);
  const a = createElement("a", []);
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function onLoad() {
  const response = await fetch(mountFile);
  const buf = await response.arrayBuffer();

  const status = createElement("div", ["row", "name"]);
  status.addEventListener("click", () => {
    download(buf, mountFile);
  });
  app.insertBefore(status, container);
  status.innerHTML = mountFile;

  const fs = LibMount.mount(buf);
  const root = fs.getRoot();
  showDir(fs, root);
}

addEventListener("load", onLoad);
