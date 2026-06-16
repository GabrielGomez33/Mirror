// src/components/three/ZenBridgeScene.tsx
//
// Colorway-aware TruthStream background scene. Renders the daytime sakura zen
// bridge (koi pond, stone lanterns, cherry/maple trees, waterfall) by default,
// or its own nighttime cosmic variant (galaxy nebula sky, stars, constellations,
// moon, moonlit reflective pond with lit lanterns, koi and petals) when the
// active theme is 'cosmic'. Keyed on `theme` so each variant builds/disposes
// its own WebGL scene cleanly.
import { useTheme } from '../../context/ThemeContext';
import ZenBridgeSceneSakura from './ZenBridgeSceneSakura';
import ZenBridgeSceneCosmic from './ZenBridgeSceneCosmic';

export default function ZenBridgeScene() {
  const { theme } = useTheme();
  return theme === 'cosmic'
    ? <ZenBridgeSceneCosmic key="cosmic" />
    : <ZenBridgeSceneSakura key="sakura" />;
}