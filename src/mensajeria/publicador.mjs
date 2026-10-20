import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";

const sns = new SNSClient({});
const TOPIC_ARN = process.env.TOPIC_EVENTOS_ORDEN_ARN;

/**
 * Publica un comando en el topic. El "tipo" viaja como atributo del mensaje
 * para que cada suscripción filtre solo los que le corresponden.
 *
 * Envelope común: eventId, tipo, timestamp, correlationId + payload.
 */
export async function publicarComando({ tipo, payload, correlationId }) {
  const envelope = {
    eventId: randomUUID(),
    tipo,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || randomUUID(),
    payload,
  };

  console.log("[mensajeria] Publicando evento SNS", {
    eventId: envelope.eventId,
    tipo: envelope.tipo,
    orderId: payload?.orderId,
    topicArn: TOPIC_ARN,
  });

  const result = await sns.send(new PublishCommand({
    TopicArn: TOPIC_ARN,
    Message: JSON.stringify(envelope),
    MessageAttributes: {
      tipo: { DataType: "String", StringValue: tipo },
    },
  }));

  console.log("[mensajeria] Evento SNS publicado", {
    eventId: envelope.eventId,
    tipo: envelope.tipo,
    orderId: payload?.orderId,
    messageId: result.MessageId,
  });

  return envelope;
}