import { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

export const verifyToken = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const token = req.cookies["token"];
	if (token == null) {
		res.status(401).json({ message: "Token not provided" });
		return;
	}

	try {
		const payload = jwt.verify(token, process.env.TOKEN_SECRET as string);
		console.log(payload);
		next();
	} catch (error) {
		res.status(403).json({ message: "Invalid token" });
		return;
	}
};
