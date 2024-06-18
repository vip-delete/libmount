import { mount } from "libmount"

const mountFile = "freedos722.img";

function createElement(name, classes, text) {
  const element = document.createElement(name);
  classes.forEach((it) => element.classList.add(it));
  if (text) {
    element.innerText = text;
  }
  return element;
}

const app = document.getElementById("app");

const status = createElement("div", ["row", "name"]);
status.innerText = mountFile;
app.appendChild(status);

const info = createElement("div", ["row"]);
info.innerText = "Loading...";
app.appendChild(info);

const path = createElement("div", ["row"]);
app.appendChild(path);

const header = createElement("div", ["row"]);
header.innerHTML =
  '<div class="row header"><span>&nbsp;</span><span>&nbsp;</span><span>Name</span><span>Size</span><span>Created</span><span>Modified</span><span>Accessed</span></div>';
app.appendChild(header);

const container = createElement("div", []);
app.appendChild(container);

function createRow(fs, f, name) {
  const directory = f.isDirectory();
  const up = name === "..";
  const icon = up ? "up" : directory ? "dir" : "file";

  const iconColumn = createElement("span", ["icon", icon]);
  const link = createElement("span", ["name"], name);
  let deleteColumn;
  if (up) {
    deleteColumn = createElement("span", ["icon"]);
  } else {
    deleteColumn = createElement("span", ["icon", "del"]);
    deleteColumn.title = "Delete";
    deleteColumn.addEventListener("click", () => {
      fs.deleteFile(f);
      info.innerText = JSON.stringify(fs.getVolumeInfo());
      showDir(fs, f.parent);
    });
  }
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

  const nameColumn = createElement("span", []);
  nameColumn.appendChild(link);

  const sizeColumn = createElement("span", []);
  sizeColumn.innerText = f.isDirectory() ? "" : f.getFileSize().toLocaleString("en");

  const createdColumn = createElement("span", []);
  createdColumn.innerText = f.getCreatedDate();

  const modifiedColumn = createElement("span", []);
  modifiedColumn.innerText = f.getModifiedDate();

  const accessedColumn = createElement("span", []);
  accessedColumn.innerText = f.getAccessedDate();

  const row = createElement("span", ["row"]);
  row.appendChild(deleteColumn);
  row.appendChild(iconColumn);
  row.appendChild(nameColumn);
  row.appendChild(sizeColumn);
  row.appendChild(createdColumn);
  row.appendChild(modifiedColumn);
  row.appendChild(accessedColumn);
  return row;
}

function cmp1(a, b) {
  const c1 = a.isDirectory() ? 0 : 1;
  const c2 = b.isDirectory() ? 0 : 1;
  return c1 - c2;
}

function cmp2(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

function sortByName(a, b) {
  let r = cmp1(a, b);
  if (r === 0) {
    r = cmp2(a.getName().toUpperCase(), b.getName().toUpperCase());
  }
  return r;
}

const sortFunction = sortByName;

function showDir(fs, dir) {
  container.innerHTML = "";
  path.innerText = dir.getAbsolutePath();

  const files = fs.listFiles(dir);
  files.sort(sortFunction);
  if (dir.parent) {
    container.appendChild(createRow(fs, dir.parent, ".."));
  }
  files.forEach((f) => {
    f.parent = dir;
    container.appendChild(createRow(fs, f, f.getName()));
  });
}

function download(buf, name) {
  const blob = new Blob([buf]);
  const url = URL.createObjectURL(blob);
  const a = createElement("a", []);
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function onLoad() {
  const response = await withTime("Fetch", () => fetch(mountFile));
  if (response.status !== 200) {
    document.title = response.status + " " + response.statusText;
    info.innerText = await response.text();
    return;
  }
  document.title = mountFile;
  const buf = await response.arrayBuffer();
  const fs = await withTime("Mount", () => mount(buf));
  if (!fs) {
    info.innerText = "Mount failed";
    return;
  }
  status.addEventListener("click", () => {
    download(buf, mountFile);
  });
  info.innerText = JSON.stringify(fs.getVolumeInfo());
  path.innerText = "/";
  const root = fs.getRoot();
  showDir(fs, root);
}

addEventListener("load", onLoad);

async function withTime(name, func) {
  const begin = performance.now();
  const ret = await func();
  const end = performance.now();
  console.log(name + ": " + (end - begin) + " ms");
  return ret;
}
