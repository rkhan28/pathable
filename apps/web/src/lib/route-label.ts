/** Stable route letters (A, B, C) from the route id suffix, so labels don't change when ranking does. */
export function routeLabel(id: string): string {
  const m = /-([a-z])$/.exec(id);
  return (m ? m[1] : "a").toUpperCase();
}
