import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { parseRoles } from "../shared/parseRoles.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLA_ORDENES = process.env.TABLA_ORDENES;
const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

// Máquina de estados del caso Pedidos360:
// CREADO -> ACEPTADO -> EN_PREPARACION -> DESPACHADO -> ENTREGADO
// con CANCELADO como salida posible desde CREADO, ACEPTADO o EN_PREPARACION.
const TRANSICIONES_VALIDAS = {
  CREADO: ["ACEPTADO", "CANCELADO"],
  ACEPTADO: ["EN_PREPARACION", "CANCELADO"],
  EN_PREPARACION: ["DESPACHADO", "CANCELADO"],
  DESPACHADO: ["ENTREGADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

const ESTADOS_CON_STOCK_DESCONTADO = ["ACEPTADO", "EN_PREPARACION", "DESPACHADO"];

export const handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const roles = parseRoles(claims.roles);
  const usuarioId = claims.oid || claims.sub;
  const esOperador = roles.includes("OPERADOR") || roles.includes("ADMIN");
  const esCliente = roles.includes("CLIENTE");

  try {
    const orderId = event.pathParameters?.id;
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Falta el ID del pedido en la ruta" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const nuevoEstado = body.nuevoEstado;

    if (!nuevoEstado || !TRANSICIONES_VALIDAS[nuevoEstado]) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: "nuevoEstado inválido. Valores válidos: " + Object.keys(TRANSICIONES_VALIDAS).join(", "),
        }),
      };
    }

    const existing = await docClient.send(new GetCommand({
      TableName: TABLA_ORDENES,
      Key: { orderId },
    }));

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Pedido no encontrado" }),
      };
    }

    const estadoActual = existing.Item.estado;

    if (!TRANSICIONES_VALIDAS[estadoActual].includes(nuevoEstado)) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: `No se puede pasar de ${estadoActual} a ${nuevoEstado}`,
          transicionesValidas: TRANSICIONES_VALIDAS[estadoActual],
        }),
      };
    }

    const esCancelacionTempranaDelCliente =
      nuevoEstado === "CANCELADO" &&
      estadoActual === "CREADO" &&
      esCliente &&
      existing.Item.creadoPor === usuarioId;

    if (!esOperador && !esCancelacionTempranaDelCliente) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "No tienes permiso para realizar este cambio de estado" }),
      };
    }

    if (nuevoEstado === "ACEPTADO") {
      await docClient.send(new UpdateCommand({
        TableName: TABLA_PRODUCTOS,
        Key: { productId: existing.Item.productId },
        UpdateExpression: "SET stock = stock - :cantidad",
        ConditionExpression: "stock >= :cantidad",
        ExpressionAttributeValues: { ":cantidad": existing.Item.cantidad },
      }));
    }

    if (nuevoEstado === "CANCELADO" && ESTADOS_CON_STOCK_DESCONTADO.includes(estadoActual)) {
      await docClient.send(new UpdateCommand({
        TableName: TABLA_PRODUCTOS,
        Key: { productId: existing.Item.productId },
        UpdateExpression: "SET stock = stock + :cantidad",
        ExpressionAttributeValues: { ":cantidad": existing.Item.cantidad },
      }));
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLA_ORDENES,
      Key: { orderId },
      UpdateExpression: "SET estado = :estado, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":estado": nuevoEstado,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: `Pedido actualizado a ${nuevoEstado}`, orden: result.Attributes }),
    };
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "El stock cambió justo antes de este cambio de estado, intenta de nuevo" }),
      };
    }
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
