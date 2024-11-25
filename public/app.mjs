import { mount } from "libmount";
import { koi8r as cp } from "libmount/codepages/koi8r";
const mountFile = "images/freedos722.IMG";

function formatDate(date) {
  if (date === null) {
    return "";
  }
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}`;
}

function formatDateTime(date) {
  if (date === null) {
    return "";
  }
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${formatDate(date)} ${hh}:${mm}:${ss}`;
}

function createElement(name, classes, text) {
  const element = document.createElement(name);
  classes.forEach((it) => element.classList.add(it));
  if (text) {
    element.innerText = text;
  }
  return element;
}

function getVolumeData(v) {
  return (
    "Label: " +
    v.getLabel() +
    ", OEMName: " +
    v.getOEMName() +
    ", SerialNumber: " +
    "0x" +
    v.getId().toString(16).toUpperCase() +
    ", SizeOfCluster: " +
    v.getSizeOfCluster() +
    ", CountOfClusters: " +
    v.getCountOfClusters() +
    ", FreeClusters: " +
    v.getFreeClusters()
  );
}

const app = document.getElementById("app");

const fileRow = createElement("div", ["row", "name"]);
const fileElem = createElement("span", []);
fileElem.innerText = mountFile;
fileRow.appendChild(fileElem);
app.appendChild(fileRow);

const nameRow = createElement("div", ["row", "fs-name"]);
app.appendChild(nameRow);

const info = createElement("div", ["row"]);
info.innerText = "Loading...";
app.appendChild(info);

const header = createElement("div", ["row"]);
header.innerHTML =
  '<div class="row header">' +
  "<span>&nbsp;</span>" +
  "<span>&nbsp;</span>" +
  "<span>Name</span>" +
  "<span>Short Name</span>" +
  "<span>Size</span>" +
  "<span>Size On Disk</span>" +
  "<span>Created</span>" +
  "<span>Modified</span>" +
  "<span>Accessed</span>" +
  "</div>";
app.appendChild(header);

const container = createElement("div", []);
app.appendChild(container);

function createRow(fs, f, name) {
  const directory = f.isDirectory();
  const up = name === ". .";
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
      f.delete();
      const v = fs.getVolume();
      info.innerText = getVolumeData(fs.getVolume());
      showDir(fs, f.parent);
    });
  }
  if (directory) {
    link.addEventListener("click", () => {
      showDir(fs, f);
    });
  } else {
    link.addEventListener("click", () => {
      const buf = f.getData();
      // if (buf) {
      download(buf, name);
      // }
    });
  }

  const nameColumn = createElement("span", []);
  nameColumn.appendChild(link);

  const shortNameColumn = createElement("span", []);
  shortNameColumn.innerText = f.getShortName() === name ? "" : f.getShortName();

  const sizeColumn = createElement("span", []);
  sizeColumn.innerText = f.length().toLocaleString();

  const sizeOnDiskColumn = createElement("span", []);
  sizeOnDiskColumn.innerText = f.getSizeOnDisk().toLocaleString();

  const createdColumn = createElement("span", []);
  createdColumn.innerText = formatDateTime(f.creationTime());

  const modifiedColumn = createElement("span", []);
  modifiedColumn.innerText = formatDateTime(f.lastModified());

  const accessedColumn = createElement("span", []);
  accessedColumn.innerText = formatDate(f.lastAccessTime());

  const row = createElement("span", ["row"]);
  row.appendChild(deleteColumn);
  row.appendChild(iconColumn);
  row.appendChild(nameColumn);
  row.appendChild(shortNameColumn);
  row.appendChild(sizeColumn);
  row.appendChild(sizeOnDiskColumn);
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
  if (!dir) {
    dir = fs.getRoot();
  }
  container.innerHTML = "";
  const files = dir.listFiles();
  files.sort(sortFunction);
  container.appendChild(createRow(fs, dir, dir.getAbsolutePath()));
  if (dir.parent) {
    container.appendChild(createRow(fs, dir.parent, ". ."));
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
  const response = await fetch(mountFile);
  if (response.status !== 200) {
    document.title = response.status + " " + response.statusText;
    info.style.color = "red";
    info.innerText = await response.text();
    return;
  }
  document.title = mountFile;
  const buf = await response.arrayBuffer();
  const rawImage = new Uint8Array(buf);
  const disk = mount(rawImage, { codepage: cp });
  let fs = disk.getFileSystem();
  if (!fs) {
    const partitions = disk.getPartitions();
    console.log(`Found ${partitions.length} partitions`);
    if (partitions.length > 0) {
      console.log(`Take 1st: type=${partitions[0].type}`);
      const partition = mount(rawImage, { codepage: cp, partition: partitions[0] });
      fs = partition.getFileSystem();
    }
    if (!fs) {
      info.innerText = "Mount failed";
      return;
    }
  }
  fileElem.addEventListener("click", () => {
    download(buf, mountFile);
  });
  nameRow.innerText = fs.getName();
  info.innerText = getVolumeData(fs.getVolume());
  const root = fs.getRoot();
  showDir(fs, root);
}

addEventListener("load", onLoad);
