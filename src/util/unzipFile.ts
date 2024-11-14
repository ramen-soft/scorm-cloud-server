import fs from "fs";
import path from "path";
import jszip from "jszip";

export const unzipFile = (zip: jszip, destPath: string) => {
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
