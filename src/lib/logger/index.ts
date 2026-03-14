import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: [
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "secret",
    "apiKey",
    "metaToken",
    "totpSecret",
    "resetToken",
    "smtp_password",
    "accessTokenHash",
    "body.password",
    "body.token",
  ],
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});

export default logger;
