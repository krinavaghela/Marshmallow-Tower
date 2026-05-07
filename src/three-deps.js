// Centralized Three.js imports so the app works in:
// - Vite dev/build (bundler present)
// - plain static hosting (no bundler / no node_modules)
//
// We import from a CDN to avoid relying on node_modules at runtime.
import * as THREE from 'https://unpkg.com/three@0.184.0/build/three.module.js'
import { OrbitControls } from 'https://unpkg.com/three@0.184.0/examples/jsm/controls/OrbitControls.js'

export { THREE, OrbitControls }

