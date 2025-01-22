import { ResultSetHeader } from "mysql2";
import { connection } from "../../lib/db";
import { ScormRepository } from "../../repositories/scorm.repository";
import {
	PaginatedRequest,
	ResultsPagination,
} from "../../util/pagination.model";
import { ScormDTO } from "./dto/ScormList.dto";

const getScorms = async (options: PaginatedRequest) => {
	let results: ResultsPagination<ScormDTO> = {
		page: options.page || 0,
		count: options.limit || 15,
		results: [],
		total: 0,
		totalPages: 0,
	};
	const repo = new ScormRepository();

	results.total = await repo.countAll();
	results.totalPages = Math.ceil(results.total / results.count);
	results.results = await repo.findAll(options);
	return results;
};

export { getScorms };
