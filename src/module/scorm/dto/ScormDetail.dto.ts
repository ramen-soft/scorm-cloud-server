export interface ScormResource {
	id: number;
	identifier: string;
	type: string;
	href: string;
	scormType: string;
	files?: string[];
}

export interface ScormItem {
	id: number;
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
