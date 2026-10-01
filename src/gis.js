let map = null;
let protocol = null;
let layerSerial = 0;
let agentSourceReady = false;

export function initGIS(containerId = "map") {
  if (map) return map;
  if (!globalThis.maplibregl || !globalThis.pmtiles) {
    throw new Error("MapLibre hoặc PMTiles chưa tải được. Kiểm tra kết nối Internet lần đầu.");
  }

  protocol = new globalThis.pmtiles.Protocol();
  globalThis.maplibregl.addProtocol("pmtiles", protocol.tile);

  map = new globalThis.maplibregl.Map({
    container: containerId,
    center: [106.2, 10.25],
    zoom: 5.2,
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#eef3f8" }
        }
      ]
    },
    attributionControl: true
  });

  map.addControl(new globalThis.maplibregl.NavigationControl(), "top-right");
  map.on("load", ensureAgentLayer);
  return map;
}

function ensureAgentLayer() {
  if (!map || agentSourceReady || !map.isStyleLoaded()) return;
  map.addSource("abmgis-agents", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });
  map.addLayer({
    id: "abmgis-agents-circle",
    type: "circle",
    source: "abmgis-agents",
    paint: {
      "circle-radius": ["coalesce", ["get", "radius"], 4],
      "circle-color": ["coalesce", ["get", "color"], "#2563eb"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 0.6,
      "circle-opacity": 0.9
    }
  });
  agentSourceReady = true;
}

export async function addPMTilesLayer(url, kind = "vector") {
  if (!map) initGIS();
  const clean = String(url || "").trim();
  if (!/^https?:\/\//i.test(clean)) throw new Error("PMTiles cần URL HTTP(S) hợp lệ.");

  const id = `pmtiles-${++layerSerial}`;
  const archive = new globalThis.pmtiles.PMTiles(clean);
  protocol.add(archive);

  if (kind === "raster") {
    map.addSource(id, { type: "raster", url: `pmtiles://${clean}`, tileSize: 256 });
    map.addLayer({ id: `${id}-raster`, type: "raster", source: id });
  } else {
    map.addSource(id, { type: "vector", url: `pmtiles://${clean}` });
    let metadata = {};
    try { metadata = await archive.getMetadata(); } catch (_) {}
    const vectorLayers = metadata?.vector_layers || metadata?.tilestats?.layers || [];
    const sourceLayers = vectorLayers.map(v => v.id || v.layer).filter(Boolean);

    if (!sourceLayers.length) {
      throw new Error("Không tìm thấy vector_layers trong metadata PMTiles. Hãy kiểm tra archive hoặc chọn Raster.");
    }

    for (const sourceLayer of sourceLayers.slice(0, 40)) {
      const safe = String(sourceLayer).replace(/[^A-Za-z0-9_-]/g, "_");
      map.addLayer({
        id: `${id}-${safe}-fill`,
        type: "fill",
        source: id,
        "source-layer": sourceLayer,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#93c5fd", "fill-opacity": 0.28 }
      });
      map.addLayer({
        id: `${id}-${safe}-line`,
        type: "line",
        source: id,
        "source-layer": sourceLayer,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#2563eb", "line-width": 1.2, "line-opacity": 0.75 }
      });
      map.addLayer({
        id: `${id}-${safe}-point`,
        type: "circle",
        source: id,
        "source-layer": sourceLayer,
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-color": "#0f172a", "circle-radius": 2.5, "circle-opacity": 0.8 }
      });
    }
  }

  return id;
}

export function projectAgentsToCurrentMap(state) {
  if (!map || !state?.agents) return;
  ensureAgentLayer();
  if (!agentSourceReady) return;

  const b = map.getBounds();
  const west = b.getWest(), east = b.getEast(), south = b.getSouth(), north = b.getNorth();
  const features = state.agents.slice(0, 20000).map(a => {
    const lon = west + (a.x / state.width) * (east - west);
    const lat = north - (a.y / state.height) * (north - south);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        id: a.id,
        breed: a.breed,
        color: a.color || "#2563eb",
        radius: Math.max(2, Math.min(8, a.size || 4))
      }
    };
  });
  map.getSource("abmgis-agents")?.setData({ type: "FeatureCollection", features });
}

export function resizeGIS() {
  map?.resize();
}

export function getMap() { return map; }
