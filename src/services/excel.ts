const Excel = require("excel4node");

export const createWorkbook = () => {
	const wb = new Excel.Workbook();
	wb.addWorksheet("sheet 1");
	wb.write("output/file.xlsx");
};
