import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
dotenv.config();
import scormController from "./module/scorm/controller";
import customerController from "./module/customer/controller";
import { errorHandler } from "./middlewares/error.middleware";
import { ScormRepository } from "./repositories/scorm.repository";
import { renderFile } from "ejs";
import fs from "fs";
import { connection } from "./lib/db";
import { CustomerRepository } from "./repositories/customer.repository";
import { createWorkbook } from "./services/excel";
import { verifyToken } from "./middlewares/auth.middleware";
import jwt from "jsonwebtoken";
import { addUser, findUser } from "./module/customer/service";

const app = express();

app.set("view engine", "ejs");

const port = process.env.PORT ?? 3000;

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: "http://localhost:5173" }));

app.use("/scorms", verifyToken, scormController);

app.use("/customers", verifyToken, customerController);

app.get("/", (req: Request, res: Response) => {
	console.log(req.query);
	res.status(200).json({
		message: "Hello World",
	});
});

app.post("/login", (req: Request, res: Response) => {
	const username = req.body.user;
	const password = req.body.pass;
	if (!username || !password) {
		res.status(400);
		throw new Error("Username and password are required");
	}
	if (username === "admin" && password === "123456") {
		const token = jwt.sign(
			{ username },
			process.env.TOKEN_SECRET as string,
			{ expiresIn: "1h" }
		);
		res.cookie("token", token, { httpOnly: true, secure: true });
		res.status(200).json({ logged: true, username });
	} else {
		res.status(401);
		throw new Error("Authentication failed");
	}
});

app.get("/protected", verifyToken, (req: Request, res: Response) => {
	res.status(200).send("Todo bien");
});

app.get("/scorm_contents/*", (req: Request, res: Response) => {
	const path = req.params[0];
	res.sendFile(process.env.UPLOAD_DIR + "/" + path);
	return;

	if (fs.existsSync(process.env.UPLOAD_DIR + "/" + path)) {
		const content = fs.readFileSync(process.env.UPLOAD_DIR + "/" + path, {
			encoding: "binary",
		});
		res.send(content);
	} else {
		res.status(404).send("404 not found");
	}
});

app.post("/", async (req: Request, res: Response, next: NextFunction) => {
	let { username, fullname } = req.body;
	const { prod, content, lms, client, referer: fullReferer } = req.query;

	if (Boolean(lms) && !username) {
		res.status(500).end("No se han recibido datos del alumno");
		return;
	}
	if (!fullname) {
		fullname = username;
	}

	const repo = new ScormRepository();
	try {
		const scorm = await repo.findByGUID(String(req.query["prod"]));
		if (!scorm) {
			res.status(404).end("No se encontró el contenido (" + prod + ")");
			return;
		}
		if (!content) {
			res.status(404).end(`Recurso no encontrado (${content})`);
			return;
		}

		const resource = scorm.items.find(
			(item) => item.resource.guid === content
		)?.resource;

		if (!resource) {
			res.status(404).end(`Recurso no encontrado (${content})`);
			return;
		}

		const refererURL = new URL(String(fullReferer));
		const parts = refererURL.pathname.split("/");
		parts.pop();
		const referer =
			refererURL.protocol + "//" + refererURL.host + parts.join("/");

		if (!client && !fullReferer) {
			res.status(500).end(
				`No se ha recibido id. de cliente ni referer. No se puede identificar el acceso.`
			);
			return;
		}

		if (!client) {
			res.status(500).end(`No se ha recibido id. de cliente`);
			return;
		}

		const customer = await new CustomerRepository().findByGUID(
			String(client)
		);

		if (customer && customer.id) {
			if (!(await findUser(customer.id, username))) {
				await addUser(customer.id, {
					username,
					firstName: fullname.split(" ")[0],
					lastName: "",
					fullName: fullname,
					email: username,
					license_start: null,
					license_end: null,
					status: true,
				});
			}
		}

		const content_uri = `scorm_contents/${scorm.guid}/${resource.href}`;
		const item_id = resource.id;

		res.render("index", {
			user: { id: 1 },
			ref: referer,
			content_uri,
			item_id,
			username: username,
		});
	} catch (e) {
		next(e);
	}
});

app.get(
	"/reports",
	verifyToken,
	async (req: Request, res: Response, next: NextFunction) => {
		const wb = await createWorkbook();
		res.writeHead(200, {
			"Content-Disposition": `attachment; filename="report_accesos.xlsx"`,
			"Content-Type":
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		res.end(wb);
	}
);

app.post("/log", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { userid, itemid, tag, key, value } = req.body;
		const conn = await connection.getConnection();
		conn.query(
			"INSERT INTO cmidata (customeruserid, scormitemid, action, `key`, `value`) VALUES (?, ?, ?, ?, ?)",
			[userid, itemid, tag, String(key).substring(0, 256), value]
		);
		conn.release();
		res.send({ logged: true });
	} catch (e) {
		next(e);
	}
});

app.use(errorHandler);

app.listen(port, () => {
	console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
