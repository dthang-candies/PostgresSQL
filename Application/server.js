const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3000);
const maxFeatures = Number(process.env.MAX_FEATURES || 10000);

if (!process.env.DATABASE_URL) {
  console.warn('Missing DATABASE_URL in environment. API calls will fail until configured.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/layers', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        f_table_schema AS schema_name,
        f_table_name AS table_name,
        f_geometry_column AS geom_column,
        type,
        srid
      FROM public.geometry_columns
      WHERE f_table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY f_table_schema, f_table_name
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/layers/:schema/:table', async (req, res) => {
  try {
    const schema = req.params.schema;
    const table = req.params.table;

    const layerInfo = await pool.query(
      `
      SELECT f_geometry_column AS geom_column
      FROM public.geometry_columns
      WHERE f_table_schema = $1 AND f_table_name = $2
      LIMIT 1
      `,
      [schema, table]
    );

    if (layerInfo.rowCount === 0) {
      return res.status(404).json({ error: 'Layer not found.' });
    }

    const geomColumn = layerInfo.rows[0].geom_column;
    const schemaQ = quoteIdent(schema);
    const tableQ = quoteIdent(table);
    const geomQ = quoteIdent(geomColumn);

    const sql = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(
            CASE
              WHEN ST_SRID(t.${geomQ}) = 4326 THEN t.${geomQ}
              WHEN ST_SRID(t.${geomQ}) > 0 THEN ST_Transform(t.${geomQ}, 4326)
              ELSE t.${geomQ}
            END
          )::jsonb,
          'properties', to_jsonb(t) - '${geomColumn}'
        ) AS feature
        FROM ${schemaQ}.${tableQ} AS t
        WHERE t.${geomQ} IS NOT NULL
        LIMIT $1
      ) AS features
    `;

    const result = await pool.query(sql, [maxFeatures]);
    return res.json(result.rows[0].geojson);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Spatial web app is running on http://localhost:${port}`);
});
