import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

export const handler = async (event) => {
  try {
    const categoria = event.queryStringParameters?.categoria;

    let result;

    if (categoria) {
      result = await docClient.send(new QueryCommand({
        TableName: TABLA_PRODUCTOS,
        IndexName: "CategoriaIndex",
        KeyConditionExpression: "categoria = :categoria",
        ExpressionAttributeValues: { ":categoria": categoria },
      }));
    } else {
      result = await docClient.send(new ScanCommand({ TableName: TABLA_PRODUCTOS }));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productos: result.Items, total: result.Count }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
