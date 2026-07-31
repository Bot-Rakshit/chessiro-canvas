// Regression test: viewport movement updates imperative geometry without
// committing the board again when its rendered size is unchanged.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let boardTop = 120;
const boardLeft = 40;
const boardSize = 800;

Object.defineProperties(dom.window.HTMLElement.prototype, {
  offsetWidth: { configurable: true, get: () => boardSize },
  offsetHeight: { configurable: true, get: () => boardSize },
  getBoundingClientRect: {
    configurable: true,
    value() {
      return {
        x: boardLeft,
        y: boardTop,
        left: boardLeft,
        top: boardTop,
        right: boardLeft + boardSize,
        bottom: boardTop + boardSize,
        width: boardSize,
        height: boardSize,
        toJSON: () => ({}),
      };
    },
  },
});

const define = (name, value) => {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
};
define('window', dom.window);
define('document', dom.window.document);
define('navigator', dom.window.navigator);
define('HTMLElement', dom.window.HTMLElement);
define('Element', dom.window.Element);
define('Node', dom.window.Node);
define('DOMRect', dom.window.DOMRect);
define('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
define('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
define('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
define('ResizeObserver', ResizeObserverStub);
define('MutationObserver', dom.window.MutationObserver);
define('Image', dom.window.Image);
dom.window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  onchange: null,
  dispatchEvent() { return false; },
});
define('matchMedia', dom.window.matchMedia);

const React = (await import('react')).default;
const { Profiler } = React;
const { createRoot } = await import('react-dom/client');
const { ChessiroCanvas } = await import('../dist/index.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const container = document.getElementById('root');
const root = createRoot(container);
const ref = React.createRef();
let commits = 0;

root.render(
  React.createElement(
    Profiler,
    { id: 'board', onRender: () => { commits += 1; } },
    React.createElement(ChessiroCanvas, { ref, interactive: false }),
  ),
);
await sleep(80);

const commitsBeforeScroll = commits;
const scrollEvents = 20;
for (let i = 0; i < scrollEvents; i += 1) {
  boardTop = 120 - (i + 1) * 3;
  window.dispatchEvent(new window.Event('scroll'));
}
await sleep(50);

const scrollCommits = commits - commitsBeforeScroll;
const squareRect = ref.current?.getSquareRect('a8');
const geometryIsFresh =
  squareRect?.left === boardLeft &&
  squareRect?.top === boardTop &&
  squareRect?.width === boardSize / 8 &&
  squareRect?.height === boardSize / 8;

if (scrollCommits !== 0 || !geometryIsFresh) {
  console.error(JSON.stringify({
    scrollEvents,
    scrollCommits,
    expectedTop: boardTop,
    squareRect,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    scrollEvents,
    extraReactCommits: scrollCommits,
    squareRect: {
      left: squareRect.left,
      top: squareRect.top,
      width: squareRect.width,
      height: squareRect.height,
    },
  }, null, 2));
}

root.unmount();
