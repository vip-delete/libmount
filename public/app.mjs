import { mount } from "libmount";
import { CP1251 as CP } from "./iconv-tiny.bundle.mjs";

addEventListener("load", onLoad);

async function onLoad() {
  await onMount("images/freedos722.img");
}

/**
 * @param {string} imgFile
 */
async function onMount(imgFile) {
  document.title = imgFile;

  const app = $Id("app");
  const status = $("div").cls("row").el;
  app.appendChild(status);
  let img;
  try {
    img = await fetchWithProgress(imgFile, (loaded, total) => {
      status.innerText = `${imgFile} - loaded ${Math.round(loaded / 1024)} KB` + (total === 0 ? "" : ` (${Math.round((loaded * 100) / total)}%)`);
    });
  } catch (e) {
    status.classList.add("error");
    status.innerText = /** @type {Error} */ (e).message;
    return;
  }
  app.removeChild(status);

  app.appendChild(
    $("div")
      .cls("row file")
      .children([
        $("div")
          .text(imgFile)
          .on("click", () => download(img, imgFile)),
        $("div").html(`&nbsp;- ${img.length / 1024} KB`),
      ]).el,
  );

  const encoding = CP.create();
  const disk = mount(img, { encoding });
  let fs = disk.getFileSystem();
  if (!fs) {
    const partitions = disk.getPartitions();
    if (partitions.length > 0) {
      const partition = mount(img, { encoding, partition: partitions[0] });
      fs = partition.getFileSystem();
    }
    if (!fs) {
      app.appendChild($("div").cls("error").text("Mount failed").el);
      return;
    }
  }

  const tmp = fs.getRoot().makeFile("еПривет.TXT");
  tmp?.setData(encoding.encode("еПривет".repeat(1000)));

  const info = $("div").cls("row info").el;
  app.appendChild(info);
  app.appendChild(
    $("div")
      .cls(["row", "header"])
      .children([
        $("span").html("&nbsp;"),
        $("span").html("&nbsp;"),
        $("span").text("Name"),
        $("span").text("Short Name"),
        $("span").text("Size"),
        $("span").text("Size On Disk"),
        $("span").text("Created"),
        $("span").text("Modified"),
        $("span").text("Accessed"),
      ]).el,
  );

  const panel = $("div").el;
  app.appendChild(panel);

  showDir(info, panel, fs, null);
}

/**
 * @param {HTMLElement} info
 * @param {HTMLElement} root
 * @param {import("libmount").FileSystem} fs
 * @param {Ctx|null} ctx
 */
function showDir(info, root, fs, ctx) {
  ctx ||= { f: fs.getRoot(), parent: null };
  const files = ctx.f.listFiles() || [];
  files.sort((a, b) => {
    const c1 = a.isDirectory() ? 0 : 1;
    const c2 = b.isDirectory() ? 0 : 1;
    let r = c1 - c2;
    if (r === 0) {
      const d1 = a.getName().toUpperCase();
      const d2 = b.getName().toUpperCase();
      r = d1 === d2 ? 0 : d1 < d2 ? -1 : 1;
    }
    return r;
  });
  const list = [];
  const showParent = () => showDir(info, root, fs, ctx.parent);
  list.push(createRow(ctx.f, ctx.f.getAbsolutePath(), showParent, null));
  if (ctx.parent) {
    list.push(createRow(ctx.parent.f, ". .", null, showParent));
  }
  files.forEach((f) => {
    const onDeleteCtx = ctx;
    const onClickCtx = { f, parent: ctx };
    list.push(
      createRow(
        f,
        f.getName(),
        () => showDir(info, root, fs, onDeleteCtx),
        () => showDir(info, root, fs, onClickCtx),
      ),
    );
  });
  root.innerHTML = "";
  for (const el of list) {
    root.appendChild(el);
  }

  const v = fs.getVolume();
  const str = `Label: ${v.getLabel()}, OEMName: ${v.getOEMName()}, SerialNumber: 0x${v.getId().toString(16).toUpperCase()}, SizeOfCluster: ${v.getSizeOfCluster()}, CountOfClusters: ${v.getCountOfClusters()}, FreeClusters: ${v.getFreeClusters()}`;
  info.innerText = str.replaceAll("\n", " ");
}

/**
 * @param {import("libmount").File} f
 * @param {string} name
 * @param {?function():void} onDelete
 * @param {?function():void} onClick
 * @returns {HTMLElement}
 */
function createRow(f, name, onDelete, onClick) {
  return $("span")
    .cls("row")
    .children([
      name === ". ."
        ? $("span")
        : $("span")
            .cls("action icon-delete")
            .attrs({ title: "Delete" })
            .on("click", () => {
              f.delete();
              onDelete?.();
            }),
      name === ". ." ? $("span").cls("action icon-up") : $("span").cls("action").cls(f.isDirectory() ? "icon-dir" : "icon-file"),
      $("span").children([
        name.startsWith("/")
          ? $("span").text(name)
          : $("span")
              .text(name)
              .cls("name")
              .on("click", () => (f.isDirectory() ? onClick?.() : download(f.getData(), name))),
      ]),
      $("span").text(f.getShortName() === name ? "" : f.getShortName()),
      $("span").text(f.length().toLocaleString()),
      $("span").text(f.getSizeOnDisk().toLocaleString()),
      $("span").text(formatDateTime(f.creationTime())),
      $("span").text(formatDateTime(f.lastModified())),
      $("span").text(formatDate(f.lastAccessTime())),
    ]).el;
}

// Support

/**
 * @param {string} url
 * @param {function(number,number):void} onProgress
 * @returns {Promise<Uint8Array>}
 */
async function fetchWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const body = response.body;
  if (!body) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const total = Number(response.headers.get("Content-Length"));
  const reader = body.getReader();
  let loaded = 0;
  const chunks = [];
  let chunk;

  while (!(chunk = await reader.read()).done) {
    loaded += chunk.value.length;
    chunks.push(chunk.value);
    onProgress?.(loaded, total);
  }

  const result = new Uint8Array(loaded);
  chunks.reduce((pos, chunk) => (result.set(chunk, pos), pos + chunk.length), 0);
  return result;
}

/**
 * @param {?Uint8Array} data
 * @param {string} name
 */
function download(data, name) {
  if (data) {
    const url = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
    $("a").attrs({ "href": url, "download": name }).el.click();
    URL.revokeObjectURL(url);
  }
}

// EL*

/**
 * @param {string} name
 * @returns {El}
 */
function $(name) {
  return new El(name);
}

/**
 * @param {string} name
 * @returns {HTMLElement}
 */
function $Id(name) {
  const el = document.getElementById(name);
  if (el === null) {
    throw new Error();
  }
  return el;
}

class El {
  /**
   *
   * @param {string} name
   */
  constructor(name) {
    this.el = document.createElement(name);
  }

  /**
   * @param {!{[key:string]:any}} attrs
   * @returns {El}
   */
  attrs(attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      this.el.setAttribute(key, value);
    }
    return this;
  }

  /**
   * @param {string} event
   * @param {EventListener} listener
   * @returns {El}
   */
  on(event, listener) {
    this.el.addEventListener(event, listener);
    return this;
  }

  /**
   * @param {!Array<string>|string} cls
   * @returns {El}
   */
  cls(cls) {
    if (Array.isArray(cls)) {
      for (const cl of cls) {
        this.el.classList.add(cl);
      }
    } else {
      for (const cl of cls.split(" ")) {
        this.el.classList.add(cl);
      }
    }
    return this;
  }

  /**
   * @param {!Array<HTMLElement|El>} children
   * @returns {El}
   */
  children(children) {
    for (const child of children) {
      this.el.appendChild(child instanceof El ? child.el : child);
    }
    return this;
  }

  /**
   * @param {string} text
   * @returns {El}
   */
  text(text) {
    this.el.innerText = text;
    return this;
  }

  /**
   * @param {string} html
   * @returns {El}
   */
  html(html) {
    this.el.innerHTML = html;
    return this;
  }
}

/**
 * @param {?Date} date
 * @returns {string}
 */
function formatDate(date) {
  if (date === null) {
    return "";
  }
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}`;
}

/**
 * @param {?Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  if (date === null) {
    return "";
  }
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${formatDate(date)} ${hh}:${mm}:${ss}`;
}

/**
 * @typedef {{
 *            f:import("libmount").File,
 *            parent:Ctx | null,
 *          }} Ctx
 */
