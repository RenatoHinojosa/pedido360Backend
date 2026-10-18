import { publicarComando } from "../publicador.mjs";

// Debe coincidir con custom.mensajeria.notificaciones.tipoMensaje del serverless.yml
const TIPO_NOTIFICACION = process.env.TIPO_MENSAJE_NOTIFICACION || "notificacion";

export async function publicarCambioEstado({ orden, estadoAnterior, correlationId }) {
  try {
    const envelope = await publicarComando({
      tipo: TIPO_NOTIFICACION,
      correlationId,
      payload: {
        orderId: orden.orderId,
        estadoAnterior,
        estadoNuevo: orden.estado,
        destinatario: orden.creadoPorEmail,
        productoNombre: orden.productoNombre,
        cantidad: orden.cantidad,
        total: orden.total,
      },
    });
    console.log(`[mensajeria] Comando publicado eventId=${envelope.eventId} tipo=${envelope.tipo} orderId=${orden.orderId}`);
  } catch (error) {
    // No se relanza: un fallo de mensajería nunca debe tumbar el cambio de estado
    console.error(`[mensajeria] No se pudo publicar el comando de orderId=${orden.orderId}:`, error.message);
  }
}