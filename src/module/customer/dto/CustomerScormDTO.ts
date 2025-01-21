import { ScormDTO } from "../../scorm/dto/ScormList.dto";

export type CustomerScormDTO = ScormDTO & {
	slots: number;
	duration: number;
	created_on: Date;
};
