export const MODELS = [
  {
    id: "random-walk",
    name: "Random Walk",
    category: "Cơ bản",
    description: "Model nhập môn kiểu NetLogo: tạo agent, quay ngẫu nhiên và di chuyển qua từng tick.",
    metricKey: "totalAgents",
    params: [
      { key: "population", label: "Số agent", min: 10, max: 1500, step: 10, value: 300 },
      { key: "speed", label: "Tốc độ", min: 0.1, max: 3, step: 0.1, value: 0.8 },
      { key: "turn", label: "Góc quay tối đa", min: 0, max: 90, step: 1, value: 30 }
    ],
    source: `---bila---

haml_sob setup() {
  vfm.clear();
  vfm.create("people", vfm.param("population"), (a) => {
    a.x = vfm.random(0, vfm.width);
    a.y = vfm.random(0, vfm.height);
    a.heading = vfm.random(0, 360);
    a.color = "#2563eb";
    a.size = 4;
  });
  vfm.resetTick();
  vfm.metric("population", vfm.count("people"));
}

haml_sob go() {
  vfm.ask("people", (a) => {
    a.heading = a.heading + vfm.random(0 - vfm.param("turn"), vfm.param("turn"));
    vfm.forward(a, vfm.param("speed"));
  });
  vfm.tick();
  vfm.metric("population", vfm.count("people"));
}
`
  },
  {
    id: "schelling",
    name: "Schelling Segregation",
    category: "Xã hội",
    description: "Hai nhóm cư dân đổi vị trí khi tỷ lệ hàng xóm cùng nhóm thấp hơn ngưỡng mong muốn.",
    metricKey: "unhappy",
    params: [
      { key: "population", label: "Dân số", min: 50, max: 1200, step: 10, value: 500 },
      { key: "vision", label: "Bán kính hàng xóm", min: 1, max: 8, step: 0.5, value: 4 },
      { key: "tolerance", label: "Ngưỡng cùng nhóm", min: 0, max: 1, step: 0.05, value: 0.55 }
    ],
    source: `---bila---

haml_sob setup() {
  vfm.clear();
  vfm.create("people", vfm.param("population"), (a) => {
    a.group = vfm.chance(0.5) ? 0 : 1;
    a.color = a.group == 0 ? "#2563eb" : "#ef4444";
    a.size = 4;
  });
  vfm.resetTick();
}

haml_sob go() {
  bilb unhappy = 0;

  vfm.ask("people", (a) => {
    bilb ns = vfm.neighbors(a, "people", vfm.param("vision"));
    bilb same = 0;
    bilb i = 0;

    vil (i = 0; i < ns.length; i = i + 1) {
      neub (ns[i].group == a.group) {
        same = same + 1;
      }
    }

    neub (ns.length > 0) {
      bilb ratio = same / ns.length;
      neub (ratio < vfm.param("tolerance")) {
        unhappy = unhappy + 1;
        vfm.moveToRandom(a);
      }
    }
  });

  vfm.tick();
  vfm.metric("unhappy", unhappy);
  vfm.metric("happy", vfm.count("people") - unhappy);

  neub (unhappy == 0) {
    vfm.stop("Hệ thống đạt trạng thái ổn định");
  }
}
`
  },
  {
    id: "sir",
    name: "SIR Epidemic",
    category: "Sức khỏe",
    description: "Susceptible–Infected–Recovered: mô phỏng lây nhiễm theo khoảng cách và thời gian hồi phục.",
    metricKey: "infected",
    params: [
      { key: "population", label: "Dân số", min: 50, max: 2000, step: 10, value: 600 },
      { key: "initialInfected", label: "Ca nhiễm đầu", min: 1, max: 100, step: 1, value: 12 },
      { key: "radius", label: "Bán kính lây", min: 0.5, max: 6, step: 0.5, value: 2 },
      { key: "infection", label: "Xác suất lây", min: 0, max: 1, step: 0.02, value: 0.18 },
      { key: "recovery", label: "Số tick hồi phục", min: 5, max: 100, step: 1, value: 35 }
    ],
    source: `---bila---

haml_sob setup() {
  vfm.clear();
  vfm.create("people", vfm.param("population"), (a) => {
    a.state = 0;
    a.ageInfected = 0;
    a.color = "#22c55e";
    a.size = 4;
  });

  bilb people = vfm.all("people");
  bilb i = 0;
  vil (i = 0; i < vfm.param("initialInfected"); i = i + 1) {
    bilb a = people[i];
    neub (a != voy_jaj_trir) {
      a.state = 1;
      a.color = "#ef4444";
    }
  }
  vfm.resetTick();
}

haml_sob go() {
  vfm.ask("people", (a) => {
    a.heading = a.heading + vfm.random(-25, 25);
    vfm.forward(a, 0.35);

    neub (a.state == 1) {
      a.ageInfected = a.ageInfected + 1;
      bilb ns = vfm.neighbors(a, "people", vfm.param("radius"));
      bilb i = 0;
      vil (i = 0; i < ns.length; i = i + 1) {
        neub (ns[i].state == 0 && vfm.chance(vfm.param("infection"))) {
          ns[i].state = 1;
          ns[i].ageInfected = 0;
          ns[i].color = "#ef4444";
        }
      }

      neub (a.ageInfected >= vfm.param("recovery")) {
        a.state = 2;
        a.color = "#64748b";
      }
    }
  });

  bilb s = 0;
  bilb inf = 0;
  bilb r = 0;
  bilb all = vfm.all("people");
  bilb j = 0;
  vil (j = 0; j < all.length; j = j + 1) {
    neub (all[j].state == 0) { s = s + 1; }
    neub (all[j].state == 1) { inf = inf + 1; }
    neub (all[j].state == 2) { r = r + 1; }
  }

  vfm.tick();
  vfm.metric("susceptible", s);
  vfm.metric("infected", inf);
  vfm.metric("recovered", r);

  neub (inf == 0) {
    vfm.stop("Không còn ca nhiễm");
  }
}
`
  },
  {
    id: "wolf-sheep",
    name: "Wolf–Sheep",
    category: "Sinh thái",
    description: "Predator–prey: cừu sinh sản, sói săn mồi, cả hai tiêu hao năng lượng.",
    metricKey: "wolves",
    params: [
      { key: "sheep", label: "Cừu ban đầu", min: 20, max: 1000, step: 10, value: 300 },
      { key: "wolves", label: "Sói ban đầu", min: 5, max: 300, step: 5, value: 70 },
      { key: "sheepBirth", label: "Sinh sản cừu", min: 0, max: 0.2, step: 0.005, value: 0.035 },
      { key: "wolfBirth", label: "Sinh sản sói", min: 0, max: 0.2, step: 0.005, value: 0.02 },
      { key: "gain", label: "Năng lượng khi săn", min: 1, max: 20, step: 1, value: 8 }
    ],
    source: `---bila---

haml_sob setup() {
  vfm.clear();

  vfm.create("sheep", vfm.param("sheep"), (a) => {
    a.energy = vfm.random(4, 12);
    a.color = "#f8fafc";
    a.size = 4;
  });

  vfm.create("wolves", vfm.param("wolves"), (a) => {
    a.energy = vfm.random(6, 16);
    a.color = "#ef4444";
    a.size = 5;
  });

  vfm.resetTick();
}

haml_sob go() {
  vfm.ask("sheep", (a) => {
    a.heading = a.heading + vfm.random(-40, 40);
    vfm.forward(a, 0.7);
    a.energy = a.energy - 0.18;

    neub (vfm.chance(vfm.param("sheepBirth"))) {
      a.energy = a.energy * 0.5;
      vfm.hatch("sheep", a, (c) => {
        c.energy = a.energy;
        c.heading = vfm.random(0, 360);
      });
    }

    neub (a.energy <= 0) { vfm.kill(a); }
  });

  vfm.ask("wolves", (w) => {
    w.heading = w.heading + vfm.random(-35, 35);
    vfm.forward(w, 0.9);
    w.energy = w.energy - 0.35;

    bilb prey = vfm.nearest(w, "sheep", 2.2);
    neub (prey != voy_jaj_trir) {
      vfm.kill(prey);
      w.energy = w.energy + vfm.param("gain");
    }

    neub (vfm.chance(vfm.param("wolfBirth"))) {
      w.energy = w.energy * 0.5;
      vfm.hatch("wolves", w, (c) => {
        c.energy = w.energy;
        c.heading = vfm.random(0, 360);
      });
    }

    neub (w.energy <= 0) { vfm.kill(w); }
  });

  vfm.tick();
  vfm.metric("sheep", vfm.count("sheep"));
  vfm.metric("wolves", vfm.count("wolves"));

  neub (vfm.count("sheep") == 0 || vfm.count("wolves") == 0) {
    vfm.stop("Một quần thể đã biến mất");
  }
}
`
  },
  {
    id: "urban-growth",
    name: "Urban Growth",
    category: "GIS / Đô thị",
    description: "Mô hình tăng trưởng đô thị trên patch grid, có ảnh hưởng lân cận và hành lang đường.",
    metricKey: "urban",
    params: [
      { key: "seedUrban", label: "Hạt nhân đô thị", min: 1, max: 20, step: 1, value: 6 },
      { key: "spread", label: "Lan tỏa", min: 0, max: 1, step: 0.02, value: 0.28 },
      { key: "roadInfluence", label: "Ảnh hưởng đường", min: 0, max: 1, step: 0.02, value: 0.35 },
      { key: "spontaneous", label: "Tự phát", min: 0, max: 0.1, step: 0.002, value: 0.008 }
    ],
    source: `---bila---

haml_sob setup() {
  vfm.clear();
  vfm.clearPatches(0);

  vfm.forEachPatch((x, y, value) => {
    neub ((x % 13) == 0 || (y % 17) == 0) {
      vfm.setPatch(x, y, 2);
    }
  });

  bilb i = 0;
  vil (i = 0; i < vfm.param("seedUrban"); i = i + 1) {
    bilb x = vfm.randomInt(5, vfm.width - 6);
    bilb y = vfm.randomInt(5, vfm.height - 6);
    vfm.setPatch(x, y, 1);
    vfm.setPatch(x + 1, y, 1);
    vfm.setPatch(x, y + 1, 1);
  }

  vfm.resetTick();
  vfm.metric("urban", vfm.countPatches(1));
}

haml_sob go() {
  bilb candidates = [];

  vfm.forEachPatch((x, y, value) => {
    neub (value == 0) {
      bilb ns = vfm.patchNeighbors(x, y, 1);
      bilb urbanN = 0;
      bilb roadN = 0;
      bilb j = 0;

      vil (j = 0; j < ns.length; j = j + 1) {
        neub (ns[j].value == 1) { urbanN = urbanN + 1; }
        neub (ns[j].value == 2) { roadN = roadN + 1; }
      }

      bilb p = vfm.param("spontaneous");
      p = p + (urbanN / 8) * vfm.param("spread");
      neub (roadN > 0) {
        p = p + vfm.param("roadInfluence");
      }

      neub (vfm.chance(p)) {
        candidates.push([x, y]);
      }
    }
  });

  bilb k = 0;
  vil (k = 0; k < candidates.length; k = k + 1) {
    vfm.setPatch(candidates[k][0], candidates[k][1], 1);
  }

  vfm.tick();
  vfm.metric("urban", vfm.countPatches(1));
  vfm.metric("newUrban", candidates.length);
}
`
  }
];

export function modelById(id) {
  return MODELS.find(m => m.id === id) || MODELS[0];
}
