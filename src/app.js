import { MODELS, modelById } from "./models.js";
import { compileBilaModel } from "./bila-bridge.js";
import { initGIS, addPMTilesLayer, projectAgentsToCurrentMap, resizeGIS } from "./gis.js";

const $ = id => document.getElementById(id);

const els = {
  modelSelect: $("modelSelect"),
  modelDescription: $("modelDescription"),
  params: $("params"),
  speedSlider: $("speedSlider"),
  speedValue: $("speedValue"),
  resetParamsBtn: $("resetParamsBtn"),
  worldCanvas: $("worldCanvas"),
  worldSize: $("worldSize"),
  codeEditor: $("codeEditor"),
  compileBtn: $("compileBtn"),
  compileStatus: $("compileStatus"),
  compilerOutput: $("compilerOutput"),
  resetCodeBtn: $("resetCodeBtn"),
  setupBtn: $("setupBtn"),
  stepBtn: $("stepBtn"),
  runBtn: $("runBtn"),
  stopBtn: $("stopBtn"),
  tickInline: $("tickInline"),
  tickMonitor: $("tickMonitor"),
  agentMonitor: $("agentMonitor"),
  metricsList: $("metricsList"),
  runtimeState: $("runtimeState"),
  chartCanvas: $("chartCanvas"),
  chartTitle: $("chartTitle"),
  consoleOutput: $("consoleOutput"),
  clearConsoleBtn: $("clearConsoleBtn"),
  exportBtn: $("exportBtn"),
  pmtilesUrl: $("pmtilesUrl"),
  pmtilesType: $("pmtilesType"),
  addPmtilesBtn: $("addPmtilesBtn"),
  syncAgentsBtn: $("syncAgentsBtn")
};

let currentModel = MODELS[0];
let params = {};
let worker = null;
let loaded = false;
let dirty = true;
let setupDone = false;
let latestState = null;
let chartSeries = [];
let pendingLoaded = null;
let resolveLoaded = null;
let mapInitialized = false;

function log(message) {
  const ts = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  const line = `[${ts}] ${message}`;
  const prev = els.consoleOutput.textContent.trim();
  els.consoleOutput.textContent = prev ? `${prev}\n${line}` : line;
  els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

function setRuntime(text) {
  els.runtimeState.textContent = text;
}

function setCompileStatus(kind, text) {
  els.compileStatus.className = `status-chip ${kind}`;
  els.compileStatus.textContent = text;
}

function createWorker() {
  if (worker) worker.terminate();
  worker = new Worker("./src/sim-worker.js", { type: "module" });
  worker.onmessage = event => {
    const msg = event.data || {};
    if (msg.type === "loaded") {
      loaded = true;
      dirty = false;
      setupDone = false;
      resolveLoaded?.();
      resolveLoaded = null;
      setRuntime("Model đã nạp");
      return;
    }

    if (msg.type === "state") {
      latestState = msg.state;
      renderState(msg.state);
      if (msg.state?.stopped) setRuntime(msg.state.stopReason || "Đã dừng");
      return;
    }

    if (msg.type === "error") {
      setRuntime("Lỗi");
      log(msg.message || "Lỗi worker");
      setCompileStatus("err", "Lỗi runtime");
    }
  };
  worker.onerror = event => {
    log(event.message || "Worker error");
    setRuntime("Lỗi worker");
  };
}

function getDefaultParams(model = currentModel) {
  return Object.fromEntries(model.params.map(p => [p.key, p.value]));
}

function renderModelSelect() {
  els.modelSelect.innerHTML = "";
  const groups = new Map();
  for (const model of MODELS) {
    if (!groups.has(model.category)) groups.set(model.category, []);
    groups.get(model.category).push(model);
  }
  for (const [category, models] of groups) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = category;
    for (const model of models) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      optgroup.append(option);
    }
    els.modelSelect.append(optgroup);
  }
}

function renderParams() {
  els.params.innerHTML = "";
  for (const spec of currentModel.params) {
    const wrap = document.createElement("div");
    wrap.className = "param";

    const head = document.createElement("div");
    head.className = "param-head";
    const label = document.createElement("label");
    label.textContent = spec.label;
    const value = document.createElement("span");
    value.className = "param-value";
    value.textContent = formatNumber(params[spec.key]);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(params[spec.key]);
    input.dataset.key = spec.key;

    input.addEventListener("input", () => {
      params[spec.key] = Number(input.value);
      value.textContent = formatNumber(params[spec.key]);
      if (loaded) worker.postMessage({ type: "setParams", params: { [spec.key]: params[spec.key] } });
    });

    head.append(label, value);
    wrap.append(head, input);
    els.params.append(wrap);
  }
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  if (Math.abs(n) >= 1000) return n.toLocaleString("vi-VN");
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

function switchModel(id) {
  stopSimulation();
  currentModel = modelById(id);
  params = getDefaultParams(currentModel);
  loaded = false;
  dirty = true;
  setupDone = false;
  latestState = null;
  chartSeries = [];
  els.modelSelect.value = currentModel.id;
  els.modelDescription.textContent = currentModel.description;
  els.codeEditor.value = currentModel.source;
  els.chartTitle.textContent = `Biểu đồ · ${currentModel.metricKey}`;
  setCompileStatus("neutral", "Chưa biên dịch");
  els.compilerOutput.textContent = "Nhấn “Biên dịch BilaScript” hoặc Setup để nạp model.";
  renderParams();
  clearWorld();
  renderChart();
  setRuntime("Sẵn sàng");
  log(`Chọn model: ${currentModel.name}`);
}

async function compileAndLoad() {
  try {
    setCompileStatus("neutral", "Đang biên dịch…");
    els.compilerOutput.textContent = "BilaScript v4 đang biên dịch…";
    const result = compileBilaModel(els.codeEditor.value);

    pendingLoaded = new Promise(resolve => { resolveLoaded = resolve; });
    worker.postMessage({
      type: "load",
      code: result.code,
      params,
      config: { width: 80, height: 60, seed: 20261001, wrap: true }
    });
    await pendingLoaded;

    const diagnostics = result.diagnostics || [];
    const warnings = diagnostics.filter(d => d.severity !== "error");
    const perf = result.performance?.ok === false ? "Kiểm tra zero-cost: cảnh báo" : "Zero-cost: đạt";
    els.compilerOutput.textContent =
      `BilaScript ${result.version} → JavaScript\n` +
      `${perf}\n` +
      (warnings.length ? `Diagnostics: ${warnings.length}\n${warnings.map(w => `${w.code || "WARN"}: ${w.message}`).join("\n")}` : "Không có lỗi.");
    setCompileStatus("ok", `BilaScript ${result.version}`);
    log(`Biên dịch thành công: ${currentModel.name}`);
    return true;
  } catch (error) {
    loaded = false;
    setCompileStatus("err", "Biên dịch lỗi");
    els.compilerOutput.textContent = error?.message || String(error);
    log(`Lỗi BilaScript: ${error?.message || error}`);
    setRuntime("Lỗi biên dịch");
    return false;
  }
}

async function ensureLoaded() {
  if (loaded && !dirty) return true;
  return compileAndLoad();
}

async function setupModel() {
  const ok = await ensureLoaded();
  if (!ok) return;
  chartSeries = [];
  setupDone = true;
  worker.postMessage({ type: "setup" });
  setRuntime("Đã Setup");
}

async function stepModel() {
  const ok = await ensureLoaded();
  if (!ok) return;
  if (!setupDone) {
    await setupModel();
    return;
  }
  worker.postMessage({ type: "step" });
  setRuntime("Step");
}

async function runModel() {
  const ok = await ensureLoaded();
  if (!ok) return;
  if (!setupDone) {
    await setupModel();
  }
  worker.postMessage({ type: "run" });
  setRuntime("Đang chạy");
}

function stopSimulation() {
  if (worker) worker.postMessage({ type: "stop" });
  setRuntime("Đã dừng");
}

function clearWorld() {
  const ctx = els.worldCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.worldCanvas.width, els.worldCanvas.height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, els.worldCanvas.width, els.worldCanvas.height);
  els.tickMonitor.textContent = "0";
  els.tickInline.textContent = "0";
  els.agentMonitor.textContent = "0";
  els.metricsList.innerHTML = "";
}

function renderState(state) {
  els.worldSize.textContent = `${state.width} × ${state.height}`;
  els.tickMonitor.textContent = state.tick.toLocaleString("vi-VN");
  els.tickInline.textContent = state.tick.toLocaleString("vi-VN");
  els.agentMonitor.textContent = (state.agents?.length || 0).toLocaleString("vi-VN");

  renderWorld(state);
  renderMetrics(state);

  const value = metricValue(state, currentModel.metricKey);
  if (Number.isFinite(value)) {
    const last = chartSeries.at(-1);
    if (!last || last.tick !== state.tick) {
      chartSeries.push({ tick: state.tick, value });
      if (chartSeries.length > 500) chartSeries.shift();
      renderChart();
    }
  }

  if (mapInitialized) projectAgentsToCurrentMap(state);

  if (state.logs?.length) {
    const last = state.logs.at(-1);
    if (last && !els.consoleOutput.textContent.endsWith(last)) log(last);
  }
}

function metricValue(state, key) {
  if (key in (state.metrics || {})) return Number(state.metrics[key]);
  if (key in (state.counts || {})) return Number(state.counts[key]);
  if (key === "totalAgents") return Number(state.agents?.length || 0);
  return NaN;
}

function renderMetrics(state) {
  const entries = [
    ...Object.entries(state.counts || {}).map(([k, v]) => [`breed · ${k}`, v]),
    ...Object.entries(state.metrics || {})
  ];
  els.metricsList.innerHTML = "";
  for (const [name, value] of entries.slice(0, 14)) {
    const row = document.createElement("div");
    row.className = "metric-row";
    const label = document.createElement("span");
    label.textContent = name;
    const strong = document.createElement("strong");
    strong.textContent = formatNumber(value);
    row.append(label, strong);
    els.metricsList.append(row);
  }
}

function renderWorld(state) {
  const canvas = els.worldCanvas;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width, ch = canvas.height;
  const sx = cw / state.width, sy = ch / state.height;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, cw, ch);

  if (state.patches?.length) {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const v = state.patches[y * state.width + x];
        if (v === 0) continue;
        ctx.fillStyle = v === 1 ? "#f59e0b" : v === 2 ? "#94a3b8" : "#bfdbfe";
        ctx.fillRect(x * sx, y * sy, Math.ceil(sx) + 0.2, Math.ceil(sy) + 0.2);
      }
    }
  }

  if (sx >= 8 && sy >= 8) {
    ctx.strokeStyle = "rgba(148,163,184,.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= state.width; x++) {
      ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, ch);
    }
    for (let y = 0; y <= state.height; y++) {
      ctx.moveTo(0, y * sy); ctx.lineTo(cw, y * sy);
    }
    ctx.stroke();
  }

  for (const a of state.agents || []) {
    const x = a.x * sx, y = a.y * sy;
    const r = Math.max(1.5, Number(a.size || 4));
    ctx.beginPath();
    ctx.fillStyle = a.color || "#2563eb";
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r >= 4) {
      ctx.strokeStyle = "rgba(15,23,42,.25)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
}

function renderChart() {
  const canvas = els.chartCanvas;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const pad = 28;
  ctx.strokeStyle = "#dbe3ed";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 8);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - 8, h - pad);
  ctx.stroke();

  if (chartSeries.length < 2) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui";
    ctx.fillText("Chạy model để xem chuỗi thời gian", pad + 12, h / 2);
    return;
  }

  const minT = chartSeries[0].tick;
  const maxT = chartSeries.at(-1).tick || minT + 1;
  let minV = Math.min(...chartSeries.map(p => p.value));
  let maxV = Math.max(...chartSeries.map(p => p.value));
  if (minV === maxV) { minV -= 1; maxV += 1; }

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  chartSeries.forEach((p, i) => {
    const x = pad + ((p.tick - minT) / Math.max(1, maxT - minT)) * (w - pad - 10);
    const y = 10 + (1 - (p.value - minV) / (maxV - minV)) * (h - pad - 18);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "10px system-ui";
  ctx.fillText(formatNumber(maxV), 2, 14);
  ctx.fillText(formatNumber(minV), 2, h - pad);
  ctx.fillText(`tick ${maxT}`, w - 55, h - 8);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".stage-panel").forEach(p => p.classList.remove("active"));
  $(`panel-${name}`)?.classList.add("active");

  if (name === "gis") {
    try {
      if (!mapInitialized) {
        initGIS("map");
        mapInitialized = true;
      }
      setTimeout(resizeGIS, 50);
      if (latestState) projectAgentsToCurrentMap(latestState);
    } catch (error) {
      log(error.message || String(error));
    }
  }
}

function exportSource() {
  const blob = new Blob([els.codeEditor.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentModel.id}.bila`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wireEvents() {
  els.modelSelect.addEventListener("change", () => switchModel(els.modelSelect.value));
  els.resetParamsBtn.addEventListener("click", () => {
    params = getDefaultParams(currentModel);
    renderParams();
    if (loaded) worker.postMessage({ type: "setParams", params });
  });

  els.speedSlider.addEventListener("input", () => {
    els.speedValue.textContent = `${els.speedSlider.value} tick/s`;
    worker.postMessage({ type: "setSpeed", value: Number(els.speedSlider.value) });
  });

  els.codeEditor.addEventListener("input", () => {
    dirty = true;
    loaded = false;
    setupDone = false;
    setCompileStatus("neutral", "Chưa biên dịch");
  });

  els.compileBtn.addEventListener("click", compileAndLoad);
  els.resetCodeBtn.addEventListener("click", () => {
    els.codeEditor.value = currentModel.source;
    dirty = true;
    loaded = false;
    setCompileStatus("neutral", "Chưa biên dịch");
  });

  els.setupBtn.addEventListener("click", setupModel);
  els.stepBtn.addEventListener("click", stepModel);
  els.runBtn.addEventListener("click", runModel);
  els.stopBtn.addEventListener("click", stopSimulation);
  els.exportBtn.addEventListener("click", exportSource);

  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  els.addPmtilesBtn.addEventListener("click", async () => {
    try {
      if (!mapInitialized) {
        initGIS("map");
        mapInitialized = true;
      }
      setRuntime("Đang nạp PMTiles");
      const id = await addPMTilesLayer(els.pmtilesUrl.value, els.pmtilesType.value);
      setRuntime("Đã nạp PMTiles");
      log(`Đã thêm lớp PMTiles: ${id}`);
    } catch (error) {
      setRuntime("Lỗi PMTiles");
      log(`PMTiles: ${error.message || error}`);
    }
  });

  els.syncAgentsBtn.addEventListener("click", () => {
    if (latestState) {
      projectAgentsToCurrentMap(latestState);
      log("Đã chiếu agent World lên extent bản đồ hiện tại (preview).");
    }
  });

  els.clearConsoleBtn.addEventListener("click", () => { els.consoleOutput.textContent = ""; });
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (error) {
      console.warn("Service Worker:", error);
    }
  }
}

function boot() {
  renderModelSelect();
  createWorker();
  wireEvents();
  switchModel(MODELS[0].id);
  renderChart();
  registerServiceWorker();

  const paramsFromUrl = new URLSearchParams(location.search);
  const modelId = paramsFromUrl.get("model");
  if (modelId && MODELS.some(m => m.id === modelId)) switchModel(modelId);
}

boot();
