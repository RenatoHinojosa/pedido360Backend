import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { parseRoles } from "../shared/parseRoles.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;
const ROLES_PERMITIDOS = ["ADMIN", "OPERADOR"];

export const handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const roles = parseRoles(claims.roles);

  if (!roles.some((rol) => ROLES_PERMITIDOS.includes(rol))) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Acceso denegado: se requiere rol ADMIN u OPERADOR" }),
    };
  }

  try {
    const productId = event.pathParameters?.id;
    if (!productId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Falta el ID del producto en la ruta" }),
      };
    }

    const existing = await docClient.send(new GetCommand({
      TableName: TABLA_PRODUCTOS,
      Key: { productId },
    }));

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Producto no encontrado" }),
      };
    }

    await docClient.send(new DeleteCommand({
      TableName: TABLA_PRODUCTOS,
      Key: { productId },
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Producto eliminado", productId }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
