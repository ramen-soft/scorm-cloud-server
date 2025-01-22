export interface PaginatedRequest {
	page: number;
	limit: number;
}

export type ResultsPagination<T> = {
	page: number;
	count: number;
	total: number;
	totalPages: number;
	results: T[];
};
