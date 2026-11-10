import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, type Object3D } from "three";
import { Transition } from "./motion.ts";
import { DOOR_IDS, type DoorId, type DoorState } from "../config/doors.ts";
import { worldGeometry } from "./geometry.ts";
import { createDoorEdges } from "./doorEdges.ts";

// The supplied model combines four doors into one mesh. Its side windows are
// also combined. Clip triangles at the actual door seam, preserving UVs/normals.
type ClipPlane = readonly [number, number, number, number];
function partitionGeometry(source: BufferGeometry, planes: ClipPlane[], keepOutside = false) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const entries = Object.entries(geometry.attributes).filter(([, a]) => a.itemSize <= 4);
  const output = entries.map(() => [] as number[]);
  const outside = entries.map(() => [] as number[]);
  type Vertex = number[][];
  const positionIndex = entries.findIndex(([name]) => name === "position");
  const clip = (polygon: Vertex[], plane: ClipPlane, sign = 1) => {
    const result: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const distance = (vertex: Vertex) => {
        const p = vertex[positionIndex];
        return (p[0] * plane[0] + p[1] * plane[1] + p[2] * plane[2] + plane[3]) * sign;
      };
      const da = distance(a), db = distance(b);
      if (da >= 0) result.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        result.push(a.map((values, j) => values.map((v, k) => v + (b[j][k] - v) * t)));
      }
    }
    return result;
  };
  const emit = (polygon: Vertex[], destination: number[][]) => {
    for (let j = 1; j < polygon.length - 1; j++) {
      for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) vertex.forEach((values, k) => destination[k].push(...values));
    }
  };
  for (let i = 0; i < geometry.attributes.position.count; i += 3) {
    let polygon: Vertex[] = [0, 1, 2].map(offset => entries.map(([, a]) => Array.from({length:a.itemSize}, (_, k) => a.getComponent(i + offset, k))));
    for (const plane of planes) {
      if (keepOutside) emit(clip(polygon, plane, -1), outside);
      polygon = clip(polygon, plane);
      if (!polygon.length) break;
    }
    emit(polygon, output);
  }
  const build = (values: number[][]) => {
    const result = new BufferGeometry();
    entries.forEach(([name, a], i) => result.setAttribute(name, new Float32BufferAttribute(values[i], a.itemSize)));
    result.normalizeNormals();
    if (result.attributes.position.count) { result.computeBoundingBox(); result.computeBoundingSphere(); }
    return result;
  };
  if (geometry !== source) geometry.dispose();
  return {inside:build(output), outside:keepOutside ? build(outside) : null};
}

/** Convex side profile of an outer door; used to cut the matching inner card out
 * of the shared cabin shell, leaving the roof, floor and pillars stationary. */
function doorProfile(geometry: BufferGeometry): ClipPlane[] {
  const a = geometry.attributes.position;
  const points = Array.from({length:a.count}, (_, i) => [a.getY(i), a.getZ(i)]);
  points.sort((a,b) => a[0] - b[0] || a[1] - b[1]);
  const unique = points.filter((p,i) => !i || p[0] !== points[i-1][0] || p[1] !== points[i-1][1]);
  const cross = (a:number[],b:number[],c:number[]) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half = (values:number[][]) => {
    const result:number[][] = [];
    for (const p of values) { while (result.length > 1 && cross(result[result.length-2],result[result.length-1],p) <= 0) result.pop(); result.push(p); }
    return result.slice(0,-1);
  };
  const hull = [...half(unique), ...half([...unique].reverse())];
  return hull.map((a,i) => {
    const b = hull[(i+1)%hull.length], dy=b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dy,dz);
    return [0, -dz/length, dy/length, (dz*a[0]-dy*a[1])/length - 0.012] as ClipPlane;
  });
}

export function createDoors(model: Object3D) {
  model.updateWorldMatrix(true, true);
  const root = new Group();
  root.name = "animated-doors";
  const pivots = new Map<DoorId, { group: Group; motion: Transition; side: number }>();
  const bounds = new Box3().setFromObject(model.getObjectByName("door")!);
  // Seam between the front and rear doors in the supplied D-Max export.
  const seam = bounds.min.z + (bounds.max.z - bounds.min.z) * 0.443;
  const windows = model.getObjectByName("windows_glass_side");
  const windowBottom = windows ? new Box3().setFromObject(windows).min.y : bounds.min.y + (bounds.max.y - bounds.min.y) * 0.6;
  for (const id of DOOR_IDS) {
    const side = id.endsWith("left") ? 1 : -1;
    const front = id.startsWith("front");
    const group = new Group();
    group.name = id;
    group.position.set(side * Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), bounds.min.y, front ? bounds.max.z : seam);
    root.add(group);
    pivots.set(id, {group, motion: new Transition(0, 800), side});
  }
  const sources = ["door", "door_handle", "windows_glass_side", "trim_plastic", "mirror01", "mirror_base"];
  const geometries: BufferGeometry[] = [];
  const profiles = new Map<DoorId, ClipPlane[]>();
  for (const name of sources) {
    model.getObjectByName(name)?.traverse(object => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const world = worldGeometry(mesh);
      for (const [id, {group, side}] of pivots) {
        if (name.startsWith("mirror") && id.startsWith("rear")) continue;
        const front = id.startsWith("front");
        const planes: ClipPlane[] = [[side,0,0,0]];
        if (!name.startsWith("mirror")) planes.push([0,0,front ? 1 : -1,front ? -seam : seam]);
        const geometry = partitionGeometry(world, planes).inside;
        if (!geometry.attributes.position.count) { geometry.dispose(); continue; }
        if (name === "door") {
          profiles.set(id, doorProfile(geometry));
          const edgeGeometry = createDoorEdges(geometry, side, windowBottom, seam, front);
          edgeGeometry.translate(-group.position.x, -group.position.y, -group.position.z);
          const edges = new Mesh(edgeGeometry, mesh.material);
          edges.name = `${id}-door-edges`;
          group.add(edges);
          geometries.push(edgeGeometry);
        }
        geometry.translate(-group.position.x, -group.position.y, -group.position.z);
        const part = new Mesh(geometry, mesh.material);
        part.name = `${id}-${name}`;
        group.add(part);
        geometries.push(geometry);
      }
      world.dispose();
      mesh.visible = false;
    });
  }
  for (const name of ["interior01", "hull"]) {
    model.getObjectByName(name)?.traverse(object => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      let remaining = worldGeometry(mesh);
      for (const [id,{group,side}] of pivots) {
        const profile = profiles.get(id);
        if (!profile) continue;
        // Seats end inboard of 0.67 m. Door cards occupy the outboard cabin shell.
        const {inside, outside} = partitionGeometry(remaining, [[side,0,0,-0.70], ...profile], true);
        remaining.dispose(); remaining = outside!;
        if (inside.attributes.position.count) {
          inside.translate(-group.position.x, -group.position.y, -group.position.z);
          const card = new Mesh(inside, mesh.material);
          card.name = `${id}-${name}`;
          group.add(card); geometries.push(inside);
        } else inside.dispose();
      }
      const stationary = new Mesh(remaining, mesh.material);
      stationary.name = `stationary-${name}`;
      root.add(stationary); geometries.push(remaining);
      mesh.visible = false;
    });
  }
  return {
    root,
    set(state: DoorState, now: number, immediate: boolean) {
      for (const [id, {motion}] of pivots) motion.to(state[id] ? 1 : 0, now, immediate);
    },
    update(now: number) {
      let active = false;
      for (const {group, motion, side} of pivots.values()) {
        active = motion.update(now) || active;
        group.rotation.y = -side * motion.value * Math.PI * 0.36;
      }
      return active;
    },
    dispose() { geometries.forEach(g => g.dispose()); root.removeFromParent(); },
  };
}
