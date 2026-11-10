import { BufferGeometry, Float32BufferAttribute, MathUtils, Vector3 } from "three";

/** Bridge the open borders of a thin exterior skin to the inner door card.
 * Each border is a ribbon, so window and handle openings stay open. */
export function createDoorEdges(skin: BufferGeometry, side: number, windowBottom: number, seam: number, front: boolean) {
  const position = skin.attributes.position;
  const index = skin.index;
  const edges = new Map<string, { a: Vector3; b: Vector3; count: number }>();
  const key = (point: Vector3) => [point.x, point.y, point.z].map(value => Math.round(value * 100_000)).join(",");
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset));
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const ka = key(a), kb = key(b);
      if (ka === kb) continue;
      const id = ka < kb ? ka + ":" + kb : kb + ":" + ka;
      const edge = edges.get(id);
      if (edge) edge.count++;
      else edges.set(id, { a, b, count: 1 });
    }
  }
  const vertices: number[] = [];
  const inside = (point: Vector3) => {
    const inset = point.clone();
    const frame = MathUtils.smoothstep(point.y, windowBottom - 0.06, windowBottom + 0.02);
    const lowerX = Math.min(Math.abs(point.x), 0.72);
    inset.x = side * MathUtils.lerp(lowerX, Math.max(lowerX, Math.abs(point.x) - 0.035), frame);
    // Adjacent front/rear caps lean into their own panel instead of sharing
    // a coplanar face when both doors are shut.
    if (Math.abs(point.z - seam) < 0.0001) inset.z += front ? 0.003 : -0.003;
    return inset;
  };
  for (const { a, b, count } of edges.values()) {
    if (count !== 1) continue;
    const ai = inside(a), bi = inside(b);
    for (const point of [a, b, bi, a, bi, ai]) vertices.push(point.x, point.y, point.z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
