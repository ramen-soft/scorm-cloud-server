import jszip from "jszip";
import { parseString, parseStringPromise } from "xml2js";
import {
	IScormManifest,
	IScormOrganization,
	IScormOrganizationItem,
	IScormResource,
} from "./model";

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
