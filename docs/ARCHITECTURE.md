# ABMGIS Architecture

## Nguyên tắc

1. **Browser-first**: model cơ bản chạy hoàn toàn trong trình duyệt.
2. **BilaScript-first**: người dùng viết model bằng BilaScript; JavaScript chỉ là backend sinh mã.
3. **Worker-first**: simulation chạy trong Web Worker để UI không bị khóa.
4. **GIS-native**: PMTiles/MapLibre là lớp dữ liệu không gian chính; GeoJSON/raster/network sẽ bổ sung dần.
5. **Offline-friendly**: PWA + Service Worker cache app shell.
6. **Open model API**: BilaScript, JavaScript và WASM có thể cùng gọi một Model API.

## Luồng thực thi

```text
model.bila
   ↓
BilaScript v4 compiler
   ↓
JavaScript model
   ↓
ABMGIS Model API
   ↓
Web Worker
   ↓
ABMWorld
   ├─ Agent/Breed
   ├─ Patch
   ├─ Tick
   ├─ RNG
   ├─ Neighborhood
   └─ Metrics
```

## GIS

```text
PMTiles URL
   ↓ HTTP Range Request
PMTiles Protocol
   ↓
MapLibre GL JS
   ↓
ABMGIS GIS view
```

Model GIS thực trong các phiên bản sau sẽ có `GeoAgent`, CRS, geometry, spatial index và network routing. Bản 0.1 đã có PMTiles viewer và preview chiếu agent World lên extent bản đồ.

## API 0.1

- `vfm.clear()`
- `vfm.create(breed, n, init)`
- `vfm.hatch(breed, parent, init)`
- `vfm.ask(breed, fn)`
- `vfm.all(breed)`
- `vfm.count(breed)`
- `vfm.kill(agent)`
- `vfm.forward(agent, distance)`
- `vfm.moveToRandom(agent)`
- `vfm.neighbors(agent, breed, radius)`
- `vfm.nearest(agent, breed, radius)`
- `vfm.oneOf(list)`
- `vfm.random(min, max)`
- `vfm.randomInt(min, max)`
- `vfm.chance(p)`
- `vfm.patch(x,y)`
- `vfm.setPatch(x,y,value)`
- `vfm.forEachPatch(fn)`
- `vfm.patchNeighbors(x,y,radius)`
- `vfm.countPatches(value)`
- `vfm.metric(name,value)`
- `vfm.tick()`
- `vfm.stop(reason)`
