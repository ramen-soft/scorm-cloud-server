export interface CustomerUserDTO {
	id?: number;
	username: string;
	firstName: string;
	lastName: string;
	fullName: string;
	email: string;
	userGroup?: number;
	license_start: Date | null;
	license_end: Date | null;
	status: boolean;
}
