import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
dotenv.config();
import scormController from "./module/scorm/controller";
import { errorHandler } from "./middlewares/error.middleware";
const app = express();

const port = process.env.PORT ?? 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: "http://localhost:5173" }));

app.use("/scorms", scormController);

app.get("/", (req: Request, res: Response) => {
	res.status(200).json({
		message: "Hello World",
	});
});
app.use(errorHandler);

app.listen(port, () => {
	console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
