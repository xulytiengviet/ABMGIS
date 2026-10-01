import test from "node:test";
import assert from "node:assert/strict";
import { MODELS } from "../src/models.js";
import { compileBilaModel } from "../src/bila-bridge.js";
import { ABMWorld, createModelApi } from "../src/engine.js";

function instantiate(code, api) {
  const factory = new Function("vfm", `
    "use strict";
    ${code}
    return { setup, go };
  `);
  return factory(api);
}

for (const model of MODELS) {
  test(`compile and run model: ${model.id}`, () => {
    const result = compileBilaModel(model.source);
    assert.match(result.code, /function setup/);
    assert.match(result.code, /function go/);

    const paramsRef = {
      current: Object.fromEntries(model.params.map(p => [p.key, p.value]))
    };
    const world = new ABMWorld({ width: 40, height: 30, seed: 1234 });
    const api = createModelApi(world, paramsRef);
    const program = instantiate(result.code, api);

    program.setup();
    assert.equal(world.tickCount, 0);

    for (let i = 0; i < 3 && !world.stopped; i++) program.go();
    assert.ok(world.tickCount >= 1);
    assert.ok(world.agents.length >= 0);
    assert.equal(world.patches.length, world.width * world.height);
  });
}
