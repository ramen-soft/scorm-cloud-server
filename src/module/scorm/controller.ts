import { NextFunction, Request, Response, Router } from "express";
import { IScorm } from "./model";
import multer, { memoryStorage } from "multer";
import { analizarScorm } from "./funcs";
import { ScormRepository } from "../../repositories/scorm.repository";
import jszip from "jszip";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

const zip = jszip();

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

const unzipFile = (zip: jszip, destPath: string) => {
	if (!fs.existsSync(destPath)) {
		fs.mkdirSync(destPath);
	}
	Object.keys(zip.files).forEach((filename) => {
		zip.file(filename)
			?.async("nodebuffer")
			.then((content) => {
				const dest = destPath + "/" + filename;
				const dir = path.dirname(dest);

				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}

				fs.writeFileSync(dest, content);
			});
	});
};

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
