const map = L.map('map', {
  worldCopyJump: false,
  maxBoundsViscosity: 1.0,
}).setView([20.961, 106.039], 16);

const projectBounds = L.latLngBounds(
  L.latLng(20.93, 106.00),
  L.latLng(20.99, 106.08)
);
map.setMaxBounds(projectBounds.pad(1.5));

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  minZoom: 12,
  noWrap: true,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const statusEl = document.getElementById('status');
const listEl = document.getElementById('layer-list');
const activeLayers = new Map();

// function layerStylePreset(layerKey) {
//   const key = layerKey.toLowerCase();
//   if (layerKey.endsWith('.bounds')) {
//     return { color: '#d15a2a', weight: 3, fillOpacity: 0.08, dashArray: '8 6' };
//   }
//   if (layerKey.endsWith('.building')) {
//     return { color: '#1c7ed6', weight: 1.5, fillOpacity: 0.55 };
//   }
//   if (layerKey.endsWith('.garbadge')) {
//     return { color: '#2b8a3e', weight: 1, fillOpacity: 0.95, radius: 7 };
//   }
//   if (layerKey.endsWith('.road')) {
//     return { color: '#f08c00', weight: 4, fillOpacity: 0.1 };
//   }
//   if (key.includes('instruction-generated') || key.includes('instruction_generated') || key.includes('instruction')) {
//     return { color: '#862e9c', weight: 5, fillOpacity: 0.1, dashArray: '10 6' };
//   }
//   return { color: '#0b7285', weight: 2, fillOpacity: 0.25 };
// }

function layerStylePreset(layerKey) {
  const key = layerKey.toLowerCase();

  if (layerKey.endsWith('.bounds')) {
    return { 
      color: '#111827',        // đen xám đậm
      weight: 3,
      fillOpacity: 0.05,
      dashArray: '4 4'
    };
  }

  if (layerKey.endsWith('.building')) {
    return { 
      color: '#e03131',        // đỏ đậm
      weight: 2,
      fillOpacity: 0.65
    };
  }

  if (layerKey.endsWith('.garbadge')) {
    return { 
      color: '#7048e8',        // tím sáng
      weight: 1.5,
      fillOpacity: 0.9,
      radius: 8
    };
  }

  if (layerKey.endsWith('.road')) {
    return { 
      color: '#00bcd4',        // cyan sáng
      weight: 5,
      fillOpacity: 0.2
    };
  }

  if (
    key.includes('instruction-generated') ||
    key.includes('instruction_generated') ||
    key.includes('instruction')
  ) {
    return { 
      color: '#ff006e',        // hồng neon
      weight: 6,
      fillOpacity: 0.15,
      dashArray: '6 10'
    };
  }

  return { 
    color: '#495057',          // xám trung tính
    weight: 2,
    fillOpacity: 0.3
  };
}

function styleForGeometry(feature, style) {
  const type = feature?.geometry?.type || '';
  if (type.includes('Point')) {
    return {
      radius: style.radius || 6,
      fillColor: style.color,
      color: '#ffffff',
      weight: 1,
      opacity: 1,
      fillOpacity: style.fillOpacity ?? 0.9,
    };
  }
  return {
    color: style.color,
    weight: style.weight || 2,
    fillOpacity: style.fillOpacity ?? 0.25,
    dashArray: style.dashArray || undefined,
  };
}

function addLayerToMap(layerKey, geojson) {
  const stylePreset = layerStylePreset(layerKey);
  const layer = L.geoJSON(geojson, {
    style: (feature) => styleForGeometry(feature, stylePreset),
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, styleForGeometry(feature, stylePreset)),
    onEachFeature: (feature, layerInstance) => {
      const props = feature.properties || {};
      const rows = Object.entries(props)
        .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${String(v ?? '')}</td></tr>`)
        .join('');
      const table = `<table>${rows}</table>`;
      layerInstance.bindPopup(table);
    },
  }).addTo(map);

  // Keep instruction-generated on top so its style is visible over road
  const key = layerKey.toLowerCase();
  if (key.includes('instruction-generated') || key.includes('instruction_generated') || key.includes('instruction')) {
    layer.bringToFront();
  }

  activeLayers.set(layerKey, layer);

  if (layer.getBounds && layer.getBounds().isValid()) {
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  }

  return geojson?.features?.length || 0;
}

async function fetchLayer(schema, table) {
  const res = await fetch(`/api/layers/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load layer ${schema}.${table}`);
  }
  return res.json();
}

function buildLayerItem(layerInfo) {
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'layer-row';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `layer-${layerInfo.schema_name}-${layerInfo.table_name}`;

  const labelWrap = document.createElement('div');
  const label = document.createElement('label');
  label.htmlFor = checkbox.id;
  label.textContent = `${layerInfo.schema_name}.${layerInfo.table_name}`;

  const meta = document.createElement('div');
  meta.className = 'layer-meta';
  meta.textContent = `${layerInfo.type || 'Geometry'} | SRID: ${layerInfo.srid || 'N/A'}`;

  labelWrap.appendChild(label);
  labelWrap.appendChild(meta);

  row.appendChild(checkbox);
  row.appendChild(labelWrap);
  li.appendChild(row);

  const layerKey = `${layerInfo.schema_name}.${layerInfo.table_name}`;

  checkbox.addEventListener('change', async (event) => {
    if (event.target.checked) {
      try {
        statusEl.textContent = `Đang tải ${layerKey}...`;
        const geojson = await fetchLayer(layerInfo.schema_name, layerInfo.table_name);
        const featureCount = addLayerToMap(layerKey, geojson);
        statusEl.textContent = `Đã tải ${layerKey} (${featureCount} đối tượng)`;
      } catch (error) {
        checkbox.checked = false;
        statusEl.textContent = `Lỗi: ${error.message}`;
      }
      return;
    }

    const existing = activeLayers.get(layerKey);
    if (existing) {
      map.removeLayer(existing);
      activeLayers.delete(layerKey);
      statusEl.textContent = `Đã tắt ${layerKey}`;
    }
  });

  return li;
}

async function init() {
  try {
    const res = await fetch('/api/layers');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không lấy được danh sách layers từ DB');
    }

    const layers = await res.json();
    if (!Array.isArray(layers) || layers.length === 0) {
      statusEl.textContent = 'Không tìm thấy layer geometry trong database.';
      return;
    }

    listEl.innerHTML = '';
    layers.forEach((layerInfo) => {
      listEl.appendChild(buildLayerItem(layerInfo));
    });

    statusEl.textContent = `Tìm thấy ${layers.length} layer geometry.`;
  } catch (error) {
    statusEl.textContent = `Lỗi kết nối API/DB: ${error.message}`;
  }
}

init();
