import { publicarComando } from "../publicador.mjs";

// Debe coincidir con custom.mensajeria.notificaciones.tipoMensaje del serverless.yml
const TIPO_NOTIFICACION = process.env.TIPO_MENSAJE_NOTIFICACION || "notificacion";


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

  try {
    // Mantener la notificación que ya existía.
    await publicarComando({
      tipo: TIPO_NOTIFICACION,
      correlationId,
      payload,
    });

    // Avisar a Kitchen únicamente cuando el pedido sea aceptado.
    if (orden.estado === "ACEPTADO") {
      await publicarComando({
        tipo: "PedidoAceptado",
        correlationId,
        payload,
      });
    }
  } catch (error) {
    console.error(
      `[mensajeria] No se pudo publicar evento para orderId=${orden.orderId}:`,
      error.message
    );
  }
}
