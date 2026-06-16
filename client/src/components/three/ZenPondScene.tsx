// src/components/three/ZenPondScene.tsx
//
// Colorway-aware zen pond (MyJournal background). Renders the daytime sakura
// pond by default, or the shared nighttime cosmic pond (galaxy nebula sky,
// stars, constellations, moon, moonlit water with pads & butterflies) when the
// active theme is 'cosmic'. Keyed on `theme` so each variant builds/disposes
// its own WebGL scene cleanly.
import { useTheme } from '../../context/ThemeContext';
import ZenPondSceneSakura from './ZenPondSceneSakura';
import CosmicPondScene from './CosmicPondScene';

export default function ZenPondScene() {
  const { theme } = useTheme();
  return theme === 'cosmic'
    ? <CosmicPondScene key="cosmic" />
    : <ZenPondSceneSakura key="sakura" />;
}