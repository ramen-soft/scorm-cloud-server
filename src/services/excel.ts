const Excel = require("excel4node");

const data = [
	{
		ean: "9000002029369",
		producto:
			"Abordaje de conocimientos relacionados con las técnicas y procesos de lavado",
		alumno: "María del mar Jiménez Ravira",
		primer: "17/12/2024 20:47",
		ultimo: "17/12/2024 20:47",
	},
	{
		ean: "9000002029369",
		producto:
			"Abordaje de conocimientos relacionados con las técnicas y procesos de lavado",
		alumno: "María del mar Jiménez Ravira",
		primer: "17/12/2024 20:47",
		ultimo: "17/12/2024 20:47",
	},
	{
		ean: "9000002029369",
		producto:
			"Abordaje de conocimientos relacionados con las técnicas y procesos de lavado",
		alumno: "María del mar Jiménez Ravira",
		primer: "17/12/2024 20:47",
		ultimo: "17/12/2024 20:47",
	},
	{
		ean: "9000002029369",
		producto:
			"Abordaje de conocimientos relacionados con las técnicas y procesos de lavado",
		alumno: "María del mar Jiménez Ravira",
		primer: "17/12/2024 20:47",
		ultimo: "17/12/2024 20:47",
	},
];

export const createWorkbook = async () => {
	const wb = new Excel.Workbook();
	return wb;
	let row = 1;
	const ws = wb.addWorksheet("sheet 1");
	ws.column(1).setWidth(15);
	ws.column(2).setWidth(75);
	ws.column(3).setWidth(33);
	ws.column(4).setWidth(17);
	ws.column(5).setWidth(17);

	for (let info of data) {
		ws.cell(row, 1).string(info.ean);
		ws.cell(row, 2).string(info.producto);
		ws.cell(row, 3).string(info.alumno);
		ws.cell(row, 4).string(info.primer);
		ws.cell(row, 5).string(info.ultimo);
		row++;
	}
	return await wb.writeToBuffer();
};
