/** Request context stored with sessions and audit entries. */
export const requestMeta = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 300),
});
