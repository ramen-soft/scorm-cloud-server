import { ResultSetHeader, RowDataPacket } from "mysql2";
import { BaseRepository } from "../lib/baserepository";
import { connection } from "../lib/db";
import { IScorm, IScormManifest } from "../module/scorm/model";
import { v4 as uuid } from "uuid";
import { PaginatedRequest } from "../util/pagination.model";
import { ScormDTO } from "../module/scorm/dto/ScormList.dto";
import { ScormDetailDTO, ScormItem } from "../module/scorm/dto/ScormDetail.dto";

export class ScormRepository extends BaseRepository<IScorm> {
	async countAll(): Promise<number> {
		const conn = await connection.getConnection();

		const [[res]] = await conn.query<ResultSetHeader & [{ total: number }]>(
			`SELECT COUNT(1) total FROM scorm`
		);
		conn.release();
		return res.total;
	}

	async findAll(options: PaginatedRequest): Promise<ScormDTO[]> {
		const conn = await connection.getConnection();
		const rows = await conn.query<ScormDTO[] & RowDataPacket[]>(
			`SELECT id, guid, name, status FROM scorm LIMIT ?, ?`,
			[options.page * options.limit, options.limit]
		);
		conn.release();
		return rows[0];
	}

	async findOne(id: number) {
		const conn = await connection.getConnection();
		const [[row]] = await conn.query<RowDataPacket[]>(
			`SELECT * from scorm WHERE id = ?`,
			[id]
		);
		let detail: ScormDetailDTO;
		if (row) {
			detail = {
				id: row.id,
				guid: row.guid,
				name: row.name,
				status: Boolean(row.status),
				items: [],
			};

			const [items] = await conn.query<RowDataPacket[]>(
				`SELECT i.id, i.title, r.id res_id, r.identifier, r.type, r.href, r.scormtype FROM scorm_item i JOIN scorm_resource r ON r.item_id = i.id WHERE i.scorm_id = ?`,
				[id]
			);

			detail.items = items.map<ScormItem>((item) => {
				const ret: ScormItem = {
					id: item.id,
					name: item.title,
					resource: {
						id: item.res_id,
						identifier: item.identifier,
						href: item.href,
						scormType: item.scormType,
						type: item.type,
						files: [],
					},
				};
				return ret;
			});

			detail.items = await Promise.all(
				detail.items.map(async (item) => {
					const [files] = await conn.query<
						RowDataPacket[] & string[]
					>(`SELECT href FROM scorm_file WHERE resource_id = ?`, [
						item.id,
					]);
					item.resource.files = files;
					return item;
				})
			);
			conn.release();
			return detail;
		}
		await conn.release();
		return null;
	}

	async createFromManifest(guid: string, manifest: IScormManifest) {
		const conn = await connection.getConnection();
		const res = await conn.execute<ResultSetHeader>(
			`INSERT INTO scorm (guid, name, status, manifest) VALUES (?, ?, ?, ?)`,
			[guid, manifest.title, 1, JSON.stringify(manifest)]
		);
		const scormId = res[0].insertId;

		manifest.organizations[0].items.forEach(async (item) => {
			const res = await conn.query<ResultSetHeader>(
				`INSERT INTO scorm_item (scorm_id, resource, identifier, title, score) VALUES (?, ?, ?, ?, ?)`,
				[
					scormId,
					item.identifierRef,
					item.identifier,
					item.title,
					item.score ?? 0,
				]
			);
			const itemId = res[0].insertId;

			const resource = manifest.resources.find(
				(res) => res.identifier === item.identifierRef
			);

			if (resource) {
				const res = await conn.query<ResultSetHeader>(
					`INSERT INTO scorm_resource (item_id, identifier, type, href, scormtype) VALUES (?, ?, ?, ?, ?)`,
					[
						itemId,
						resource.identifier,
						resource.type,
						resource.href,
						resource.scormType,
					]
				);

				const resourceId = res[0].insertId;

				resource.files.forEach(async (file) => {
					const res = await conn.query(
						`INSERT INTO scorm_file (resource_id, href) VALUES (?, ?)`,
						[resourceId, file]
					);
				});
			}
		});
	}
}
