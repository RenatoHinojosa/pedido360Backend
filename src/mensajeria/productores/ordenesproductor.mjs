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

  console.log("[mensajeria] Cambio de estado recibido", {
    orderId: orden.orderId,
    estadoAnterior,
    estadoNuevo: orden.estado,
    correlationId,
  });

  try {
    // Mantener la notificación que ya existía.
    console.log("[mensajeria] Preparando notificacion", {
      orderId: orden.orderId,
      tipo: TIPO_NOTIFICACION,
    });

    await publicarComando({
      tipo: TIPO_NOTIFICACION,
      correlationId,
      payload,
    });

    // Avisar a Kitchen únicamente cuando el pedido sea aceptado.
    if (orden.estado === "ACEPTADO") {
      console.log("[mensajeria] Preparando evento para Kitchen", {
        orderId: orden.orderId,
        tipo: "PedidoAceptado",
      });

      await publicarComando({
        tipo: "PedidoAceptado",
        correlationId,
        payload,
      });
    } else {
      console.log("[mensajeria] No se publica evento para Kitchen", {
        orderId: orden.orderId,
        estadoNuevo: orden.estado,
        motivo: "El estado no es ACEPTADO",
      });
    }
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
