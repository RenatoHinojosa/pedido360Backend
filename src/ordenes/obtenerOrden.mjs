import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

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
      body: JSON.stringify({ mensaje: "Acceso denegado: se requiere rol CLIENTE u OPERADOR" }),
    };
  }

  try {
    const orderId = event.pathParameters?.id;
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Falta el ID del pedido en la ruta" }),
      };
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLA_ORDENES,
      Key: { orderId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Pedido no encontrado" }),
      };
    }

    // Un Cliente solo puede ver sus propios pedidos; un Operador puede ver todos
    if (!esOperador && result.Item.creadoPor !== usuarioId) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "No tienes permiso para ver este pedido" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orden: result.Item }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
