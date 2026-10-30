const supabase = require("../config/supabase");

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) return res.status(401).json({ message: "Authentication is required." });

  supabase.auth.getUser(match[1])
    .then(({ data, error }) => {
      if (error || !data.user) return res.status(401).json({ message: "Invalid or expired authentication token." });
      req.user = data.user;
      req.accessToken = match[1];
      return next();
    })
    .catch((error) => {
      console.error("Authentication verification failed:", error.message);
      return res.status(401).json({ message: "Authentication could not be verified." });
    });
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication is required." });
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("role, is_active")
      .eq("id", req.user.id)
      .maybeSingle();
    if (error) {
      console.error("Role lookup failed:", error.message);
      return res.status(503).json({ message: "Authorization is temporarily unavailable." });
    }
    if (!profile || profile.is_active === false) return res.status(403).json({ message: "Your account is not authorized to use Inventra." });
    if (!allowedRoles.includes(profile.role)) return res.status(403).json({ message: "You do not have permission to perform this action." });
    req.userRole = profile.role;
    return next();
  };
}

module.exports = { requireAuth, requireRole };
