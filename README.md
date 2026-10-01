# ABMGIS — Agent-Based Modeling for GIS on the Web

**ABMGIS** là nền tảng mã nguồn mở để xây dựng và chạy mô hình **Agent-Based Modeling (ABM)** trên GIS trực tiếp trong trình duyệt, theo tinh thần đơn giản như NetLogo nhưng thiết kế browser-first.

- Ngôn ngữ mô hình mặc định: **BilaScript v4**
- GIS: **MapLibre GL JS + PMTiles**
- Runtime: **JavaScript/Web Worker** (mở đường cho WebAssembly)
- Phân phối: **PWA + GitHub Pages**
- Cài đặt: **không cần cài desktop**
- Giấy phép core: **MIT**

## Mục tiêu

```text
Mở URL → chọn model → Setup → Run → quan sát agent / patch / biểu đồ
```

ABMGIS tách rõ các lớp:

```text
BilaScript model
      ↓
BilaScript compiler
      ↓
JavaScript model
      ↓
ABMGIS Model API
      ↓
Simulation Worker
      ↓
Agent / Patch / Tick / GIS / PMTiles
```

## MVP 0.1

Bản đầu tiên có:

- World 2D dạng patch grid.
- Agent/breed.
- `setup`, `go`, `tick`.
- `create`, `ask`, `forward`, `neighbors`, `oneOf`, `kill`.
- Parameter sliders.
- Monitor + biểu đồ theo thời gian.
- Thư viện model mẫu kiểu NetLogo.
- Trình soạn thảo BilaScript ngay trên web.
- Chạy mô phỏng trong Web Worker để không khóa giao diện.
- GIS tab hỗ trợ nạp PMTiles URL.
- Service Worker/PWA để cache app shell.

## Model mẫu

1. **Random Walk** — agent di chuyển ngẫu nhiên.
2. **Schelling Segregation** — mô hình phân tách dân cư.
3. **Wolf–Sheep** — predator/prey.
4. **SIR** — lan truyền dịch bệnh.
5. **Urban Growth** — cellular/agent-style growth trên patch grid.

## BilaScript

ABMGIS dùng compiler BilaScript v4 (MIT) từ dự án:

- https://github.com/xulytiengviet/bilascript
- https://bila.js.org/

Ví dụ:

```javascript
---bila---

haml_sob setup() {
  vfm.clear();
  vfm.create("people", vfm.param("population"), (a) => {
    a.x = vfm.random(0, vfm.width);
    a.y = vfm.random(0, vfm.height);
  });
  vfm.resetTick();
}

haml_sob go() {
  vfm.ask("people", (a) => {
    a.heading += vfm.random(-30, 30);
    vfm.forward(a, vfm.param("speed"));
  });
  vfm.tick();
}
```

## Chạy local

Repo là web tĩnh, chỉ cần một HTTP server:

```bash
python -m http.server 8080
```

sau đó mở `http://localhost:8080`.

Không nên mở trực tiếp bằng `file://` vì module worker/service worker cần HTTP(S).

## GitHub Pages

Workflow `.github/workflows/pages.yml` triển khai toàn bộ site. Nếu Pages chưa được bật cho repository, vào **Settings → Pages → Source: GitHub Actions** một lần; các lần push sau tự triển khai.

## Roadmap

- 0.2: import/export model package, patch fields, GeoJSON.
- 0.3: PMTiles vector/raster + spatial queries.
- 0.4: experiment runner / batch / Monte Carlo.
- 0.5: IndexedDB/OPFS project persistence.
- 1.0: stable ABMGIS Model API.
- 2.x: Rust/WASM execution core.
- 3.x: cloud collaboration + large-scale simulation.

## Giấy phép

MIT License. Xem [LICENSE](./LICENSE).

BilaScript v4 được vendored trong `vendor/bilascript/v4/` theo giấy phép MIT của dự án gốc.
