// src/components/three/ZenGardenScene.tsx
//
// Colorway-aware home/background scene. Renders the daytime sakura zen garden
// by default, or the nighttime cosmic variant (moonlit water, stars,
// constellations) when the active theme is 'cosmic'. Keying on `theme` forces
// a full remount so each variant builds/disposes its own WebGL scene cleanly.
import { useTheme } from '../../context/ThemeContext';
import ZenGardenSceneSakura from './ZenGardenSceneSakura';
import ZenGardenSceneCosmic from './ZenGardenSceneCosmic';

export default function ZenGardenScene() {
  const { theme } = useTheme();
  return theme === 'cosmic'
    ? <ZenGardenSceneCosmic key="cosmic" />
    : <ZenGardenSceneSakura key="sakura" />;
}