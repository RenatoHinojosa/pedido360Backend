
export const handler = async (event) => {
  const batchItemFailures = [];

  console.log("[ticket-bodega] Lote recibido", {
    cantidadRegistros: event.Records?.length ?? 0,
  });

  for (const record of event.Records ?? []) {
    try {
      console.log("[ticket-bodega] Mensaje recibido desde SQS", {
        messageId: record.messageId,
        approximateReceiveCount: record.attributes?.ApproximateReceiveCount,
      });

      const mensaje = JSON.parse(record.body);
      const pedido = mensaje.payload;

      if (
        mensaje.tipo !== "PedidoAceptado" ||
        !pedido?.orderId ||
        !pedido?.productoNombre ||
        !pedido?.cantidad
      ) {
        throw new Error("Mensaje inválido o faltan datos del pedido");
      }

      // Permite probar los reintentos y la DLQ.
      if (pedido.simularFallo) {
        throw new Error("Fallo simulado en el procesamiento de bodega");
      }

      console.log(
        `[ticket-bodega] Pedido aceptado: ${pedido.orderId}`
      );
      console.log(
        `[ticket-bodega] Producto: ${pedido.productoNombre} | Cantidad: ${pedido.cantidad}`
      );
      console.log(
        `[ticket-bodega] Evento procesado: ${mensaje.eventId}`
      );
    } catch (error) {
      console.error(
        `[ticket-bodega] Error al procesar mensaje ${record.messageId}`,
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
