import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
dotenv.config();
import scormController from "./module/scorm/controller";
import { errorHandler } from "./middlewares/error.middleware";
import { ScormRepository } from "./repositories/scorm.repository";
const app = express();

const port = process.env.PORT ?? 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: "http://localhost:5173" }));

app.use("/scorms", scormController);

app.get("/", (req: Request, res: Response) => {
	console.log(req.query);
	res.status(200).json({
		message: "Hello World",
	});
});

app.post("/", (req: Request, res: Response) => {
	const { username, fullname } = req.body;
	const { prod, content, lms, referer } = req.query;
	console.log(req.params, {
		prod,
		content,
		lms,
		referer,
		username,
		fullname,
	});

	const repo = new ScormRepository();
	repo.findByGUID(String(req.query["prod"])).then((scorm) => {
		res.status(200).json(scorm);
	});
});

app.use(errorHandler);

app.listen(port, () => {
	console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
