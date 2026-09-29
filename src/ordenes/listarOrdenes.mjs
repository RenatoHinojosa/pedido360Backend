import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    let result;

    if (esOperador) {
      result = await docClient.send(new ScanCommand({ TableName: TABLA_ORDENES }));
    } else {
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
