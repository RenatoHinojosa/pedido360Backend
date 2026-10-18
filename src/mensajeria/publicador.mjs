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

  await sns.send(new PublishCommand({
    TopicArn: TOPIC_ARN,
    Message: JSON.stringify(envelope),
    MessageAttributes: {
      tipo: { DataType: "String", StringValue: tipo },
    },
  }));

  return envelope;
}