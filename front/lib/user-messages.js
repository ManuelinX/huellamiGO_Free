const defaultErrorMessage = "No pudimos completar la acción. Intenta de nuevo.";

const statusMessages = {
  400: "Revisa los datos e intenta de nuevo.",
  401: "Inicia sesión para continuar.",
  403: "No tienes permiso para hacer esta acción.",
  404: "No encontramos ese contenido.",
  409: "Esa acción ya fue registrada.",
  413: "El archivo es demasiado grande.",
  429: "Espera un momento antes de intentar de nuevo.",
  500: "Algo falló en HuellamiGO. Intenta de nuevo en unos minutos.",
  502: "El servicio no respondió. Intenta de nuevo en unos minutos.",
  503: "HuellamiGO está temporalmente fuera de servicio.",
};

const technicalPatterns = [
  /error http/i,
  /failed to fetch/i,
  /networkerror/i,
  /unexpected token/i,
  /json/i,
  /syntax/i,
  /database/i,
  /postgres/i,
  /operator does not exist/i,
];

function isTechnicalMessage(message) {
  return technicalPatterns.some((pattern) => pattern.test(message));
}

export function getUserErrorMessage(error, fallback = defaultErrorMessage) {
  const message = error?.message?.trim();

  if (error?.status === 400 && message && !isTechnicalMessage(message)) {
    return message;
  }

  if (error?.status && statusMessages[error.status]) {
    return statusMessages[error.status];
  }

  if (!message || isTechnicalMessage(message)) {
    return fallback;
  }

  return message;
}

export const userMessages = {
  imageInvalid: "Selecciona una imagen válida.",
  imagePreparing: "Preparando imagen...",
  imageFailed: "No pudimos procesar la imagen. Intenta con otra foto.",
  sessionChecking: "Revisando tu sesión...",
  loginRequired: "Inicia sesión para continuar.",
  emailVerificationRequired: "Verifica tu correo para continuar.",
  locationRequired: "Marca una ubicación aproximada en el mapa.",
  actionSaved: "Listo. Cambios guardados.",
};
