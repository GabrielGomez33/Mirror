// src/components/three/SakuraForestScene.tsx
//
// Colorway-aware MyMirror background scene. Renders the daytime sakura
// magical-mirror pond by default, or its own nighttime cosmic variant (galaxy
// nebula sky, stars, constellations, moon, reflective dark mirror with the same
// lotus flowers, zen frogs and floating petals) when the active theme is
// 'cosmic'. Keyed on `theme` so each variant builds/disposes its own scene.
import { useTheme } from '../../context/ThemeContext';
import SakuraForestSceneSakura from './SakuraForestSceneSakura';
import SakuraForestSceneCosmic from './SakuraForestSceneCosmic';

export default function SakuraForestScene() {
  const { theme } = useTheme();
  return theme === 'cosmic'
    ? <SakuraForestSceneCosmic key="cosmic" />
    : <SakuraForestSceneSakura key="sakura" />;
}