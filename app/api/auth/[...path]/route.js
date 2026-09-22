import { getAuth } from "../../../../lib/auth.js";
export const dynamic = "force-dynamic";
const handle = async (req, ctx) => getAuth().handler()[req.method](req, ctx);
export const GET = handle,
  POST = handle,
  PUT = handle,
  DELETE = handle,
  PATCH = handle;
