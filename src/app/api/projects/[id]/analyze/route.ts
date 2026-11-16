import { getStore } from "@/lib/db";
import { analyzeYoutubeVideo } from "@/lib/gemini/analyze-youtube";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { rateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  if (!rateLimit(`analyze:${user.id}`, 4)) return jsonError("Too many analysis requests. Wait a minute.", 429);
  const { id } = await context.params;
  const project = await getStore().getProject(user.id, id);
  if (!project) return jsonError("That project was not found on your account", 404);
  if (!project.youtube) return jsonError("This project has no YouTube video to analyze", 400);

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  if (project.analysis && !refresh) {
    return Response.json({ project, cached: true });
  }

  try {
    const analysis = await analyzeYoutubeVideo({
      url: project.youtube.url,
      durationSeconds: project.youtube.durationSeconds,
    });
    const updated = await getStore().saveAnalysis(user.id, project.id, analysis);
    return Response.json({ project: updated, cached: false });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Video analysis failed", 502);
  }
}
