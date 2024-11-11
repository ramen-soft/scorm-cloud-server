import { NextFunction, Request, Response, Router } from "express";
import { IScorm } from "./model";
import multer, { memoryStorage } from "multer";
import { analizarScorm } from "./funcs";

const router = Router();

const scormUploader = multer({ storage: memoryStorage() });

const listAllScorms = (req: Request, res: Response) => {
	const scorms: IScorm[] = [];
	res.status(200).send(scorms);
};
router.get("/", listAllScorms);

const getScormInfo = (req: Request, res: Response) => {
	const scorm: IScorm = { id: Number(req.params["id"]), name: "bleh" };
	res.status(200).send(scorm);
};
router.get("/:id", getScormInfo);

const uploadScorm = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const file = req.file;
		if (file?.mimetype.localeCompare("application/zip") != 0) {
			res.status(500).send({
				error: true,
				message: "El archivo debe ser un fichero ZIP",
			});
			return;
		}

		const manifest = await analizarScorm(file.buffer);

		res.status(200).send({ status: "ok", manifest });
	} catch (e) {
		next(e);
	}
};
router.post("/upload", scormUploader.single("scorm"), uploadScorm);

export default router;
