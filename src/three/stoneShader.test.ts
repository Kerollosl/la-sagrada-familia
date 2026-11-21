import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildStoneShaderSnippets,
  generateStoneTextureBuffers,
  periodicNoise,
} from './stoneShader';

test('periodicNoise tiles seamlessly across [0, 1) boundaries', () => {
  const a = periodicNoise(0.0, 0.37, 16, 16, 42);
  const b = periodicNoise(1.0, 0.37, 16, 16, 42);
  assert.ok(Math.abs(a - b) < 1e-6);
});

test('generateStoneTextureBuffers produces valid tangent-space normals, displacement, and roughness', () => {
  const size = 128;
  const organic = generateStoneTextureBuffers({ size, profile: 'organic' });
  const angular = generateStoneTextureBuffers({ size, profile: 'angular' });

  assert.equal(organic.normalData.length, size * size * 4);
  assert.equal(organic.displacementData.length, size * size * 4);
  assert.equal(organic.roughnessData.length, size * size * 4);
  assert.equal(organic.albedoData.length, size * size * 4);

  let normalVariation = 0;
  let dispMin = 255;
  let dispMax = 0;

  for (let i = 0; i < size * size; i++) {
    const p = i * 4;
    const nx = (organic.normalData[p] / 255) * 2 - 1;
    const ny = (organic.normalData[p + 1] / 255) * 2 - 1;
    const nz = (organic.normalData[p + 2] / 255) * 2 - 1;
    const len = Math.hypot(nx, ny, nz);

    // Every encoded normal vector must be unit length and outward-facing (+Z)
    assert.ok(len > 0.95 && len < 1.05, `unexpected normal length ${len}`);
    assert.ok(nz > 0, `tangent normal z must face outward, got ${nz}`);

    normalVariation += Math.abs(nx) + Math.abs(ny);
    dispMin = Math.min(dispMin, organic.displacementData[p]);
    dispMax = Math.max(dispMax, organic.displacementData[p]);
  }

  assert.ok(normalVariation / (size * size) > 0.08, 'normal map must contain visible surface relief');
  assert.ok(dispMax - dispMin > 45, 'displacement map must span substantial height range');

  // Ensure organic (Nativity) and angular (Passion) profiles produce distinct maps
  let diffSum = 0;
  for (let i = 0; i < organic.displacementData.length; i += 4) {
    diffSum += Math.abs(organic.displacementData[i] - angular.displacementData[i]);
  }
  assert.ok(diffSum / (size * size) > 6, 'organic and angular relief profiles should differ');
});

test('buildStoneShaderSnippets injects valid vertex & fragment hooks compatible with MeshStandardMaterial', () => {
  const organicSnippets = buildStoneShaderSnippets('organic');
  const angularSnippets = buildStoneShaderSnippets('angular');

  assert.notEqual(organicSnippets.cacheKey, angularSnippets.cacheKey);
  assert.ok(THREE.ShaderLib.standard.vertexShader.includes('#include <displacementmap_vertex>'));
  assert.ok(THREE.ShaderLib.standard.fragmentShader.includes('#include <color_fragment>'));
  assert.ok(THREE.ShaderLib.standard.fragmentShader.includes('#include <normal_fragment_maps>'));
  assert.ok(organicSnippets.vertexWorldCompute.includes('vStoneWorldPos'));
  assert.ok(organicSnippets.fragmentNormal.includes('normal = normalize'));
});
