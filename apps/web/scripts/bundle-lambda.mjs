import * as esbuild from 'esbuild';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const buildDir = join(rootDir, 'build');
const serverDir = join(buildDir, 'server');

// Rename the original server build
const originalBuild = join(serverDir, 'index.js');
const renamedBuild = join(serverDir, 'react-router-build.js');

// Read original build and save as react-router-build.js
import { readFileSync } from 'fs';
const originalContent = readFileSync(originalBuild, 'utf-8');

// Comprehensive browser stubs for SSR - handles Solid.js/TonConnect requirements
const browserStubs = `
// Browser API stubs for SSR/Lambda runtime
if (typeof globalThis.window === 'undefined') {
  // Storage mock
  const storage = {};
  const storageMock = {
    getItem: (k) => storage[k] ?? null,
    setItem: (k, v) => { storage[k] = v },
    removeItem: (k) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: (i) => Object.keys(storage)[i] ?? null,
    get length() { return Object.keys(storage).length },
  };

  // Text node mock with mutable data property (required by Solid.js)
  const createTextNode = (text) => {
    const node = { nodeType: 3, nodeName: '#text', data: text || '', textContent: text || '' };
    return node;
  };

  // Element factory - returns elements with proper child handling for Solid.js and goober CSS-in-JS
  const createElement = (tag) => {
    const children = [];
    // For style elements, pre-create a text node child (required by goober CSS-in-JS)
    const isStyleElement = tag && tag.toLowerCase() === 'style';
    const textChild = isStyleElement ? { nodeType: 3, nodeName: '#text', data: '', textContent: '' } : null;
    if (textChild) children.push(textChild);

    const el = {
      nodeType: 1,
      nodeName: (tag || 'DIV').toUpperCase(),
      tagName: (tag || 'DIV').toUpperCase(),
      style: {},
      className: '',
      id: '',
      innerHTML: '',
      textContent: '',
      dataset: {},
      classList: { add(){}, remove(){}, toggle(){}, contains(){ return false }, item(){ return null } },
      setAttribute(){},
      getAttribute(){ return null },
      hasAttribute(){ return false },
      removeAttribute(){},
      appendChild(child) { children.push(child); return child; },
      removeChild(child) { const i = children.indexOf(child); if(i >= 0) children.splice(i, 1); return child; },
      insertBefore(newNode, refNode) { const i = children.indexOf(refNode); children.splice(i >= 0 ? i : children.length, 0, newNode); return newNode; },
      replaceChild(newChild, oldChild) { const i = children.indexOf(oldChild); if(i >= 0) children[i] = newChild; return oldChild; },
      cloneNode(deep) { return createElement(tag); },
      get children() { return children.filter(c => c.nodeType === 1); },
      get childNodes() { return children; },
      get firstChild() { return children[0] || null; },
      get lastChild() { return children[children.length - 1] || null; },
      get nextSibling() { return null; },
      get previousSibling() { return null; },
      get parentNode() { return null; },
      get parentElement() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementsByTagName() { return []; },
      getElementsByClassName() { return []; },
      matches() { return false; },
      closest() { return null; },
      contains() { return false; },
      addEventListener(){},
      removeEventListener(){},
      dispatchEvent() { return true; },
      getBoundingClientRect() { return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }; },
      getClientRects() { return []; },
      scrollTo(){},
      scrollIntoView(){},
      focus(){},
      blur(){},
      click(){},
      offsetWidth: 0, offsetHeight: 0, offsetTop: 0, offsetLeft: 0,
      scrollWidth: 0, scrollHeight: 0, scrollTop: 0, scrollLeft: 0,
      clientWidth: 0, clientHeight: 0,
    };
    return el;
  };

  // Document mock
  const documentMock = {
    createElement,
    createTextNode,
    createComment: (text) => ({ nodeType: 8, nodeName: '#comment', data: text || '' }),
    createDocumentFragment: () => {
      const children = [];
      return {
        nodeType: 11,
        appendChild(child) { children.push(child); return child; },
        get childNodes() { return children; },
        get firstChild() { return children[0] || null; },
      };
    },
    createEvent: (type) => ({ type, initEvent(){}, preventDefault(){}, stopPropagation(){} }),
    createRange: () => ({
      selectNodeContents(){}, collapse(){},
      getClientRects(){ return []; },
      getBoundingClientRect(){ return {}; }
    }),
    head: createElement('head'),
    body: createElement('body'),
    documentElement: createElement('html'),
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    getElementsByTagName() { return []; },
    getElementsByClassName() { return []; },
    addEventListener(){},
    removeEventListener(){},
    cookie: '',
    readyState: 'complete',
    activeElement: null,
    defaultView: null,
  };

  // Window mock
  globalThis.window = {
    Telegram: {
      WebApp: {
        initData: '', initDataUnsafe: {}, ready(){}, expand(){}, close(){},
        themeParams: {}, colorScheme: 'light',
        MainButton: { show(){}, hide(){}, onClick(){}, offClick(){}, showProgress(){}, hideProgress(){}, enable(){}, disable(){}, text: '' },
        BackButton: { show(){}, hide(){}, onClick(){}, offClick(){} },
        HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
      }
    },
    addEventListener(){},
    removeEventListener(){},
    dispatchEvent() { return true; },
    location: { href: '', search: '', hash: '', origin: '', pathname: '/', hostname: '' },
    navigator: { userAgent: '', language: 'en' },
    localStorage: storageMock,
    sessionStorage: storageMock,
    document: documentMock,
    matchMedia: () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    innerWidth: 375,
    innerHeight: 667,
    scrollTo(){},
    history: { pushState(){}, replaceState(){}, back(){}, forward(){} },
    open() { return null; },
  };

  globalThis.document = documentMock;
  globalThis.localStorage = storageMock;
  globalThis.sessionStorage = storageMock;

  // DOM classes for instanceof checks
  globalThis.Node = class Node {};
  globalThis.Element = class Element extends globalThis.Node {};
  globalThis.HTMLElement = class HTMLElement extends globalThis.Element {};
  globalThis.Text = class Text extends globalThis.Node { constructor(t) { super(); this.data = t || ''; } };
  globalThis.Comment = class Comment extends globalThis.Node { constructor(t) { super(); this.data = t || ''; } };
  globalThis.DocumentFragment = class DocumentFragment extends globalThis.Node {};
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
  globalThis.CustomEvent = class CustomEvent extends globalThis.Event { constructor(type, opts) { super(type); this.detail = opts?.detail; } };
  globalThis.MutationObserver = class MutationObserver { observe(){} disconnect(){} };
  globalThis.ResizeObserver = class ResizeObserver { observe(){} disconnect(){} };
  globalThis.IntersectionObserver = class IntersectionObserver { observe(){} disconnect(){} };
  globalThis.customElements = { define(){}, get(){ return undefined; }, upgrade(){}, whenDefined(){ return Promise.resolve(); } };
}
`;

writeFileSync(renamedBuild, browserStubs + originalContent);

// Create Lambda handler that imports from react-router-build
const handlerCode = `
import { createRequestHandler } from "react-router";
import * as serverBuild from "./react-router-build.js";

const requestHandler = createRequestHandler(serverBuild, process.env.NODE_ENV);

function convertLambdaEventToRequest(event) {
  const host = event.headers?.host || event.requestContext?.domainName || "localhost";
  const protocol = event.headers?.["x-forwarded-proto"] || "https";
  const url = new URL(
    event.rawPath + (event.rawQueryString ? "?" + event.rawQueryString : ""),
    protocol + "://" + host
  );

  const headers = new Headers();
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value) headers.set(key, value);
    }
  }
  if (event.cookies) headers.set("cookie", event.cookies.join("; "));

  const method = event.requestContext?.http?.method || "GET";
  let body = null;
  if (event.body) {
    body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
  }

  return new Request(url.toString(), {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? body : null,
  });
}

async function convertResponseToLambdaResult(response) {
  const headers = {};
  const cookies = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") cookies.push(value);
    else headers[key] = value;
  });

  const contentType = response.headers.get("content-type") || "";
  const isBase64 = contentType.includes("image/") || contentType.includes("font/") ||
    contentType.includes("application/octet-stream") || contentType.includes("application/wasm");

  let body;
  if (isBase64) {
    const buffer = await response.arrayBuffer();
    body = Buffer.from(buffer).toString("base64");
  } else {
    body = await response.text();
  }

  return {
    statusCode: response.status,
    headers,
    cookies: cookies.length > 0 ? cookies : undefined,
    body,
    isBase64Encoded: isBase64,
  };
}

export async function handler(event, context) {
  try {
    const request = convertLambdaEventToRequest(event);
    const response = await requestHandler(request);
    return convertResponseToLambdaResult(response);
  } catch (error) {
    console.error("Lambda handler error:", error);
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain" },
      body: "Internal Server Error",
    };
  }
}

// Re-export everything from the server build for compatibility
export * from "./react-router-build.js";
`;

// Bundle the handler with react-router
await esbuild.build({
  stdin: {
    contents: handlerCode,
    resolveDir: serverDir,
    loader: 'js',
  },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: join(serverDir, 'index.js'),
  external: [],
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});

// Write package.json for ESM
writeFileSync(join(buildDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));

console.log('Lambda bundle created successfully!');
