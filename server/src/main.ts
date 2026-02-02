import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const cookieParserMod = require("cookie-parser");
const cookieParser = cookieParserMod.default ?? cookieParserMod;

const helmetMod = require("helmet");
const helmet = helmetMod.default ?? helmetMod;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(helmet());
  const origins = (process.env.WEB_ORIGIN || "http://localhost:5175")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}

bootstrap();
