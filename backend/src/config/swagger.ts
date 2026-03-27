import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Enterprise Task SaaS API",
      version: "1.0.0",
      description: "Versioned multi-tenant task management API."
    },
    servers: [{ url: env.SWAGGER_SERVER_URL }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ["src/routes/*.ts"]
});
