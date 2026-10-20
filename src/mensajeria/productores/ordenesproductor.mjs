import { publicarComando } from "../publicador.mjs";

export async function publicarCambioEstado({ orden, estadoAnterior, correlationId }) {
  const payload = {
    orderId: orden.orderId,
    estadoAnterior,
    estadoNuevo: orden.estado,
    destinatario: orden.creadoPorEmail,
    productoNombre: orden.productoNombre,
    cantidad: orden.cantidad,
    total: orden.total,
  };
  const tipo = orden.estado === "ACEPTADO"
    ? "PedidoAceptado"
    : orden.estado === "DESPACHADO"
      ? "PedidoDespachado"
      : "CambioEstadoPedido";

  console.log("[mensajeria] Cambio de estado recibido", {
    orderId: orden.orderId,
    estadoAnterior,
    estadoNuevo: orden.estado,
    tipo,
    correlationId,
  });

  try {
    console.log("[mensajeria] Preparando evento de pedido", {
      orderId: orden.orderId,
      tipo,
    });

    await publicarComando({
      tipo,
      correlationId,
      payload,
    });
  } catch (error) {
    console.error(
      `[mensajeria] No se pudo publicar evento para orderId=${orden.orderId}`,
      {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }
    );
  }
}
