export interface IRead<T> {
	find(item: T): Promise<T[]>;
}
