import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

function parseRoles(rolesRaw) {
  if (!rolesRaw) return [];
  if (Array.isArray(rolesRaw)) return rolesRaw;
  const str = String(rolesRaw).trim();
  const cleaned = str.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map(r => r.trim()).filter(Boolean);
}

export const handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const roles = parseRoles(claims.roles);

  if (!roles.includes("ADMIN")) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Acceso denegado: se requiere rol ADMIN" }),
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

    // Confirmar que el producto existe antes de intentar editarlo
    const existing = await docClient.send(new GetCommand({
      TableName: "Productos",
      Key: { productId },
    }));

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Producto no encontrado" }),
      };
    }

    const body = JSON.parse(event.body);
    const { nombre, categoria, precio, stock, descripcion } = body;

    // Construir la actualización solo con los campos que vinieron
    const updateFields = {};
    if (nombre !== undefined) updateFields.nombre = nombre;
    if (categoria !== undefined) updateFields.categoria = categoria;
    if (precio !== undefined) updateFields.precio = Number(precio);
    if (stock !== undefined) updateFields.stock = Number(stock);
    if (descripcion !== undefined) updateFields.descripcion = descripcion;

    if (Object.keys(updateFields).length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "No se enviaron campos para actualizar" }),
      };
    }

    const updateExpr = "SET " + Object.keys(updateFields).map((k) => `#${k} = :${k}`).join(", ");
    const exprAttrNames = Object.fromEntries(Object.keys(updateFields).map(k => [`#${k}`, k]));
    const exprAttrValues = Object.fromEntries(Object.entries(updateFields).map(([k, v]) => [`:${k}`, v]));

    const result = await docClient.send(new UpdateCommand({
      TableName: "Productos",
      Key: { productId },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: "ALL_NEW",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Producto actualizado", producto: result.Attributes }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
