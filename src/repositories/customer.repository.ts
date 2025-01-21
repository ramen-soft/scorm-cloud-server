import { ResultSetHeader, RowDataPacket } from "mysql2";
import { connection } from "../lib/db";
import { CustomerDTO } from "../module/customer/dto/CustomerDTO";
import { PaginatedRequest } from "../util/pagination.model";
import { v4 as uuid } from "uuid";
import { PoolConnection } from "mysql2/promise";

export class CustomerRepository {
	async countAll(): Promise<number> {
		const conn = await connection.getConnection();

		const [[res]] = await conn.query<ResultSetHeader & [{ total: number }]>(
			`SELECT COUNT(1) total FROM customer`
		);
		conn.release();
		return res.total;
	}

	async find(id: number): Promise<CustomerDTO> {
		const conn = await connection.getConnection();
		const [[row]] = await conn.query<CustomerDTO[] & ResultSetHeader>(
			`SELECT * FROM customer WHERE id = ?`,
			[id]
		);
		if (row) {
			//buscamos origenes permitidos:
			const [rows] = await conn.query<
				{ origin: string }[] & ResultSetHeader
			>(`SELECT origin FROM customer_origins WHERE customerid = ?`, [
				row.id,
			]);
			const origins = rows.map((row) => row.origin);
			if (origins) {
				row.origins = origins;
			}
		}
		conn.release();
		return row;
	}

	async findByGUID(guid: string): Promise<CustomerDTO> {
		const conn = await connection.getConnection();
		const [[row]] = await conn.query<CustomerDTO[] & ResultSetHeader>(
			`SELECT * FROM customer WHERE guid = ?`,
			[guid]
		);
		conn.release();
		return row;
	}

	async findAll(options: PaginatedRequest) {
		const conn = await connection.getConnection();
		const rows = await conn.query<RowDataPacket[]>(
			`SELECT GROUP_CONCAT(o.origin) origins, c.id, c.guid, c.cif, c.name, c.description, c.active 
			 FROM customer c 
			 LEFT JOIN customer_origins o on o.customerid = c.id 
			 GROUP BY c.id, c.guid, c.cif, c.name, c.description, c.active
			 LIMIT ?, ?`,
			[options.page * options.limit, options.limit]
		);
		const results = rows[0].map((result) => {
			const customer: CustomerDTO = {
				id: result.id,
				guid: result.guid,
				cif: result.cif,
				name: result.name,
				description: result.description,
				active: Number(result.active) == 1,
				origins: result.origins?.split(",") || [],
				created_on: new Date(result.created_on),
				updated_on: new Date(result.updated_on || result.created_on),
			};
			return customer;
		});
		conn.release();
		return results;
	}

	private async saveOrigins(
		conn: PoolConnection,
		customer_id: number,
		origins: string[]
	) {
		await conn.query("DELETE FROM customer_origins WHERE customerid = ?", [
			customer_id,
		]);
		const stmt2 = await conn.prepare(
			"INSERT INTO customer_origins (customerid, origin) VALUES (?, ?)"
		);
		for (let origin of origins) {
			stmt2.execute([customer_id, origin]);
		}
		return true;
	}

	async save(customer: CustomerDTO) {
		const conn = await connection.getConnection();
		await conn.beginTransaction();
		const stmt = await conn.prepare(
			`INSERT INTO customer (guid, cif, name, description, active) VALUES (?, ?, ?, ?, ?)`
		);
		const result = await stmt.execute([
			uuid(),
			customer.cif,
			customer.name,
			customer.description ?? "",
			customer.active,
		]);

		const [op, err] = result;
		if (!err) {
			const customerId = (op as ResultSetHeader).insertId;
			await this.saveOrigins(conn, customerId, customer.origins);
		}

		await conn.commit();
		conn.release();
		return result;
	}

	async update(customer: CustomerDTO) {
		const conn = await connection.getConnection();
		await conn.beginTransaction();
		const stmt = await conn.prepare(
			`UPDATE customer SET cif = ?, name = ?, description = ?, active = ? WHERE id = ?`
		);
		const result = await stmt.execute([
			customer.cif,
			customer.name,
			customer.description ?? "",
			customer.active,
			customer.id,
		]);

		const [op, err] = result;
		if (!err) {
			await this.saveOrigins(conn, customer.id!, customer.origins);
		}

		await conn.commit();
		conn.release();
		return result;
	}

	async delete(customer: CustomerDTO) {
		const conn = await connection.getConnection();
		try {
			await conn.beginTransaction();

			await conn.query(
				"DELETE FROM customer_origins WHERE customerid = ?",
				[customer.id]
			);
			await conn.query(
				"DELETE FROM customer_scorm WHERE customerid = ?",
				[customer.id]
			);
			await conn.query("DELETE FROM customer_user WHERE customerid = ?", [
				customer.id,
			]);
			await conn.query("DELETE FROM customer WHERE id = ?", [
				customer.id,
			]);

			await conn.commit();
		} catch (error) {
			console.log(error);
			await conn.rollback();
		} finally {
			conn.release();
		}
	}
}
