import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { ErrorNoRecuperable } from "../../errores.mjs";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

const TABLA_NOTIFICACIONES = process.env.TABLA_NOTIFICACIONES;
const DLQ_URL = process.env.COLA_NOTIFICACIONES_DLQ_URL;
const MAX_REINTENTOS = process.env.MAX_REINTENTOS;

// 1) Validar el mensaje. Si está malo, no tiene sentido reintentar.
function leerEnvelope(body) {
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch {
    throw new ErrorNoRecuperable("El mensaje no es un JSON válido");
  }
  const p = envelope?.payload;
  if (!envelope?.eventId || !p?.orderId || !p?.destinatario || !p?.estadoNuevo) {
    throw new ErrorNoRecuperable("Faltan campos obligatorios (eventId, orderId, destinatario, estadoNuevo)");
  }
  return envelope;
}

// 2) "Enviar" la notificación (simulado). Aquí iría SES u otro proveedor real.
async function enviarNotificacion(envelope) {
  const { payload } = envelope;

  // Solo para la demo: permite provocar un fallo recuperable a propósito.
  if (payload.simularFallo) {
    throw new Error("Fallo simulado del proveedor de correo");
  }

  const asunto = `Tu pedido ${payload.orderId} ahora está ${payload.estadoNuevo}`;
  console.log(`[notificaciones] (simulado) Correo a ${payload.destinatario} | Asunto: ${asunto}`);
  return asunto;
}

// 3) Dejar constancia en DynamoDB. Usa eventId como clave: el mismo evento no se registra dos veces.
async function registrar(envelope, asunto) {
  const { payload } = envelope;
  try {
    await docClient.send(new PutCommand({
      TableName: TABLA_NOTIFICACIONES,
      Item: {
        notificationId: envelope.eventId,
        correlationId: envelope.correlationId,
        orderId: payload.orderId,
        destinatario: payload.destinatario,
        estadoNuevo: payload.estadoNuevo,
        asunto,
        canal: "email-simulado",
        enviadoAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(notificationId)",
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      console.log(`[notificaciones] Evento duplicado ignorado eventId=${envelope.eventId}`);
      return;
    }
    throw error;
  }
}

// Error sin arreglo: se manda directo a la DLQ con el motivo.
async function enviarADLQ(record, error) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: DLQ_URL,
    MessageBody: record.body,
    MessageAttributes: {
      motivoError: { DataType: "String", StringValue: error.message.slice(0, 250) },
      origen: { DataType: "String", StringValue: "enviarNotificacion" },
      messageIdOriginal: { DataType: "String", StringValue: record.messageId },
    },
  }));
}

export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records) {
    const intento = record.attributes?.ApproximateReceiveCount;
    try {
      const envelope = leerEnvelope(record.body);
      const asunto = await enviarNotificacion(envelope);
      await registrar(envelope, asunto);
      console.log(`[notificaciones] ACK messageId=${record.messageId} eventId=${envelope.eventId}`);
    } catch (error) {
      if (error instanceof ErrorNoRecuperable) {
        // Sin arreglo: DLQ directo y ACK del original (no se reintenta).
        console.error(`[notificaciones] NO recuperable messageId=${record.messageId}: ${error.message}. Enviando a DLQ`);
        try {
          await enviarADLQ(record, error);
        } catch (dlqError) {
          console.error(`[notificaciones] No se pudo enviar a la DLQ: ${dlqError.message}`);
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      } else {
        // Temporal: NACK. SQS lo reintenta y, agotados los intentos, lo manda a la DLQ.
        console.error(`[notificaciones] Recuperable messageId=${record.messageId} intento ${intento}/${MAX_REINTENTOS}: ${error.message}`);
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  }

  // Solo se reintentan los mensajes listados aquí; el resto del lote queda confirmado.
  return { batchItemFailures };
};