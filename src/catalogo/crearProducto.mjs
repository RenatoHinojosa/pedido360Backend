import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
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
    const body = JSON.parse(event.body);
    const { nombre, categoria, precio, stock, descripcion } = body;

    if (!nombre || !categoria || precio === undefined || stock === undefined) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: "Faltan campos requeridos: nombre, categoria, precio, stock" }),
      };
    }

    const producto = {
      productId: randomUUID(),
      nombre,
      categoria,
      precio: Number(precio),
      stock: Number(stock),
      descripcion: descripcion || "",
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: TABLA_PRODUCTOS,
      Item: producto,
    }));

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Producto creado", producto }),
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
