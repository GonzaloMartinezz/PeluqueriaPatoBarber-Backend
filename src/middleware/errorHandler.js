const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error del servidor';

  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Recurso no encontrado';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join('. ');
  }

  if (err.type === 'entity.parse.failed') message = 'El cuerpo de la solicitud no es JSON válido';
  if (err.type === 'entity.too.large') message = 'La solicitud es demasiado grande';

  if (statusCode >= 500) {
    console.error(err);
    // En producción nunca se muestran detalles internos al cliente.
    if (process.env.NODE_ENV === 'production') message = 'Error del servidor';
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' || statusCode < 500 ? undefined : err.stack,
  });
};

module.exports = errorHandler;
