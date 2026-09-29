import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const categoria = event.queryStringParameters?.categoria;
    let result;

    if (categoria) {
      // Filtrar por categoría usando el índice (Query = rápido y barato)
      result = await docClient.send(new QueryCommand({
        TableName: "Productos",
        IndexName: "CategoriaIndex",
        KeyConditionExpression: "categoria = :categoria",
        ExpressionAttributeValues: {
          ":categoria": categoria,
        },
      }));
    } else {
      // Listar todos (Scan = revisa toda la tabla)
      result = await docClient.send(new ScanCommand({
        TableName: "Productos",
      }));
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
