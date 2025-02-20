import { NextFunction, Request, Response, Router } from "express";
import multer, { memoryStorage } from "multer";
import { analizarScorm, createConnector } from "./funcs";
import { ScormRepository } from "../../repositories/scorm.repository";
import jszip from "jszip";
import { v4 as uuid } from "uuid";
import { PaginatedRequest } from "../../util/pagination.model";
import { getScorms } from "./service";
import { unzipFile } from "../../util/unzipFile";
import { CustomerRepository } from "../../repositories/customer.repository";

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
	const cust = new CustomerRepository();
	const customerInfo = await cust.find(Number(customer));
	const result = await repo.findOne(id);

	if (result) {
		const disposition = `attachment; filename="${result.name}_connector.zip"`;
		res.setHeader("Content-Disposition", disposition);
		res.setHeader("Content-Type", "application/zip");
		(await createConnector(String(customerInfo.guid) || "", result)).pipe(
			res
		);
		return;
	}
	res.status(404).send({ error: true, message: "Scorm no encontrado" });
};
router.get("/:id/connector", getConnector);

const VALID_ZIP_MIMETYPES = [
	"application/zip",
	"application/x-zip",
	"application/x-zip-compressed",
	"application/octet-stream",
	"application/x-compress",
	"application/x-compressed",
	"multipart/x-zip",
];

VALID_ZIP_MIMETYPES.find((mime) => "application-zip".localeCompare);

const uploadScorm = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const file = req.file;
		const price = req.body.price || 0;
		const ean = req.body.ean || null;
		if (!file) {
			res.status(500).send({
				error: true,
				message: "No se ha recibido ningún fichero",
			});
			return;
		}

		if (!VALID_ZIP_MIMETYPES.includes(file.mimetype.toLowerCase())) {
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

		try {
			const manifest = await analizarScorm(zipFile);

			const repo = new ScormRepository();
			const scormId = await repo.createFromManifest(
				guid,
				manifest,
				price,
				ean
			);

			res.status(200).send({ status: "ok", manifest, id: scormId });
		} catch (e) {
			res.status(500).send({
				error: true,
				message: (e as Error).message,
			});
			return;
		}
	} catch (e) {
		next(e);
	}
};
router.post("/upload", scormUploader.single("scorm"), uploadScorm);

const updateScorm = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = req.body.id;
		const price = req.body.price || 0;
		const ean = req.body.ean || null;

		try {
			const repo = new ScormRepository();
			await repo.updateScorm(id, price, ean);

			res.status(200).send({ status: "ok", id: Number(id) });
		} catch (e) {
			res.status(500).send({
				error: true,
				message: (e as Error).message,
			});
			return;
		}
	} catch (e) {
		next(e);
	}
};
router.post("/update", scormUploader.none(), updateScorm);

export default router;
