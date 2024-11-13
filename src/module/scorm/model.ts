export interface IScorm {
	id?: number;
	name: string;
}

export interface IScormOrganizationItem {
	id?: string;
	identifier: string;
	title: string;
	score?: number;
	identifierRef: string;
}

export interface IScormOrganization {
	title: string;
	items: IScormOrganizationItem[];
}

export interface IScormResource {
	id?: string;
	identifier: string;
	type: string;
	scormType?: string;
	href: string;
	files: string[];
}

export interface IScormManifest {
	identifier: string;
	version: string;
	schema: string;
	title: string;
	organizations: IScormOrganization[];
	resources: IScormResource[];
	multisco: boolean;
	scormId?: number;
}
