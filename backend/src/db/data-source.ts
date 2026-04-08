import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5433"),
  username: process.env.POSTGRES_USER || "myuser",
  password: process.env.POSTGRES_PASSWORD || "mypassword",
  database: process.env.POSTGRES_DB || "mydatabase",
  synchronize: false, // We will use migrations or manually sync later
  logging: true,
  entities: [
    __dirname + "/entities/*.{js,ts}",
  ],
  migrations: [
    __dirname + "/migrations/*.{js,ts}"
  ],
  subscribers: [],
});
