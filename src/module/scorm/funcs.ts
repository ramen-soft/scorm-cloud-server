import jszip from "jszip";
import fs from "fs";
import { parseStringPromise } from "xml2js";
import { v4 as uuid } from "uuid";
import {
	IScormManifest,
	IScormOrganization,
	IScormOrganizationItem,
	IScormResource,
} from "./model";
import { ScormDetailDTO } from "./dto/ScormDetail.dto";

export const analizarScorm = async (loaded: jszip) => {
	const manifestXML = await loaded.file("imsmanifest.xml")?.async("string");

	if (!manifestXML) {
		throw new Error("El SCORM no contiene un manifiesto válido.");
	}

	const xml: any = await parseStringPromise(manifestXML, {});

	const { manifest } = xml;
	const { organizations, resources } = manifest;

	let parsedManifest: IScormManifest = {
		identifier: manifest.$.identifier,
		version: manifest.$.version,
		schema: manifest.metadata[0].schema[0],
		multisco: false,
		organizations: [],
		resources: [],
		title: manifest.organizations[0].organization[0].title[0],
	};

	const [orgsdata] = organizations;

	// leemos las distintas organizaciones:
	orgsdata.organization.forEach((data: any) => {
		const org: IScormOrganization = {
			title: data.title[0],
			items: data.item.map((item: any) => {
				const it: IScormOrganizationItem = {
					guid: uuid(),
					identifier: item.$.identifier,
					title: item.title[0],
					score: item["adlcp:masteryscore"]?.[0],
					identifierRef: item.$.identifierref,
				};
				return it;
			}),
		};
		parsedManifest.organizations.push(org);
	});

	const [resdata] = resources;
	resdata.resource.forEach((data: any) => {
		let res: IScormResource = {
			guid: uuid(),
			type: data.$.type,
			scormType: data.$["adlcp:scormtype"],
			href: data.$.href,
			identifier: data.$.identifier,
			files: [],
		};

		if (data.file && data.file.length) {
			res.files = data.file.map((row: any) => row.$.href);
		}
		parsedManifest.resources.push(res);
	});

	if (parsedManifest.resources.length > 1) {
		parsedManifest.multisco = true;
	}

	return parsedManifest;
};

const CONNECTOR_BASEFILES = [
	"adlcp_rootv1p2.xsd",
	"easyXDM.min.js",
	"easyxdm.swf",
	"ims_xml.xsd",
	"redirect.html",
	"imscp_rootv1p1p2.xsd",
	"imsmd_rootv1p1p2.xsd",
	"imsmd_rootv1p2p1.xsd",
	"jquery-1.6.1.min.js",
	"json2.js",
	"proxy.html",
	"SCORM_API.js",
	"SCORM_wrapper.html",
];

export const createConnector = async (
	customerGUID: string = "",
	scorm: ScormDetailDTO
) => {
	return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
		const zip = jszip();

		const outFile = process.env.CONNECTOR_OUTPUT_DIR + "/out.zip";

		CONNECTOR_BASEFILES.forEach((file) => {
			const path = process.env.BASE_CONNECTOR_DIR + "/" + file;
			if (fs.existsSync(path)) {
				if (file.localeCompare("redirect.html") === 0) {
					let content = fs.readFileSync(path, {
						encoding: "utf-8",
					});

					//sustituimos la template string del cliente:
					//si no hay cliente, la vaciamos:
					content = content.replace("#@CLIENT_GUID@#", customerGUID);
					content = content.replace(
						/#@SCORM_PLAYER_URL@#/g,
						"" + process.env.SCORM_PLAYER_URL
					);

					zip.file(file, content);
				} else {
					const content = fs.readFileSync(path);
					zip.file(file, content);
				}
			}
		});

		zip.file("imsmanifest.xml", createManifest(scorm));
		const stream = zip.generateNodeStream({
			type: "nodebuffer",
			streamFiles: true,
		});

		resolve(
			zip.generateNodeStream({ type: "nodebuffer", streamFiles: true })
		);
		/*
		zip.generateNodeStream({ type: "nodebuffer", streamFiles: true })
		.pipe(fs.createWriteStream(outFile))
		.on("finish", () => resolve(true));
		*/
	});
};

export const createManifest = (scorm: ScormDetailDTO) => {
	const items = scorm.items.map(
		(item) => `
		<item identifier="${item.guid}" isvisible="true" identifierref="${item.resource.guid}">
			<title><![CDATA[${item.name}]]></title>
		</item>
	`
	);
	const resources = scorm.items.map(
		(item) => `
		<resource identifier="${item.resource.guid}" type="${item.resource.type}" href="proxy.html?data=${scorm.guid}|${item.resource.guid}" adlcp:scormtype="sco">
			<file href="proxy.html" />
			<file href="jquery-1.6.1.min.js" />
			<file href="SCORM_API.js" />
		</resource>
	`
	);

	const manifest = `<?xml version="1.0" encoding="UTF-8"?>
	<manifest xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="MANIFEST-${scorm.guid}" version="1" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd	http://www.imsglobal.org/xsd/imsmd_rootv1p2p1.xsd	http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
		<metadata>
			<schema>ADL SCORM</schema>
			<schemaversion>1.2</schemaversion>
		</metadata>
		<organizations default="ORG-DEFAULT">
			<organization identifier="ORG-DEFAULT" structure="hierarchical">
				<title><![CDATA[${scorm.name}]]></title>
				${items}
			</organization>
		</organizations>
		<resources>
		${resources}
		</resources>
	</manifest>
	`;
	return manifest;
};
