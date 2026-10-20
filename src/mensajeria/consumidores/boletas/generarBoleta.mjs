export const handler = async (event) => {
  const batchItemFailures = [];

  console.log("[boletas] Lote recibido", {
    cantidadRegistros: event.Records?.length ?? 0,
  });

  for (const record of event.Records ?? []) {
    try {
      console.log("[boletas] Mensaje recibido desde SQS", {
        messageId: record.messageId,
        approximateReceiveCount: record.attributes?.ApproximateReceiveCount,
      });

      const mensaje = JSON.parse(record.body);
      const pedido = mensaje.payload;

      if (
        mensaje.tipo !== "PedidoDespachado" ||
        !pedido?.orderId ||
        !pedido?.productoNombre ||
        !pedido?.cantidad
      ) {
        throw new Error("Mensaje inválido o faltan datos del pedido");
      }

      if (pedido.simularFallo) {
        throw new Error("Fallo simulado al generar la boleta");
      }

      console.log(`[boletas] Boleta generada para el pedido ${pedido.orderId}`);
      console.log(`[boletas] Evento procesado: ${mensaje.eventId}`);
    } catch (error) {
      console.error(
        `[boletas] Error al procesar mensaje ${record.messageId}`,
        {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      );

      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return { batchItemFailures };
};
