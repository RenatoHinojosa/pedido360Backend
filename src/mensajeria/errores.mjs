// Error que indica que reintentar no sirve: el mensaje está mal formado o incompleto.
export class ErrorNoRecuperable extends Error {
  constructor(message) {
    super(message);
    this.name = "ErrorNoRecuperable";
  }
}