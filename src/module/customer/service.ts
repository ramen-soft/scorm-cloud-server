import { ResultSetHeader, RowDataPacket } from "mysql2";
import { connection } from "../../lib/db";
import { CustomerRepository } from "../../repositories/customer.repository";
import {
	PaginatedRequest,
	ResultsPagination,
} from "../../util/pagination.model";
import { ScormDTO } from "../scorm/dto/ScormList.dto";
import { CustomerDTO } from "./dto/CustomerDTO";
import { CustomerScormDTO } from "./dto/CustomerScormDTO";
import { CustomerUserDTO } from "./dto/CustomerUserDTO";
import { ScormAssignDTO } from "./dto/ScormAssignDTO";
import { createWorkbook } from "../../services/excel";

const getCustomers = async (options: PaginatedRequest) => {
	let results: ResultsPagination<CustomerDTO> = {
		page: options.page || 0,
		count: options.limit || 15,
		results: [],
		total: 0,
		totalPages: 0,
	};
	const repo = new CustomerRepository();

	results.total = await repo.countAll();
	results.totalPages = Math.ceil(results.total / results.count);
	results.results = await repo.findAll(options);
	return results;
};

const getCustomer = async (id: number) => {
	const repo = new CustomerRepository();
	return await repo.find(id);
};

const getCustomerStats = async (id: number) => {
	const repo = new CustomerRepository();
	return await repo.stats(id);
};

const addCustomer = async (customer: CustomerDTO) => {
	const repo = new CustomerRepository();
	if (!customer.id) {
		return await repo.save(customer);
	} else {
		return await repo.update(customer);
	}
};

const deleteCustomer = async (customer: CustomerDTO) => {
	const repo = new CustomerRepository();
	return repo.delete(customer);
};

const getCustomerScorms = async (
	customerId: number,
	options: PaginatedRequest
) => {
	let results: ResultsPagination<CustomerScormDTO> = {
		page: options.page || 0,
		count: options.limit || 15,
		results: [],
		total: 0,
		totalPages: 0,
	};

	const conn = await connection.getConnection();

	const [[totals]] = await conn.query<ResultSetHeader & [{ total: number }]>(
		`SELECT COUNT(1) total FROM customer_scorm cs WHERE cs.customerid = ?`,
		[customerId]
	);
	results.total = totals.total;
	results.totalPages = Math.ceil(results.total / results.count);
	const res = await conn.query<CustomerScormDTO[] & RowDataPacket[]>(
		`SELECT s.id, s.guid, s.name, cs.slots, cs.duration, cs.created_on FROM customer_scorm cs JOIN scorm s ON s.id = cs.scormid WHERE cs.customerid = ? LIMIT ?, ?`,
		[customerId, options.page * options.limit, options.limit]
	);
	conn.release();
	results.results = res[0];
	return results;
};

const getCustomerUsers = async (
	customerId: number,
	options: PaginatedRequest
) => {
	let results: ResultsPagination<CustomerUserDTO> = {
		page: options.page || 0,
		count: options.limit || 15,
		results: [],
		total: 0,
		totalPages: 0,
	};

	const conn = await connection.getConnection();

	const [[totals]] = await conn.query<ResultSetHeader & [{ total: number }]>(
		`SELECT COUNT(1) total FROM customer_user cu WHERE cu.customerid = ?`,
		[customerId]
	);
	results.total = totals.total;
	results.totalPages = Math.ceil(results.total / results.count);
	const res = await conn.query<CustomerUserDTO[] & RowDataPacket[]>(
		`SELECT * FROM customer_user WHERE customerid = ? LIMIT ?, ?`,
		[customerId, options.page * options.limit, options.limit]
	);
	conn.release();
	results.results = res[0].map((result) => {
		result.license_start = result.license_start
			? new Date(result.license_start)
			: null;
		result.license_end = result.license_end
			? new Date(result.license_end)
			: null;
		return result;
	});
	return results;
};

const getAvailableScorms = async (
	customerId: number,
	options: PaginatedRequest
) => {
	const conn = await connection.getConnection();

	let results: ResultsPagination<CustomerScormDTO> = {
		page: options.page || 0,
		count: options.limit || 15,
		results: [],
		total: 0,
		totalPages: 0,
	};

	try {
		const [[totals]] = await conn.query<
			ResultSetHeader & [{ total: number }]
		>(
			`SELECT COUNT(1) total 
			FROM scorm
			LEFT JOIN customer_scorm cs ON cs.customerid = ? AND cs.scormid = scorm.id
			WHERE cs.scormid IS NULL`,
			[customerId]
		);

		results.total = totals.total;
		results.totalPages = Math.ceil(results.total / results.count);
		const res = await conn.query<CustomerScormDTO[] & RowDataPacket[]>(
			`
			SELECT scorm.id, scorm.name
			FROM scorm
			LEFT JOIN customer_scorm cs ON cs.customerid = ? AND cs.scormid = scorm.id
			WHERE cs.scormid IS NULL
			LIMIT ?, ?
			`,
			[customerId, options.page * options.limit, options.limit]
		);
		conn.release();
		results.results = res[0];
	} catch (e) {
		return null;
	} finally {
		conn.release();
		return results;
	}
};

const assignScorms = async (
	customerId: number,
	data: ScormAssignDTO
): Promise<boolean | unknown> => {
	const conn = await connection.getConnection();
	try {
		for (let scorm of data.scorms) {
			const res = await conn.query(
				`
			INSERT INTO customer_scorm (customerid, scormid, slots, duration) VALUES (?, ?, ?, ?)`,
				[customerId, scorm, data.values.slots, data.values.duration]
			);
		}
		return true;
	} catch (e) {
		return e;
	} finally {
		conn.release();
	}
};

const addUser = async (customerId: number, user: CustomerUserDTO) => {
	const conn = await connection.getConnection();
	try {
		const res = await conn.query(
			`INSERT INTO customer_user (
                    customerid, username, password, first_name, 
                    last_name, full_name, email, user_group, 
                    license_start, license_end, status
                    ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?)`,
			[
				customerId,
				user.username,
				null,
				user.firstName,
				user.lastName,
				user.fullName,
				user.email,
				user.userGroup,
				user.license_start,
				user.license_end,
				1,
			]
		);
		return res;
	} catch (e) {
		return null;
	} finally {
		conn.release();
	}
};

interface StudentsReportRow {
	ean: string;
	name: string;
	full_name: string;
	primer: Date;
	ultimo: Date;
}

const getCustomerStudentsReport = async (
	customerId: number,
	month: number,
	year: number
): Promise<Buffer> => {
	const conn = await connection.getConnection();
	let result: StudentsReportRow[] = [];
	try {
		const res = await conn.query<StudentsReportRow[] & RowDataPacket[]>(
			`SELECT
					s.ean, s.name, cu.full_name, DATE_FORMAT(MIN(d.created_on), '%d/%m/%Y %H:%i') primer, DATE_FORMAT(MAX(d.created_on), '%d/%m/%Y %H:%i') ultimo
					FROM customer_user cu
					JOIN cmidata d ON d.customeruserid = cu.id
					JOIN scorm_item si ON si.id = d.scormitemid
					JOIN customer_scorm cs ON cs.scormid = si.scorm_id
					JOIN scorm s ON s.id = cs.scormid
					WHERE cu.customerid = ? AND (EXTRACT(MONTH FROM d.created_on) BETWEEN ? AND ?) AND EXTRACT(YEAR FROM d.created_on) = ?
					GROUP BY s.ean, s.name, cu.full_name`,
			[customerId, month + 1, month + 2, year]
		);

		const rows = res[0].map((row) => {
			return row;
		});

		result = rows;
	} catch (e) {
		result = [];
	} finally {
		conn.release();

		const wb = await createWorkbook();
		let rowIndex = 1;
		const ws = wb.addWorksheet("sheet 1");
		ws.column(1).setWidth(15);
		ws.column(2).setWidth(75);
		ws.column(3).setWidth(33);
		ws.column(4).setWidth(17);
		ws.column(5).setWidth(17);

		ws.cell(1, 1).string("EAN");
		ws.cell(1, 2).string("Producto");
		ws.cell(1, 3).string("Alumno");
		ws.cell(1, 4).string("Primer acceso");
		ws.cell(1, 5).string("Último acceso");

		result.forEach((row, index) => {
			try {
				ws.cell(index + 2, 1).string(row.ean);
				ws.cell(index + 2, 2).string(row.name);
				ws.cell(index + 2, 3).string(row.full_name);
				ws.cell(index + 2, 4).string(row.primer);
				ws.cell(index + 2, 5).string(row.ultimo);
			} catch (e) {}
		});

		return await wb.writeToBuffer();
	}
};

interface UsageReportRow {
	ean: string;
	name: string;
	alumnos: number;
	price: number;
	subtotal: number;
}

const getCustomerUsageReport = async (
	customerId: number,
	month: number,
	year: number
): Promise<Buffer> => {
	const conn = await connection.getConnection();
	let result: UsageReportRow[] = [];
	try {
		const res = await conn.query<UsageReportRow[] & RowDataPacket[]>(
			`SELECT
				DISTINCT s.EAN ean, s.name, COUNT(DISTINCT cu.id) alumnos, s.price, s.price * COUNT(distinct cu.id) subtotal
				FROM customer c
				JOIN customer_scorm cs ON cs.customerid = c.id
				JOIN scorm s ON s.id = cs.scormid
				JOIN customer_user cu ON cu.customerid = c.id
				JOIN cmidata d ON d.customeruserid = cu.id-- AND d.action = 'RegisterContext'
				WHERE cu.first_name <> '' AND cu.first_name IS NOT NULL AND s.EAN IS NOT NULL AND c.id = ?
				AND (EXTRACT(MONTH FROM d.created_on) BETWEEN ? AND ?) AND EXTRACT(YEAR FROM d.created_on) = ?
				GROUP BY s.ean, d.customeruserid, s.id, DATE(d.created_on)`,
			[customerId, month + 1, month + 2, year]
		);

		const rows = res[0].map((row) => {
			row.alumnos = Number("" + row.alumnos);
			row.price = Number("" + row.price);
			row.subtotal = Number("" + row.subtotal);
			return row;
		});

		result = rows;
	} catch (e) {
		result = [];
	} finally {
		conn.release();

		const wb = await createWorkbook();
		let rowIndex = 1;
		const ws = wb.addWorksheet("sheet 1");
		ws.column(1).setWidth(15);
		ws.column(2).setWidth(75);
		ws.column(3).setWidth(17);
		ws.column(4).setWidth(17);
		ws.column(5).setWidth(17);

		ws.cell(1, 1).string("EAN");
		ws.cell(1, 2).string("Producto");
		ws.cell(1, 3).string("Nº Alumnos");
		ws.cell(1, 4).string("PVP");
		ws.cell(1, 5).string("Subtotal");

		result.forEach((row, index) => {
			try {
				ws.cell(index + 2, 1).string(row.ean);
				ws.cell(index + 2, 2).string(row.name);
				ws.cell(index + 2, 3).number(row.alumnos);
				ws.cell(index + 2, 4).number(row.price);
				ws.cell(index + 2, 5).number(row.subtotal);
			} catch (e) {}
		});

		return await wb.writeToBuffer();
	}
};

export {
	getCustomers,
	getCustomer,
	getCustomerStats,
	addCustomer,
	deleteCustomer,
	getCustomerScorms,
	getCustomerUsers,
	addUser,
	getAvailableScorms,
	assignScorms,
	getCustomerStudentsReport,
	getCustomerUsageReport,
};
