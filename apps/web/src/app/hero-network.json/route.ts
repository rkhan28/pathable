import { heroNetwork } from "@/lib/hero-network";

// Reads nothing from the request, so the build prerenders it into a plain file;
// the landing's worker fetches it after first paint.
export function GET() {
  return Response.json(heroNetwork());
}
