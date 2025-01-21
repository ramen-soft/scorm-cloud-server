export interface CustomerDTO {
	id?: number;
	guid: string;
	cif: string;
	name: string;
	description: string;
	active: boolean;
	origins: string[];
	created_on: Date;
	updated_on?: Date;
}
