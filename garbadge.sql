SELECT
        f_table_schema AS schema_name,
        f_table_name AS table_name,
        f_geometry_column AS geom_column,
        type,
        srid
      FROM public.geometry_columns
      WHERE f_table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY f_table_schema, f_table_name