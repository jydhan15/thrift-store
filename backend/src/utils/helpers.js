exports.ok = (res, data, meta, status = 200) => res.status(status).json({
  success: true, data, ...(meta && { meta }),
  ...(res.locals && res.locals.requestId && { requestId: res.locals.requestId }),
});
exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.pageParams = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit) || 10, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};
