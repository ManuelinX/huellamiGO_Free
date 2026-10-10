import { config } from "../config.js";

const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function getPostgisSqlNames() {
  const schema = config.postgis.schema;

  if (!identifierPattern.test(schema)) {
    throw new Error("POSTGIS_SCHEMA no es un identificador válido");
  }

  return {
    geography: `${schema}.geography`,
    stDWithin: `${schema}.st_dwithin`,
    stDistance: `${schema}.st_distance`,
    stPoint: `${schema}.st_point`,
    stSetSrid: `${schema}.st_setsrid`
  };
}
