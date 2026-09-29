import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLA_ORDENES = "Ordenes";

function parseRoles(rolesRaw) {
  if (!rolesRaw) return [];
  if (Array.isArray(rolesRaw)) return rolesRaw;
  const str = String(rolesRaw).trim();
  const cleaned = str.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((r) => r.trim()).filter(Boolean);
}

const ROLES_PERMITIDOS = ["CLIENTE", "OPERADOR","ADMIN"];

export const handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const roles = parseRoles(claims.roles);
  const usuarioId = claims.oid || claims.sub;
  const esOperador = roles.includes("OPERADOR") || roles.includes("ADMIN");

  if (!roles.some((rol) => ROLES_PERMITIDOS.includes(rol))) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Acceso denegado: se requiere rol CLIENTE, OPERADOR o ADMIN" }),
    };
  }

  try {
    let result;

    if (esOperador) {
      // Operador ve todos los pedidos de todos los clientes
      result = await docClient.send(new ScanCommand({ TableName: TABLA_ORDENES }));
    } else {
      // Cliente solo ve los suyos (requiere el GSI CreadoPorIndex sobre "creadoPor")
      result = await docClient.send(new QueryCommand({
        TableName: TABLA_ORDENES,
        IndexName: "CreadoPorIndex",
        KeyConditionExpression: "creadoPor = :usuarioId",
        ExpressionAttributeValues: { ":usuarioId": usuarioId },
      }));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenes: result.Items, total: result.Count }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
