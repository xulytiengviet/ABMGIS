import { ABMWorld, createModelApi } from "./engine.js";

let world = null;
let api = null;
let program = null;
let paramsRef = { current: {} };
let timer = null;
let stepsPerSecond = 12;

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function buildProgram(code) {
  const factory = new Function("vfm", `
    "use strict";
    ${code}
    return {
      setup: typeof setup === "function" ? setup : null,
      go: typeof go === "function" ? go : null
    };
  `);
  return factory(api);
}

function postState(extra = {}) {
  if (!world) return;
  postMessage({ type: "state", state: world.snapshot(), ...extra });
}

function callSetup() {
  if (!program?.setup) throw new Error("Model chưa khai báo haml_sob setup().");
  world.resume();
  program.setup();
  postState();
}

function callGo() {
  if (!program?.go) throw new Error("Model chưa khai báo haml_sob go().");
  if (world.stopped) return false;
  program.go();
  postState();
  if (world.stopped) stopTimer();
  return !world.stopped;
}

function runLoop() {
  stopTimer();
  const hz = Math.max(1, Math.min(240, Number(stepsPerSecond) || 12));
  const interval = hz <= 50 ? Math.max(4, Math.round(1000 / hz)) : 20;
  const steps = hz <= 50 ? 1 : Math.max(1, Math.round(hz / 50));
  timer = setInterval(() => {
    try {
      for (let i = 0; i < steps; i++) {
        if (!callGo()) break;
      }
    } catch (error) {
      stopTimer();
      postMessage({ type: "error", message: error?.stack || error?.message || String(error) });
    }
  }, interval);
}

self.onmessage = event => {
  const msg = event.data || {};
  try {
    if (msg.type === "load") {
      stopTimer();
      paramsRef.current = { ...(msg.params || {}) };
      world = new ABMWorld(msg.config || {});
      api = createModelApi(world, paramsRef);
      program = buildProgram(String(msg.code || ""));
      postMessage({ type: "loaded" });
      postState();
      return;
    }

    if (!world || !program) throw new Error("Chưa nạp model.");

    if (msg.type === "setup") {
      stopTimer();
      callSetup();
    } else if (msg.type === "step") {
      stopTimer();
      callGo();
    } else if (msg.type === "run") {
      world.resume();
      runLoop();
    } else if (msg.type === "stop") {
      stopTimer();
      postState();
    } else if (msg.type === "setParams") {
      paramsRef.current = { ...paramsRef.current, ...(msg.params || {}) };
    } else if (msg.type === "setSpeed") {
      stepsPerSecond = Number(msg.value) || 12;
      if (timer !== null) runLoop();
    } else if (msg.type === "snapshot") {
      postState();
    }
  } catch (error) {
    stopTimer();
    postMessage({ type: "error", message: error?.stack || error?.message || String(error) });
  }
};
