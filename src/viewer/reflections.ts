import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import { Transition } from "./motion.ts";

/** Fade environment reflections without changing diffuse room illumination or shadows. */
export function createReflections(enabled = true) {
  const strength = { value: enabled ? 1 : 0 };
  const motion = new Transition(strength.value, 300);
  const attached = new Set<MeshStandardMaterial>();
  return {
    attach(root: Object3D) {
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof MeshStandardMaterial) || attached.has(material)) continue;
          attached.add(material);
          const compile = material.onBeforeCompile;
          const cacheKey = material.customProgramCacheKey.bind(material);
          material.onBeforeCompile = (shader, renderer) => {
            compile.call(material, shader, renderer);
            shader.uniforms.environmentReflections = strength;
            shader.fragmentShader = "uniform float environmentReflections;\n" + shader.fragmentShader.replace(
              "#include <lights_fragment_maps>",
              `#include <lights_fragment_maps>
              #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
                radiance *= environmentReflections;
                #ifdef USE_CLEARCOAT
                  clearcoatRadiance *= environmentReflections;
                #endif
              #endif`,
            );
          };
          material.customProgramCacheKey = () => cacheKey() + ":environment-reflections";
          material.needsUpdate = true;
        }
      });
    },
    set(enabled: boolean, now: number, immediate = false) { motion.to(enabled ? 1 : 0, now, immediate); strength.value = motion.value; },
    update(now: number) { const active = motion.update(now); strength.value = motion.value; return active; },
  };
}
