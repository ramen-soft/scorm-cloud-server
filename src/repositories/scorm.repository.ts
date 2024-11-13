import { ResultSetHeader, RowDataPacket } from "mysql2";
import { BaseRepository } from "../lib/baserepository";
import { connection } from "../lib/db";
import { IScorm, IScormManifest } from "../module/scorm/model";
import { v4 as uuid } from "uuid";

export class ScormRepository extends BaseRepository<IScorm> {
	find(item: IScorm): Promise<IScorm[]> {
		return new Promise((resolve, reject) => {
			connection.getConnection().then((conn) => {
				const rows = conn
					.query<IScorm[] & RowDataPacket[]>(`SELECT * FROM scorm`)
					.then((e) => resolve(e[0]));
			});
		});
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
