function fakeAuth(req, res, next) {
    const apiKey = req.header('X-API-Key');

    if (!apiKey || apiKey !== 'secret123') {
        return next(new HttpError(401, 'Unauthorized: Invalid or missing API Key'));
    }

    next();
}