export interface ScormResource {
	id: number;
	guid: string;
	identifier: string;
	type: string;
	href: string;
	scormType: string;
	files?: string[];
}

export interface ScormItem {
	id: number;
	guid: string;
	name: string;
	resource: ScormResource;
}

export interface ScormDetailDTO {
	id: number;
	guid: string;
	name: string;
	status: boolean;
	items: ScormItem[];
}
