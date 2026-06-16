// src/components/three/ZenPondScene2.tsx
//
// Colorway-aware zen pond (MirrorGroups background). Renders the daytime sakura
// pond by default, or the nighttime cosmic pond (galaxy nebula sky, stars,
// constellations, moon) when the active theme is 'cosmic'. Keyed on `theme` so
// each variant builds/disposes its own WebGL scene cleanly.
import { useTheme } from '../../context/ThemeContext';
import ZenPondScene2Sakura from './ZenPondScene2Sakura';
import CosmicPondScene from './CosmicPondScene';

export default function ZenPondScene2() {
  const { theme } = useTheme();
  return theme === 'cosmic'
    ? <CosmicPondScene key="cosmic" />
    : <ZenPondScene2Sakura key="sakura" />;
}