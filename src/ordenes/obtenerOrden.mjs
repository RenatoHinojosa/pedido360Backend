import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { parseRoles } from "../shared/parseRoles.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLA_ORDENES = process.env.TABLA_ORDENES;
const ROLES_PERMITIDOS = ["CLIENTE", "OPERADOR", "ADMIN"];

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
