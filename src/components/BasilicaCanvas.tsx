import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBasilicaMaterials } from '../three/materials';
import { buildSagradaFamiliaScene } from '../three/proceduralGeometry';
import { computePhaseProgress, MAX_YEAR, MIN_YEAR } from '../data/timeline';
import { ARCHITECTURAL_FEATURES } from '../data/architecturalFeatures';
import { computeAtmosphereState, normalizeTimeOfDay } from '../utils/timeOfDay';
import { computeWeatherAtmosphere, WeatherMode } from '../utils/atmosphereParticles';

export interface CameraTargetHint {
  azimuthDeg?: number;
  elevationDeg?: number;
  distance?: number;
  position?: [number, number, number];
  target?: [number, number, number];
  nonce: number;
}

interface BasilicaCanvasProps {
  year: number;
  isPlaying: boolean;
  autoOrbit: boolean;
  timeOfDay: number;
  cycleTimeOfDay: boolean;
  weatherMode: WeatherMode;
  birdsEnabled: boolean;
  focusMode: boolean;
  labelsVisible: boolean;
  selectedFeatureId: string | null;
  cameraHint: CameraTargetHint | null;
  onYearTick: (newYear: number, reachedEnd: boolean) => void;
  onTimeOfDayTick: (nextTimeOfDay: number) => void;
  onSelectFeature: (featureId: string) => void;
}

const DEFAULT_CAMERA_POS = new THREE.Vector3(68, 35, 74);
const DEFAULT_TARGET = new THREE.Vector3(0, 20.5, 0);

// Pre-allocated scratch math helpers (zero GC in render loop)
const _offset = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _spherical = new THREE.Spherical();
const _projVec = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function BasilicaCanvas({
  year,
  isPlaying,
  autoOrbit,
  timeOfDay,
  cycleTimeOfDay,
  weatherMode,
  birdsEnabled,
  focusMode,
  labelsVisible,
  selectedFeatureId,
  cameraHint,
  onYearTick,
  onTimeOfDayTick,
  onSelectFeature,
}: BasilicaCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [webglError, setWebglError] = useState(false);

  // Refs bridging React props into the persistent WebGL lifecycle
  const yearRef = useRef(year);
  // Year shown by the model; eases toward yearRef so scrubbing animates piece by piece.
  const shownYearRef = useRef(year);
  const isPlayingRef = useRef(isPlaying);
  const autoOrbitRef = useRef(autoOrbit);
  const targetTodRef = useRef(timeOfDay);
  const currentTodRef = useRef(timeOfDay);
  const cycleTodRef = useRef(cycleTimeOfDay);
  const weatherModeRef = useRef(weatherMode);
  const birdsEnabledRef = useRef(birdsEnabled);
  const focusModeRef = useRef(focusMode);
  const labelsVisibleRef = useRef(labelsVisible);
  const selectedFeatureIdRef = useRef<string | null>(selectedFeatureId);
  const hoveredFeatureIdRef = useRef<string | null>(null);
  const onYearTickRef = useRef(onYearTick);
  const onTimeOfDayTickRef = useRef(onTimeOfDayTick);
  const onSelectFeatureRef = useRef(onSelectFeature);

  const cameraGoalRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const requestWakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    yearRef.current = year;
    requestWakeRef.current?.();
  }, [year]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    requestWakeRef.current?.();
  }, [isPlaying]);

  useEffect(() => {
    autoOrbitRef.current = autoOrbit;
    requestWakeRef.current?.();
  }, [autoOrbit]);

  useEffect(() => {
    targetTodRef.current = timeOfDay;
    requestWakeRef.current?.();
  }, [timeOfDay]);

  useEffect(() => {
    cycleTodRef.current = cycleTimeOfDay;
    requestWakeRef.current?.();
  }, [cycleTimeOfDay]);

  useEffect(() => {
    weatherModeRef.current = weatherMode;
    requestWakeRef.current?.();
  }, [weatherMode]);

  useEffect(() => {
    birdsEnabledRef.current = birdsEnabled;
    requestWakeRef.current?.();
  }, [birdsEnabled]);

  useEffect(() => {
    focusModeRef.current = focusMode;
    requestWakeRef.current?.();
  }, [focusMode]);

  useEffect(() => {
    labelsVisibleRef.current = labelsVisible;
    requestWakeRef.current?.();
  }, [labelsVisible]);

  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId;
    requestWakeRef.current?.();
  }, [selectedFeatureId]);

  useEffect(() => {
    onYearTickRef.current = onYearTick;
  }, [onYearTick]);

  useEffect(() => {
    onTimeOfDayTickRef.current = onTimeOfDayTick;
  }, [onTimeOfDayTick]);

  useEffect(() => {
    onSelectFeatureRef.current = onSelectFeature;
  }, [onSelectFeature]);

  useEffect(() => {
    if (!cameraHint) return;
    if (cameraHint.position && cameraHint.target) {
      cameraGoalRef.current = {
        position: new THREE.Vector3(...cameraHint.position),
        target: new THREE.Vector3(...cameraHint.target),
      };
    } else if (
      cameraHint.azimuthDeg !== undefined &&
      cameraHint.elevationDeg !== undefined &&
      cameraHint.distance !== undefined
    ) {
      const az = THREE.MathUtils.degToRad(cameraHint.azimuthDeg);
      const el = THREE.MathUtils.degToRad(cameraHint.elevationDeg);
      const d = cameraHint.distance;
      const horiz = d * Math.cos(el);
      cameraGoalRef.current = {
        position: new THREE.Vector3(
          Math.sin(az) * horiz,
          DEFAULT_TARGET.y + d * Math.sin(el),
          Math.cos(az) * horiz
        ),
        target: DEFAULT_TARGET.clone(),
      };
    } else {
      cameraGoalRef.current = {
        position: DEFAULT_CAMERA_POS.clone(),
        target: DEFAULT_TARGET.clone(),
      };
    }
    requestWakeRef.current?.();
  }, [cameraHint]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'sagrada-canvas');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialAtmos = computeAtmosphereState(currentTodRef.current);
    const fog = new THREE.FogExp2(initialAtmos.fogColorHex, initialAtmos.fogDensity);
    scene.background = new THREE.Color(initialAtmos.skyHorizonHex);
    scene.fog = fog;

    // Procedural Sky Dome (smoothly blends Daylight -> Golden Hour -> Dramatic Night)
    const skyGeo = new THREE.SphereGeometry(260, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(initialAtmos.skyTopHex) },
        midColor: { value: new THREE.Color(initialAtmos.skyMidHex) },
        horizonColor: { value: new THREE.Color(initialAtmos.skyHorizonHex) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.24, max(h, 0.0)));
          col = mix(col, topColor, smoothstep(0.22, 0.78, max(h, 0.0)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Subtle procedural night sky starfield (invisible during daylight)
    const starCount = 240;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const h1 = Math.abs(Math.sin(i * 12.9898 + 1.23) * 43758.5453) % 1;
      const h2 = Math.abs(Math.sin(i * 78.233 + 4.56) * 24634.6345) % 1;
      const phi = h1 * Math.PI * 2;
      const u = 0.08 + h2 * 0.88;
      const r = 235;
      const horiz = Math.sqrt(Math.max(0, 1 - u * u));
      starPositions[i * 3] = Math.cos(phi) * horiz * r;
      starPositions[i * 3 + 1] = u * r;
      starPositions[i * 3 + 2] = Math.sin(phi) * horiz * r;
    }
    const starfieldGeo = new THREE.BufferGeometry();
    starfieldGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starfieldMat = new THREE.PointsMaterial({
      color: 0xeef4ff,
      size: 1.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: initialAtmos.starfieldOpacity,
      depthWrite: false,
      fog: false,
    });
    const starfield = new THREE.Points(starfieldGeo, starfieldMat);
    scene.add(starfield);

    // Studio & Mediterranean environment reflection
    function createEnvironment() {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const target = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      return target;
    }

    let envTarget = createEnvironment();
    scene.environment = envTarget.texture;
    scene.environmentIntensity = initialAtmos.envIntensity;

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.5, 500);
    camera.position.copy(DEFAULT_CAMERA_POS);

    function updateProjection(w: number, h: number) {
      camera.aspect = w / h;
      // Widen the portrait view to keep the façades inside the frame.
      camera.zoom = Math.min(1, Math.max(0.55, camera.aspect / 0.85));
      camera.updateProjectionMatrix();
    }
    updateProjection(width, height);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_TARGET);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 12;
    controls.maxDistance = 160;
    controls.maxPolarAngle = Math.PI * 0.485; // keep above ground plaza
    controls.minPolarAngle = 0.12;
    controls.update();

    // Sun / Moonlight key + cool sky hemisphere fill + rim light
    const sunLight = new THREE.DirectionalLight(initialAtmos.sunColorHex, initialAtmos.sunIntensity);
    sunLight.position.set(...initialAtmos.sunPosition);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 175;
    const d = 34;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d + 14;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(
      initialAtmos.hemiSkyHex,
      initialAtmos.hemiGroundHex,
      initialAtmos.hemiIntensity
    );
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(initialAtmos.rimColorHex, initialAtmos.rimIntensity);
    rimLight.position.set(-48, 24, -42);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const materials = createBasilicaMaterials(maxAniso);
    const rig = buildSagradaFamiliaScene(scene, materials);

    // Raycaster restricted to layer 1 (low-poly invisible facade hitboxes)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();

    function projectLabels() {
      const hostEl = mountRef.current;
      if (!hostEl) return;
      const vw = hostEl.clientWidth || window.innerWidth;
      const vh = hostEl.clientHeight || window.innerHeight;
      const showAny = labelsVisibleRef.current;

      for (let i = 0; i < ARCHITECTURAL_FEATURES.length; i++) {
        const feat = ARCHITECTURAL_FEATURES[i];
        const el = labelElsRef.current.get(feat.id);
        if (!el) continue;

        const isBuilt = yearRef.current >= feat.revealYear - 2;
        const isSelected = selectedFeatureIdRef.current === feat.id;
        if (!showAny || (!isBuilt && !focusModeRef.current && !isSelected)) {
          el.hidden = true;
          continue;
        }

        _projVec.set(...feat.anchorPosition).project(camera);
        if (_projVec.z > 1 || _projVec.z < -1) {
          el.hidden = true;
          continue;
        }

        const sx = ((_projVec.x + 1) * 0.5) * vw;
        const sy = ((-_projVec.y + 1) * 0.5) * vh;

        // Keep labels comfortably inside viewport bounds
        if (sx < 40 || sx > vw - 40 || sy < 24 || sy > vh - 120) {
          el.hidden = true;
          continue;
        }

        el.hidden = false;
        el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0)`;
        el.style.opacity = isBuilt || isSelected ? '1' : '0.58';
      }
    }

    function applyAtmosphere(tod: number) {
      const atmos = computeAtmosphereState(tod);
      skyMat.uniforms.topColor.value.setHex(atmos.skyTopHex);
      skyMat.uniforms.midColor.value.setHex(atmos.skyMidHex);
      skyMat.uniforms.horizonColor.value.setHex(atmos.skyHorizonHex);
      (scene.background as THREE.Color).setHex(atmos.skyHorizonHex);
      fog.color.setHex(atmos.fogColorHex);
      fog.density = atmos.fogDensity;

      sunLight.position.set(atmos.sunPosition[0], atmos.sunPosition[1], atmos.sunPosition[2]);
      sunLight.color.setHex(atmos.sunColorHex);
      sunLight.intensity = atmos.sunIntensity;

      hemiLight.color.setHex(atmos.hemiSkyHex);
      hemiLight.groundColor.setHex(atmos.hemiGroundHex);
      hemiLight.intensity = atmos.hemiIntensity;

      rimLight.color.setHex(atmos.rimColorHex);
      rimLight.intensity = atmos.rimIntensity;

      scene.environmentIntensity = atmos.envIntensity;
      renderer.toneMappingExposure = atmos.toneMappingExposure;

      starfieldMat.opacity = atmos.starfieldOpacity;
      starfield.visible = atmos.starfieldOpacity > 0.01;

      return atmos;
    }

    // Apply initial year, time of day, weather particles, focus rings & birds immediately
    rig.applyProgress(computePhaseProgress(yearRef.current), 0, initialAtmos);
    rig.applyLivingScene(0, 0, initialAtmos, weatherModeRef.current, birdsEnabledRef.current);
    rig.setFocusHighlight(
      selectedFeatureIdRef.current,
      hoveredFeatureIdRef.current,
      focusModeRef.current,
      yearRef.current
    );

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let isDisposed = false;
    let contextLost = false;
    let frameId = 0;
    let timerId = 0;
    let gpuFence: WebGLSync | null = null;
    let updatingControls = false;
    let userDragging = false;
    let lastTime: number | null = null;
    let lastHudSync = 0;
    let lastTodSync = 0;
    let lastHoverRaycast = 0;
    let elapsedTotal = 0;
    let pendingClick: { pointerId: number; x: number; y: number } | null = null;

    function suspendRendering() {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      frameId = 0;
      timerId = 0;
      lastTime = null;
      if (gpuFence) {
        gl.deleteSync(gpuFence);
        gpuFence = null;
      }
    }

    function waitForSoftwareFrame() {
      gpuFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();

      function poll() {
        if (gpuFence && gl.getSyncParameter(gpuFence, gl.SYNC_STATUS) === gl.UNSIGNALED) {
          timerId = window.setTimeout(poll, 8);
          return;
        }
        if (gpuFence) {
          gl.deleteSync(gpuFence);
          gpuFence = null;
        }
        timerId = 0;
        frameId = requestAnimationFrame(tick);
      }

      timerId = window.setTimeout(poll, 80);
    }

    const isTodTransitioning = () => {
      const diff = Math.abs(targetTodRef.current - currentTodRef.current);
      const circularDiff = Math.min(diff, 1 - diff);
      return circularDiff > 0.0015;
    };

    const hasActiveWeather = () => {
      const w = computeWeatherAtmosphere(currentTodRef.current, weatherModeRef.current);
      return w.rainOpacity > 0.01 || w.fogWispOpacity > 0.01;
    };

    const needsContinuousLoop = () =>
      isPlayingRef.current ||
      Math.abs(shownYearRef.current - yearRef.current) > 0.01 ||
      autoOrbitRef.current ||
      cycleTodRef.current ||
      isTodTransitioning() ||
      cameraGoalRef.current !== null ||
      birdsEnabledRef.current ||
      hasActiveWeather();

    function stepSimulation(dt: number, todDt: number) {
      elapsedTotal += dt;

      if (isPlayingRef.current) {
        // Advance ~6.5 years per second (1882 -> 2026 in ~22s)
        const next = yearRef.current + dt * 6.5;
        if (next >= MAX_YEAR) {
          yearRef.current = MAX_YEAR;
          isPlayingRef.current = false;
          onYearTickRef.current(MAX_YEAR, true);
        } else {
          yearRef.current = Math.max(MIN_YEAR, next);
          const now = performance.now();
          if (now - lastHudSync >= 100) {
            lastHudSync = now;
            onYearTickRef.current(yearRef.current, false);
          }
        }
      }

      // Time of Day continuous cycle or smooth preset transition
      if (cycleTodRef.current) {
        currentTodRef.current = normalizeTimeOfDay(currentTodRef.current + dt * 0.055);
        targetTodRef.current = currentTodRef.current;
        const now = performance.now();
        if (now - lastTodSync >= 120) {
          lastTodSync = now;
          onTimeOfDayTickRef.current(currentTodRef.current);
        }
      } else if (isTodTransitioning()) {
        let delta = targetTodRef.current - currentTodRef.current;
        if (delta > 0.5) delta -= 1;
        if (delta < -0.5) delta += 1;
        const alpha = 1 - Math.exp(-6.5 * todDt);
        currentTodRef.current = normalizeTimeOfDay(currentTodRef.current + delta * alpha);
        if (!isTodTransitioning()) {
          currentTodRef.current = targetTodRef.current;
        }
      }

      // Smooth camera preset / Focus Mode close-up transition (exterior cylindrical arc avoids clipping through basilica walls)
      if (cameraGoalRef.current) {
        const alpha = 1 - Math.exp(-6.0 * dt);
        _desiredCamPos.copy(cameraGoalRef.current.position);
        _desiredTarget.copy(cameraGoalRef.current.target);
        controls.target.lerp(_desiredTarget, alpha);

        const curR = Math.hypot(camera.position.x, camera.position.z);
        const tgtR = Math.hypot(_desiredCamPos.x, _desiredCamPos.z);
        if (curR > 1 && tgtR > 1) {
          const curTheta = Math.atan2(camera.position.x, camera.position.z);
          const tgtTheta = Math.atan2(_desiredCamPos.x, _desiredCamPos.z);
          let dTheta = tgtTheta - curTheta;
          while (dTheta > Math.PI) dTheta -= Math.PI * 2;
          while (dTheta <= -Math.PI) dTheta += Math.PI * 2;

          const thetaNext = curTheta + dTheta * alpha;
          const yNext = THREE.MathUtils.lerp(camera.position.y, _desiredCamPos.y, alpha);
          const baseR = THREE.MathUtils.lerp(curR, tgtR, alpha);
          const absDTheta = Math.abs(dTheta);
          const swingFactor = yNext < 38 && absDTheta > 0.25 ? Math.min(1, (absDTheta - 0.25) / 1.0) : 0;
          const minClearR = 34.5 * swingFactor;
          const nextR = baseR < minClearR ? THREE.MathUtils.lerp(baseR, minClearR, Math.min(1, alpha * 1.85)) : baseR;

          camera.position.set(
            Math.sin(thetaNext) * nextR,
            yNext,
            Math.cos(thetaNext) * nextR
          );
        } else {
          camera.position.lerp(_desiredCamPos, alpha);
        }

        if (
          camera.position.distanceTo(_desiredCamPos) < 0.25 &&
          controls.target.distanceTo(_desiredTarget) < 0.2
        ) {
          camera.position.copy(_desiredCamPos);
          controls.target.copy(_desiredTarget);
          cameraGoalRef.current = null;
        }
      } else if (autoOrbitRef.current && !userDragging) {
        // Gentle architectural auto-orbit around active target
        _offset.copy(camera.position).sub(controls.target);
        _spherical.setFromVector3(_offset);
        _spherical.theta += dt * 0.16;
        _offset.setFromSpherical(_spherical);
        camera.position.copy(controls.target).add(_offset);
      }

      const gap = yearRef.current - shownYearRef.current;
      if (isPlayingRef.current || Math.abs(gap) < 0.01) shownYearRef.current = yearRef.current;
      else shownYearRef.current += gap * (1 - Math.exp(-dt * Math.min(6, 2 + 90 / Math.abs(gap))));

      const atmos = applyAtmosphere(currentTodRef.current);
      rig.applyProgress(computePhaseProgress(shownYearRef.current), elapsedTotal, atmos);
      rig.applyLivingScene(
        dt,
        elapsedTotal,
        atmos,
        weatherModeRef.current,
        birdsEnabledRef.current
      );
      rig.setFocusHighlight(
        selectedFeatureIdRef.current,
        hoveredFeatureIdRef.current,
        focusModeRef.current,
        yearRef.current
      );
    }

    function tick(now: number) {
      frameId = 0;
      if (isDisposed || contextLost || document.hidden) return;

      const rawDt = lastTime === null ? 1 / 60 : (now - lastTime) / 1000;
      lastTime = now;
      stepSimulation(Math.min(0.12, rawDt), Math.min(0.4, rawDt));

      updatingControls = true;
      const cameraMoved = controls.update();
      updatingControls = false;
      renderer.render(scene, camera);
      projectLabels();

      if (needsContinuousLoop() || (controls.enableDamping && cameraMoved)) {
        if (isSoftwareGl) waitForSoftwareFrame();
        else requestRender();
      } else {
        lastTime = null;
      }
    }

    function requestRender() {
      if (isDisposed || contextLost || document.hidden || frameId || timerId) return;
      frameId = requestAnimationFrame(tick);
    }

    requestWakeRef.current = requestRender;

    const pickHitFeature = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(rig.hitboxMeshes, false);
      for (let i = 0; i < hits.length; i++) {
        const fid = hits[i].object.userData.featureId as string | undefined;
        const revY = Number(hits[i].object.userData.revealYear ?? MIN_YEAR);
        if (fid && (focusModeRef.current || yearRef.current >= revY - 2)) {
          return fid;
        }
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      pendingClick = e.isPrimary && e.button === 0
        ? { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
        : null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (pendingClick && Math.hypot(e.clientX - pendingClick.x, e.clientY - pendingClick.y) > 6) {
        pendingClick = null;
      }
      if (userDragging || e.pointerType === 'touch') return;
      const now = performance.now();
      if (now - lastHoverRaycast < 50) return;
      lastHoverRaycast = now;

      const hitId = pickHitFeature(e.clientX, e.clientY);
      if (hitId !== hoveredFeatureIdRef.current) {
        hoveredFeatureIdRef.current = hitId;
        renderer.domElement.style.cursor = hitId ? 'pointer' : '';
        requestRender();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const click = pendingClick;
      pendingClick = null;
      if (!click || click.pointerId !== e.pointerId ||
          Math.hypot(e.clientX - click.x, e.clientY - click.y) > 6) return;
      const hitId = pickHitFeature(e.clientX, e.clientY);
      if (hitId) onSelectFeatureRef.current(hitId);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', handlePointerDown);
    domEl.addEventListener('pointermove', handlePointerMove);
    domEl.addEventListener('pointerup', handlePointerUp);
    const clearHover = () => {
      pendingClick = null;
      hoveredFeatureIdRef.current = null;
      domEl.style.cursor = '';
      requestRender();
    };
    domEl.addEventListener('pointerleave', clearHover);
    domEl.addEventListener('pointercancel', clearHover);

    const handleControlStart = () => {
      userDragging = true;
      cameraGoalRef.current = null;
    };
    const handleControlEnd = () => {
      userDragging = false;
      requestRender();
    };
    const handleControlChange = () => {
      if (!updatingControls) requestRender();
    };

    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);
    controls.addEventListener('change', handleControlChange);

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      updateProjection(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      suspendRendering();
    };
    const handleContextRestored = () => {
      envTarget.dispose();
      envTarget = createEnvironment();
      scene.environment = envTarget.texture;
      contextLost = false;
      requestRender();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) suspendRendering();
      else requestRender();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    domEl.addEventListener('webglcontextlost', handleContextLost);
    domEl.addEventListener('webglcontextrestored', handleContextRestored);

    requestRender();

    return () => {
      isDisposed = true;
      requestWakeRef.current = null;
      suspendRendering();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      domEl.removeEventListener('pointermove', handlePointerMove);
      domEl.removeEventListener('pointerup', handlePointerUp);
      domEl.removeEventListener('pointerleave', clearHover);
      domEl.removeEventListener('pointercancel', clearHover);
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('end', handleControlEnd);
      controls.removeEventListener('change', handleControlChange);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      domEl.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      starfieldGeo.dispose();
      starfieldMat.dispose();
      rig.dispose();
      materials.dispose();
      envTarget.dispose();
      sunLight.shadow.dispose();
      renderer.dispose();
      if (domEl.parentNode === container) {
        container.removeChild(domEl);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#dce8f2] text-[#1a1c20] p-6">
        <div className="max-w-md rounded-xl bg-white/95 border border-stone-300 p-6 shadow-lg">
          <h2 className="font-display text-2xl font-semibold mb-2">WebGL Context Unavailable</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Your browser could not initialize a 3D WebGL viewport for La Sagrada Família. Enable hardware
            acceleration or try a modern WebGL2-capable browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D architectural visualization of La Sagrada Família"
      />

      {/* Annotated 3D Labels Overlay (projected via compositor transform without React re-renders) */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden z-[5]"
        aria-label="Annotated architectural 3D labels"
        data-testid="annotated-labels-layer"
      >
        {ARCHITECTURAL_FEATURES.map((feat) => {
          const isSelected = selectedFeatureId === feat.id;
          return (
            <button
              key={feat.id}
              type="button"
              ref={(el) => {
                if (el) labelElsRef.current.set(feat.id, el);
                else labelElsRef.current.delete(feat.id);
              }}
              onClick={() => onSelectFeature(feat.id)}
              data-feature-label={feat.id}
              aria-label={`Inspect ${feat.label}`}
              hidden
              className="fixed top-0 left-0 -translate-x-1/2 -translate-y-full pb-2 pointer-events-auto group select-none transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-[#e0a458]"
            >
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shadow-lg border transition-colors ${
                  isSelected
                    ? 'bg-[#e0a458] text-[#14171c] border-[#fff5e1]'
                    : 'bg-[#14171c]/88 text-[#f7f3eb] border-[#fff5e1]/22 group-hover:bg-[#1e232c] group-hover:border-[#e0a458]/70'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rotate-45 shrink-0 ${
                    isSelected ? 'bg-[#14171c]' : 'bg-[#e0a458]'
                  }`}
                />
                <span>{feat.label}</span>
              </span>
              <span
                aria-hidden="true"
                className={`block mx-auto w-px h-2.5 ${
                  isSelected ? 'bg-[#e0a458]' : 'bg-[#fff5e1]/45 group-hover:bg-[#e0a458]'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
