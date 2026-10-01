export class ABMWorld {
  constructor({ width = 80, height = 60, seed = 20261001, wrap = true } = {}) {
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    this.wrap = wrap;
    this.params = {};
    this.metrics = {};
    this.logs = [];
    this.resetRandom(this.seed);
    this.clear();
  }

  resetRandom(seed = this.seed) {
    this.seed = seed >>> 0;
    this._rngState = this.seed || 1;
  }

  _rng() {
    let t = this._rngState += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this._rngState = t >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  clear() {
    this.agents = [];
    this.nextId = 1;
    this.tickCount = 0;
    this.stopped = false;
    this.stopReason = "";
    this.metrics = {};
    this.logs = [];
    this.patches = new Uint8Array(this.width * this.height);
  }

  resetTick() { this.tickCount = 0; }
  tick() { this.tickCount += 1; }
  stop(reason = "") { this.stopped = true; this.stopReason = reason; }
  resume() { this.stopped = false; this.stopReason = ""; }

  random(min = 0, max = 1) { return min + this._rng() * (max - min); }
  randomInt(min, max) { return Math.floor(this.random(min, max + 1)); }
  chance(p) { return this._rng() < p; }
  oneOf(items) { return items?.length ? items[Math.floor(this._rng() * items.length)] : null; }

  create(breed, count, init) {
    const created = [];
    const n = Math.max(0, Math.floor(Number(count) || 0));
    for (let i = 0; i < n; i++) {
      const a = {
        id: this.nextId++,
        breed,
        x: this.random(0, this.width),
        y: this.random(0, this.height),
        heading: this.random(0, 360),
        color: "#2563eb",
        size: 4,
        alive: true
      };
      if (init) init(a, i);
      this._bound(a);
      this.agents.push(a);
      created.push(a);
    }
    return created;
  }

  hatch(breed, parent, init) {
    const child = this.create(breed, 1, (a) => {
      a.x = parent.x;
      a.y = parent.y;
      a.heading = parent.heading;
      a.color = parent.color;
      a.size = parent.size;
      if (init) init(a, parent);
    })[0];
    return child;
  }

  ask(breed, fn) {
    const list = typeof breed === "string"
      ? this.agents.filter(a => a.alive && a.breed === breed)
      : this.agents.filter(a => a.alive);
    for (const a of [...list]) {
      if (a.alive) fn(a);
    }
    this._compact();
  }

  all(breed = null) {
    return this.agents.filter(a => a.alive && (!breed || a.breed === breed));
  }

  count(breed = null) { return this.all(breed).length; }

  kill(agent) {
    if (agent) agent.alive = false;
  }

  forward(agent, distance = 1) {
    const rad = (agent.heading || 0) * Math.PI / 180;
    agent.x += Math.cos(rad) * distance;
    agent.y += Math.sin(rad) * distance;
    this._bound(agent);
  }

  moveToRandom(agent) {
    agent.x = this.random(0, this.width);
    agent.y = this.random(0, this.height);
    this._bound(agent);
  }

  neighbors(agent, breed = null, radius = 1.5) {
    const r2 = radius * radius;
    return this.agents.filter(other => {
      if (!other.alive || other.id === agent.id) return false;
      if (breed && other.breed !== breed) return false;
      let dx = Math.abs(other.x - agent.x);
      let dy = Math.abs(other.y - agent.y);
      if (this.wrap) {
        dx = Math.min(dx, this.width - dx);
        dy = Math.min(dy, this.height - dy);
      }
      return dx * dx + dy * dy <= r2;
    });
  }

  nearest(agent, breed = null, radius = Infinity) {
    let best = null;
    let bestD2 = radius * radius;
    for (const other of this.agents) {
      if (!other.alive || other.id === agent.id) continue;
      if (breed && other.breed !== breed) continue;
      let dx = Math.abs(other.x - agent.x);
      let dy = Math.abs(other.y - agent.y);
      if (this.wrap) {
        dx = Math.min(dx, this.width - dx);
        dy = Math.min(dy, this.height - dy);
      }
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = other; }
    }
    return best;
  }

  _bound(agent) {
    if (this.wrap) {
      agent.x = ((agent.x % this.width) + this.width) % this.width;
      agent.y = ((agent.y % this.height) + this.height) % this.height;
    } else {
      agent.x = Math.max(0, Math.min(this.width - 0.0001, agent.x));
      agent.y = Math.max(0, Math.min(this.height - 0.0001, agent.y));
    }
  }

  _compact() {
    if (this.agents.some(a => !a.alive)) this.agents = this.agents.filter(a => a.alive);
  }

  patchIndex(x, y) {
    const px = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
    return py * this.width + px;
  }

  patch(x, y) { return this.patches[this.patchIndex(x, y)]; }
  setPatch(x, y, value) { this.patches[this.patchIndex(x, y)] = Number(value) & 255; }

  clearPatches(value = 0) { this.patches.fill(Number(value) & 255); }

  forEachPatch(fn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) fn(x, y, this.patch(x, y));
    }
  }

  patchNeighbors(x, y, radius = 1) {
    const out = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!dx && !dy) continue;
        let nx = x + dx, ny = y + dy;
        if (this.wrap) {
          nx = (nx + this.width) % this.width;
          ny = (ny + this.height) % this.height;
        } else if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
          continue;
        }
        out.push({ x: nx, y: ny, value: this.patch(nx, ny) });
      }
    }
    return out;
  }

  countPatches(value) {
    let n = 0;
    for (const v of this.patches) if (v === value) n++;
    return n;
  }

  setMetric(name, value) { this.metrics[name] = Number(value); }
  log(message) {
    this.logs.push(String(message));
    if (this.logs.length > 60) this.logs.shift();
  }

  snapshot() {
    const counts = {};
    for (const a of this.agents) counts[a.breed] = (counts[a.breed] || 0) + 1;
    return {
      width: this.width,
      height: this.height,
      tick: this.tickCount,
      stopped: this.stopped,
      stopReason: this.stopReason,
      agents: this.agents.map(a => ({ ...a })),
      patches: Array.from(this.patches),
      counts,
      metrics: { ...this.metrics, totalAgents: this.agents.length },
      logs: [...this.logs]
    };
  }
}

export function createModelApi(world, paramsRef) {
  const params = () => paramsRef.current || {};
  return {
    get width() { return world.width; },
    get height() { return world.height; },
    get tickCount() { return world.tickCount; },
    param(name, fallback = 0) {
      const v = params()[name];
      return v === undefined ? fallback : Number(v);
    },
    clear: () => world.clear(),
    create: (breed, count, init) => world.create(breed, count, init),
    hatch: (breed, parent, init) => world.hatch(breed, parent, init),
    ask: (breed, fn) => world.ask(breed, fn),
    all: breed => world.all(breed),
    count: breed => world.count(breed),
    kill: a => world.kill(a),
    forward: (a, d) => world.forward(a, d),
    moveToRandom: a => world.moveToRandom(a),
    neighbors: (a, breed, radius) => world.neighbors(a, breed, radius),
    nearest: (a, breed, radius) => world.nearest(a, breed, radius),
    oneOf: list => world.oneOf(list),
    random: (min, max) => world.random(min, max),
    randomInt: (min, max) => world.randomInt(min, max),
    chance: p => world.chance(p),
    tick: () => world.tick(),
    resetTick: () => world.resetTick(),
    stop: reason => world.stop(reason),
    resume: () => world.resume(),
    patch: (x, y) => world.patch(x, y),
    setPatch: (x, y, value) => world.setPatch(x, y, value),
    clearPatches: value => world.clearPatches(value),
    forEachPatch: fn => world.forEachPatch(fn),
    patchNeighbors: (x, y, radius) => world.patchNeighbors(x, y, radius),
    countPatches: value => world.countPatches(value),
    metric: (name, value) => world.setMetric(name, value),
    log: message => world.log(message)
  };
}
