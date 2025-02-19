import { NextFunction, Request, Response, Router } from "express";
import { PaginatedRequest } from "../../util/pagination.model";
import {
	addCustomer,
	addUser,
	assignScorms,
	deleteCustomer,
	getAvailableScorms,
	getCustomer,
	getCustomers,
	getCustomerScorms,
	getCustomerStats,
	getCustomerUsers,
} from "./service";
import { CustomerDTO } from "./dto/CustomerDTO";
import { ResultSetHeader } from "mysql2";
import { ScormAssignDTO } from "./dto/ScormAssignDTO";

const router = Router();

const getCustomerReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const id = Number(req.params["id"]);
		const customer = await getCustomer(id);
		if (!customer) {
			res.status(404);
			throw new Error("Customer not found");
		}
		res.status(200).send(customer);
	} catch (e) {
		next(e);
	}
};
router.get("/:id", getCustomerReq);

const getCustomerStatsReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const id = Number(req.params["id"] || 0);
	const stats = await getCustomerStats(id);
	res.status(200).send(stats);
};
router.get("/:id/stats", getCustomerStatsReq);

const listAllCustomers = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const pagination: PaginatedRequest = {
		page: +(req.query.page || 0),
		limit: +(req.query.limit || 15),
	};
	const customers = await getCustomers(pagination);
	res.status(200).send(customers);
};
router.get("/", listAllCustomers);

const addCustomerReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const customer: CustomerDTO = req.body;

	try {
		const [result, err] = await addCustomer(customer);
		console.log(result);
		if (!err) {
			customer.id = customer.id || (result as ResultSetHeader).insertId;
			res.status(200).send(customer);
		} else {
			res.status(503).send(err);
		}
	} catch (e) {
		next(e);
	}
};
router.post("/", addCustomerReq);

const deleteCustomerReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const customer: CustomerDTO = await getCustomer(
			Number(req.params["id"])
		);
		if (!customer) {
			res.status(404);
			throw new Error("Customer not found");
		}
		await deleteCustomer(customer);
		res.status(200).send({ id: customer.id, deleted: true });
	} catch (e) {
		next(e);
	}
};
router.delete("/:id", deleteCustomerReq);

const getCustomerScormsReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const pagination: PaginatedRequest = {
		page: +(req.query.page || 0),
		limit: +(req.query.limit || 15),
	};
	const scorms = await getCustomerScorms(
		Number(req.params["customer"]),
		pagination
	);
	res.status(200).send(scorms);
};
router.get("/:customer/scorms", getCustomerScormsReq);

const getCustomerUsersReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const pagination: PaginatedRequest = {
		page: +(req.query.page || 0),
		limit: +(req.query.limit || 15),
	};

	const users = await getCustomerUsers(
		Number(req.params["customer"]),
		pagination
	);
	res.status(200).send(users);
};
router.get("/:customer/users", getCustomerUsersReq);

const addUserReq = async (req: Request, res: Response, next: NextFunction) => {
	const result = await addUser(Number(req.params["customer"]), req.body);
	res.status(200).send(result);
};
router.post("/:customer/user", addUserReq);

const getAvailableScormsReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const pagination: PaginatedRequest = {
		page: +(req.query.page || 0),
		limit: +(req.query.limit || 15),
	};
	const scorms = await getAvailableScorms(
		Number(req.params["customer"]),
		pagination
	);
	res.status(200).send(scorms);
};
router.get("/:customer/available_scorms", getAvailableScormsReq);

const assignScormsReq = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { customer: customerId } = { customer: Number(req.params.customer) };
	const data: ScormAssignDTO = req.body;
	console.log(data);
	const result = await assignScorms(customerId, data);
	if (result === true) {
		res.status(200).send({ done: true });
	} else {
		console.log(result);
		res.status(500).send({ done: false });
	}
};
router.post("/:customer/assign_scorms", assignScormsReq);

export default router;
