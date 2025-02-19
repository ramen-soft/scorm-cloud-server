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
};
