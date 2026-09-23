import {conversionState,conversionAction} from '../../../../lib/conversion/repository.js';
import { connectorState, connectorAction } from "../../../../lib/connectors/installations.js";
import { getAuth } from "../../../../lib/auth.js";
import {
  listWorkspaces,
  createWorkspace,
  state,
  mutate,
} from "../../../../lib/repository.js";
import { ZodError } from "zod";
export const dynamic = "force-dynamic";
function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
async function handle(req, ctx) {
  try {
    if (req.method === "POST") {
      const expected = process.env.APP_ORIGIN || new URL(req.url).origin;
      if (req.headers.get("origin") !== expected)
        return json({ error: "Origin not permitted" }, 403);
    }
    const { data: session } = await getAuth().getSession();
    if (!session?.user) return json({ error: "Sign in to continue" }, 401);
    const user = session.user.id;
    const { path } = await ctx.params;
    if (req.method === "GET") {
      if(path.length===3&&path[0]==="workspaces"&&path[2]==="conversion")return json(await conversionState(user,path[1]));
      if (path.join("/") === "workspaces")
        return json(await listWorkspaces(user));
      if (path.length === 3 && path[0] === "workspaces" && path[2] === "installation")
        return json(await connectorState(user, path[1]));
      if (path.length === 2 && path[0] === "workspaces")
        return json(await state(user, path[1]));
    }
    if (req.method === "POST") {
      if (Number(req.headers.get("content-length") || 0) > 250000)
        return json({ error: "Request too large" }, 413);
      const reader = req.body?.getReader();
      let size = 0;
      const chunks = [];
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 250000) {
            await reader.cancel();
            return json({ error: "Request too large" }, 413);
          }
          chunks.push(value);
        }
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "Expected a JSON object" }, 400);
      if(path.length===3&&path[0]==="workspaces"&&path[2]==="conversion")return json(await conversionAction(user,path[1],body));
      if (path.join("/") === "workspaces")
        return json(await createWorkspace(user, body), 201);
      if (path.length === 3 && path[0] === "workspaces" && path[2] === "installation")
        return json(await connectorAction(user, path[1], body));
      if (path.length === 3 && path[0] === "workspaces")
        return json(await mutate(user, path[1], path[2], body));
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e.message === "NOT_FOUND") return json({ error: "Not found" }, 404);
    if (e.message === "CONFLICT")
      return json(
        {
          error: "Rules changed in another session. Refresh before publishing.",
        },
        409,
      );
    if(e.message.startsWith("Conversion:"))return json({error:e.message.slice(12)},400);
    if (e.message.startsWith("Connector:")) return json({error:e.message.slice(11)},400);
    if (e.message.startsWith("CONNECTOR_")) return json({error:e.message},400);
    if (e instanceof ZodError)
      return json({ error: e.issues[0]?.message || "Check your input" }, 400);
    if (
      e instanceof SyntaxError ||
      /^(Enter |CSV |Use columns|Import between|Row |Unclosed |Invalid character|Use a positive|Invalid connector|Catalog limit)/.test(
        e.message,
      )
    )
      return json({ error: e.message }, 400);
    console.error("Platform request failed", e.code || e.name);
    return json(
      {
        error: "The workspace could not be saved or loaded. Please try again.",
      },
      503,
    );
  }
}
export const GET = handle,
  POST = handle;
