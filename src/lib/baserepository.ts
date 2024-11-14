import { IRead } from "./interfaces/read";
import { IWrite } from "./interfaces/write";

export abstract class BaseRepository<T> implements IWrite<T>, IRead<T> {
	create(item: T): Promise<boolean> {
		throw new Error("Method not implemented.");
	}
	update(id: number, item: T): Promise<boolean> {
		throw new Error("Method not implemented.");
	}
	delete(id: number): Promise<boolean> {
		throw new Error("Method not implemented.");
	}
	find(item: T): Promise<T[]> {
		throw new Error("Method not implemented.");
	}
}
