import { Float32BufferAttribute, type Mesh } from "three";

/** Convert Meshopt integer attributes before transforming. Applying metre
 * coordinates to integer buffers truncates them and destroys the geometry. */
export function worldGeometry(mesh: Mesh) {
  const geometry = mesh.geometry.clone();
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      for (let k = 0; k < attribute.itemSize; k++) {
        values[i * attribute.itemSize + k] = attribute.getComponent(i, k);
      }
    }
    geometry.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize));
  }
  return geometry.applyMatrix4(mesh.matrixWorld);
}
