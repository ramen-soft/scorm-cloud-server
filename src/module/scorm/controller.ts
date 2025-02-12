import { NextFunction, Request, Response, Router } from "express";
import multer, { memoryStorage } from "multer";
import { analizarScorm, createConnector } from "./funcs";
import { ScormRepository } from "../../repositories/scorm.repository";
import jszip from "jszip";
import { v4 as uuid } from "uuid";
import { PaginatedRequest } from "../../util/pagination.model";
import { getScorms } from "./service";
import { unzipFile } from "../../util/unzipFile";

const zip = jszip();

const router = Router();

const scormUploader = multer({ storage: memoryStorage() });

const listAllScorms = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const pagination: PaginatedRequest = {
		page: +(req.query.page || 0),
		limit: +(req.query.limit || 15),
	};
	const scorms = await getScorms(pagination);
	res.status(200).send(scorms);
};
router.get("/", listAllScorms);

const getScormInfo = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const repo = new ScormRepository();
	const result = await repo.findOne(Number(req.params["id"]));
	if (result) {
		res.status(200).send(result);
	} else {
		res.status(404);
		next(new Error("SCORM no encontrado"));
	}
};
router.get("/:id", getScormInfo);

const getConnector = async (req: Request, res: Response) => {
	const id = Number(req.params["id"]);
	const { customer } = req.query;
	const repo = new ScormRepository();
	const result = await repo.findOne(id);

	if (result) {
		const disposition = `attachment; filename="${result.name}_connector.zip"`;
		res.setHeader("Content-Disposition", disposition);
		res.setHeader("Content-Type", "application/zip");
		(await createConnector(String(customer) || "", result)).pipe(res);
		return;
	}
	res.status(404).send({ error: true, message: "Scorm no encontrado" });
};
router.get("/:id/connector", getConnector);

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

		let zipFile: jszip;
		const guid = uuid();
		try {
			zipFile = await zip.loadAsync(file.buffer);

			unzipFile(zipFile, process.env.UPLOAD_DIR + "/" + guid);
		} catch (e) {
			res.status(500).send({
				error: true,
				message: "Error al descomprimir el fichero ZIP",
			});
			return;
		}

		const manifest = await analizarScorm(zipFile);

		const repo = new ScormRepository();
		repo.createFromManifest(guid, manifest);

		res.status(200).send({ status: "ok", manifest });
	} catch (e) {
		next(e);
	}
};
router.post("/upload", scormUploader.single("scorm"), uploadScorm);

export default router;
