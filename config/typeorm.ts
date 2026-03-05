// src/config/typeorm.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    synchronize: false,
    entities: ["dist/**/*.entity.js"],
    migrations: ["src/migrations/*.ts"],
    ssl: {
        rejectUnauthorized: false
    }
});