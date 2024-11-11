import { NextFunction, Request, Response } from "express";

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (res.headersSent) {
        return next(err);
    }
    if (res.statusCode == 200) {
        res.status(500);
    }
    res.send({
        error: true,
        message: err.message || "unknown error",
    });
};
