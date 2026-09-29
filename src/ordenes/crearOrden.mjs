import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { parseRoles } from "../shared/parseRoles.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;
const TABLA_ORDENES = process.env.TABLA_ORDENES;
const ROLES_PERMITIDOS = ["CLIENTE", "OPERADOR"];

export const handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const roles = parseRoles(claims.roles);
  const usuarioId = claims.oid || claims.sub;
  const usuarioEmail = claims.upn || claims.preferred_username;

  if (!roles.some((rol) => ROLES_PERMITIDOS.includes(rol))) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Acceso denegado: se requiere rol CLIENTE u OPERADOR" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { productId, cantidad } = body;

    if (!productId || !cantidad || cantidad <= 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Se requiere productId y una cantidad mayor a 0" }),
      };
    }

    const productoResult = await docClient.send(new GetCommand({
      TableName: TABLA_PRODUCTOS,
      Key: { productId },
    }));

    const producto = productoResult.Item;
    if (!producto) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Producto no encontrado" }),
      };
    }

    if (producto.stock < cantidad) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: `Stock insuficiente. Disponible: ${producto.stock}` }),
      };
    }

    const now = new Date().toISOString();
    const orden = {
      orderId: randomUUID(),
      productId,
      productoNombre: producto.nombre,
      cantidad,
      precioUnitario: producto.precio,
      total: producto.precio * cantidad,
      estado: "CREADO",
      creadoPor: usuarioId,
      creadoPorEmail: usuarioEmail,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLA_ORDENES,
      Item: orden,
    }));

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Pedido creado en estado CREADO", orden }),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "JSON inválido en el body" }),
      };
    }
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
