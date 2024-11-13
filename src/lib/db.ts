import { createPool } from "mysql2/promise";

export const connection = createPool({
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT),
	user: process.env.DB_USER,
	password: process.env.DB_PSWD,
	database: process.env.DB_NAME,
});
