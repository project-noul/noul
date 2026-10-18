/* ========================================================
   1. Three.js 설정 및 최적화 재질/지오메트리 구축
   ======================================================== */
const BUTTERFLY_SHAPES = [
  'crescent',
  'dawn-ray',
  'ember',
  'moon-halo',
  'petal',
  'starlight',
  'wave-fin'
];

const DEFAULT_BUTTERFLY_SHAPES = ['crescent', 'moon-halo'];

// 🌟 잘린 유니코드 조각(Lone Surrogate) 및 깨진 대체 문자(, \uFFFD)를 깔끔하게 제거하는 헬퍼
function sanitizeDisplayText(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, function(m) { return m.length > 1 ? m[0] : ''; })
    .replace(/\uFFFD/g, '')
    .trim();
}

const sharedWhiteMat = new THREE.MeshBasicMaterial({ 
  color: 0xffffff, 
  side: THREE.DoubleSide, 
  transparent: false, 
  depthWrite: true 
});

// 🌟 검은색 몸통/더듬이가 완전한 검은색으로 보이도록 순수 블랙 재질 적용
const sharedBlackMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
  transparent: false,
  depthWrite: true
});

function executeReliableFastBlur(canvas, radius) {
  if (radius <= 0.2) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const src = imgData.data;
  const r = Math.max(1, Math.round(radius)), kernelSize = r * 2 + 1;
  const temp = new Uint8ClampedArray(src.length);

  for (let y = 0; y < h; y++) {
    let rowStart = y * w * 4, rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    for (let i = -r; i <= r; i++) {
      let px = Math.min(w - 1, Math.max(0, i)), pIndex = rowStart + px * 4;
      rSum += src[pIndex]; gSum += src[pIndex + 1]; bSum += src[pIndex + 2]; aSum += src[pIndex + 3];
    }
    for (let x = 0; x < w; x++) {
      let outIndex = rowStart + x * 4;
      temp[outIndex] = rSum / kernelSize; temp[outIndex + 1] = gSum / kernelSize; temp[outIndex + 2] = bSum / kernelSize; temp[outIndex + 3] = aSum / kernelSize;
      let remIdx = rowStart + Math.min(w - 1, Math.max(0, x - r)) * 4;
      let addIdx = rowStart + Math.min(w - 1, Math.max(0, x + r + 1)) * 4;
      rSum += src[addIdx] - src[remIdx]; gSum += src[addIdx + 1] - src[remIdx + 1]; bSum += src[addIdx + 2] - src[remIdx + 2]; aSum += src[addIdx + 3] - src[remIdx + 3];
    }
  }

  for (let x = 0; x < w; x++) {
    let rSum2 = 0, gSum2 = 0, bSum2 = 0, aSum2 = 0;
    for (let i = -r; i <= r; i++) {
      let py = Math.min(h - 1, Math.max(0, i)), pIndex2 = (py * w + x) * 4;
      rSum2 += temp[pIndex2]; gSum2 += temp[pIndex2 + 1]; bSum2 += temp[pIndex2 + 2]; aSum2 += temp[pIndex2 + 3];
    }
    for (let y = 0; y < h; y++) {
      let outIndex2 = (y * w + x) * 4;
      src[outIndex2] = rSum2 / kernelSize; src[outIndex2 + 1] = gSum2 / kernelSize; src[outIndex2 + 2] = bSum2 / kernelSize; src[outIndex2 + 3] = aSum2 / kernelSize;
      let remIdx2 = (Math.min(h - 1, Math.max(0, y - r)) * w + x) * 4;
      let addIdx2 = (Math.min(h - 1, Math.max(0, y + r + 1)) * w + x) * 4;
      rSum2 += temp[addIdx2] - temp[remIdx2]; gSum2 += temp[addIdx2 + 1] - temp[remIdx2 + 1]; bSum2 += temp[addIdx2 + 2] - temp[remIdx2 + 2]; aSum2 += temp[addIdx2 + 3] - temp[remIdx2 + 3];
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function createStableWingGeom(isRight) {
  const shape = new THREE.Shape();
  const s = isRight ? 1 : -1;
  shape.moveTo(0, 0.5);
  shape.bezierCurveTo(s * 0.4, 1.0, s * 1.5, 2.0, s * 2.4, 1.8);
  shape.bezierCurveTo(s * 3.0, 1.6, s * 2.8, 0.8, s * 2.2, 0.2);
  shape.bezierCurveTo(s * 2.5, -0.4, s * 2.2, -1.5, s * 1.6, -1.8);
  shape.bezierCurveTo(s * 1.0, -2.0, s * 0.4, -1.6, s * 0.2, -1.0);
  shape.bezierCurveTo(s * 0.1, -0.6, s * 0.05, -0.2, 0, -0.5);
  shape.lineTo(0, 0.5);

  const geom = new THREE.ShapeGeometry(shape, 6);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const sizeX = bb.max.x - bb.min.x || 1;
  const sizeY = bb.max.y - bb.min.y || 1;
  const pos = geom.attributes.position;
  const uvs = [];

  for (let i = 0; i < pos.count; i++) {
    uvs.push((pos.getX(i) - bb.min.x) / sizeX, (pos.getY(i) - bb.min.y) / sizeY);
  }
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.userData.isSharedAsset = true;
  return geom;
}

function createBodyGeom() {
  const points = [
    new THREE.Vector2(0.001, 0.8), new THREE.Vector2(0.14, 0.7),
    new THREE.Vector2(0.10, 0.5), new THREE.Vector2(0.18, 0.3),
    new THREE.Vector2(0.12, 0.0), new THREE.Vector2(0.15, -0.2),
    new THREE.Vector2(0.12, -0.4), new THREE.Vector2(0.08, -0.7),
    new THREE.Vector2(0.001, -0.9)
  ];
  const geom = new THREE.LatheGeometry(points, 5);
  geom.userData.isSharedAsset = true;
  return geom;
}

// 🌟 임시 더듬이 지오메트리 공유화 (매 생성 시 메모리 누수 원천 차단)
const sharedAntennaTipGeom = new THREE.SphereGeometry(0.09, 4, 4);
sharedAntennaTipGeom.userData.isSharedAsset = true;

const sharedAntennaTubeGeomL = (function() {
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, 0.5, 0.1),
    new THREE.Vector3(-0.5, 0.9, 0.2), new THREE.Vector3(-0.65, 1.2, 0.3)
  );
  const geom = new THREE.TubeGeometry(curve, 5, 0.035, 3, false);
  geom.userData.isSharedAsset = true;
  return geom;
})();

const sharedAntennaTubeGeomR = (function() {
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0.5, 0.1),
    new THREE.Vector3(0.5, 0.9, 0.2), new THREE.Vector3(0.65, 1.2, 0.3)
  );
  const geom = new THREE.TubeGeometry(curve, 5, 0.035, 3, false);
  geom.userData.isSharedAsset = true;
  return geom;
})();

function createAntenna(isRight, mat) {
  const group = new THREE.Group();
  const s = isRight ? 1 : -1;
  const tubeGeom = isRight ? sharedAntennaTubeGeomR : sharedAntennaTubeGeomL;
  const tube = new THREE.Mesh(tubeGeom, mat);
  group.add(tube);
  const tip = new THREE.Mesh(sharedAntennaTipGeom, mat);
  tip.position.set(s * 0.65, 1.2, 0.3);
  group.add(tip);
  return group;
}

const textureCache = {};
const blurredTextureCache = {};
const patternTextureCache = {};
let resolvedPatternBasePath = null;
const candidatePatternBases = [
  '3DButterfly_pattern/',
  './3DButterfly_pattern/',
  '../3DButterfly_pattern/',
  'index/3DButterfly_pattern/',
  './index/3DButterfly_pattern/',
  '../index/3DButterfly_pattern/',
  '../../3DButterfly_pattern/'
];

function get3DPatternFileName(shapeKey, patId) {
  if (!patId || typeof patId !== 'string' || patId.indexOf('none') > -1) return null;
  const parts = patId.split('_');
  const patNum = parts[parts.length - 1] || '1';

  let shapePrefix = shapeKey || 'crescent';
  if (shapePrefix === 'moon-halo' || shapePrefix === 'moon') shapePrefix = 'moon-halo';
  else if (shapePrefix === 'dawn-ray' || shapePrefix === 'dawn') shapePrefix = 'dawn-ray';
  else if (shapePrefix === 'wave-fin' || shapePrefix === 'wave') shapePrefix = 'wave-fin';

  return shapePrefix + '_pattern_3D_' + patNum + '.png';
}

function getOrLoadPatternTexture(fileName, onReady) {
  if (!fileName) return null;
  if (patternTextureCache[fileName]) {
    if (onReady) onReady(patternTextureCache[fileName]);
    return patternTextureCache[fileName];
  }

  const bases = resolvedPatternBasePath ? [resolvedPatternBasePath] : candidatePatternBases;
  let idx = 0;

  function tryNextPatternBase() {
    if (idx >= bases.length) {
      if (onReady) onReady(null);
      return;
    }
    const base = bases[idx++];
    const fullUrl = base + fileName;

    textureLoader.load(
      fullUrl,
      (tex) => {
        resolvedPatternBasePath = base;
        tex.flipY = false;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
        patternTextureCache[fileName] = tex;
        if (onReady) onReady(tex);
      },
      undefined,
      () => {
        tryNextPatternBase();
      }
    );
  }

  tryNextPatternBase();
  return null;
}

const sharedDummyWhiteTexture = (function() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 4, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
})();

const sharedEmptyPatternTexture = new THREE.Texture();

const WING_VERTEX_SHADER = [
  'varying vec2 vProjectedUv;',
  'varying vec2 vModelUv;',
  'void main() {',
  '  vModelUv = uv;',
  '  float u = (position.x + 2.4) / 4.8;',
  '  float v = (position.y + 2.4) / 4.8;',
  '  vProjectedUv = vec2(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

const WING_FRAGMENT_SHADER = [
  'uniform sampler2D photoMap;',
  'uniform sampler2D patMap;',
  'uniform float hasPattern;',
  'varying vec2 vProjectedUv;',
  'varying vec2 vModelUv;',
  'void main() {',
  '  vec4 photoCol = texture2D(photoMap, vProjectedUv);',
  '  vec4 finalCol = photoCol;',
  '  if (hasPattern > 0.5) {',
  '    vec4 patCol = texture2D(patMap, vModelUv);',
  '    finalCol.rgb = mix(finalCol.rgb, finalCol.rgb * patCol.rgb, patCol.a * 0.95);',
  '  }',
  '  float edgeGlow = smoothstep(0.15, 0.68, length(vProjectedUv - vec2(0.5)));',
  '  finalCol.rgb += vec3(1.0, 1.0, 1.0) * edgeGlow * 0.24;',
  '  gl_FragColor = vec4(clamp(finalCol.rgb, 0.0, 1.0), finalCol.a);',
  '}'
].join('\n');

function createStandardWingMaterial(textureURL, patternFileName) {
  let photoTex = sharedDummyWhiteTexture;
  let mat = null;

  if (textureURL) {
    photoTex = textureCache[textureURL];
    if (!photoTex) {
      photoTex = textureLoader.load(
        textureURL,
        undefined,
        undefined,
        () => {
          // 🌟 네트워크 순단 등으로 텍스처 로드 실패 시 깨진 캐시를 제거하고 기본 흰색 텍스처로 폴백
          delete textureCache[textureURL];
          if (mat && mat.uniforms && mat.uniforms.photoMap) {
            mat.uniforms.photoMap.value = sharedDummyWhiteTexture;
            mat.needsUpdate = true;
          }
        }
      );
      photoTex.flipY = false;
      photoTex.generateMipmaps = false;
      photoTex.minFilter = THREE.LinearFilter;
      if (THREE.sRGBEncoding) photoTex.encoding = THREE.sRGBEncoding;
      textureCache[textureURL] = photoTex;
    }
  }

  mat = new THREE.ShaderMaterial({
    uniforms: {
      photoMap: { value: photoTex },
      patMap: { value: sharedEmptyPatternTexture },
      hasPattern: { value: 0.0 }
    },
    vertexShader: WING_VERTEX_SHADER,
    fragmentShader: WING_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true
  });

  if (patternFileName) {
    getOrLoadPatternTexture(patternFileName, (loadedPatTex) => {
      if (loadedPatTex && mat && mat.uniforms) {
        mat.uniforms.patMap.value = loadedPatTex;
        mat.uniforms.hasPattern.value = 1.0;
        mat.needsUpdate = true;
      }
    });
  }

  return mat;
}

const BODY_BLUR_VERTEX_SHADER = [
  'varying vec2 vProjectedUv;',
  'void main() {',
  '  float u = (position.x + 2.4) / 4.8;',
  '  float v = (position.y + 2.4) / 4.8;',
  '  vProjectedUv = vec2(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

const BODY_BLUR_FRAGMENT_SHADER = [
  'uniform sampler2D photoMap;',
  'varying vec2 vProjectedUv;',
  'void main() {',
  '  vec4 sum = vec4(0.0);',
  '  float stepSize = 0.045;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(-stepSize, -stepSize), 0.0, 1.0)) * 0.0625;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(0.0, -stepSize), 0.0, 1.0)) * 0.125;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(stepSize, -stepSize), 0.0, 1.0)) * 0.0625;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(-stepSize, 0.0), 0.0, 1.0)) * 0.125;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv, 0.0, 1.0)) * 0.25;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(stepSize, 0.0), 0.0, 1.0)) * 0.125;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(-stepSize, stepSize), 0.0, 1.0)) * 0.0625;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(0.0, stepSize), 0.0, 1.0)) * 0.125;',
  '  sum += texture2D(photoMap, clamp(vProjectedUv + vec2(stepSize, stepSize), 0.0, 1.0)) * 0.0625;',
  '  gl_FragColor = vec4(clamp(sum.rgb, 0.0, 1.0), 1.0);',
  '}'
].join('\n');

function createStandardBodyMaterial(textureURL, bodyColorMode) {
  const mode = bodyColorMode || 'white';
  if (mode === 'black') {
    return sharedBlackMat;
  }
  if (mode === 'blur') {
    let photoTex = sharedDummyWhiteTexture;
    if (textureURL) {
      photoTex = blurredTextureCache[textureURL];
      if (!photoTex) {
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = 256;
        blurCanvas.height = 256;
        const bctx = blurCanvas.getContext('2d', { willReadFrequently: true });
        bctx.fillStyle = '#d4d4d8';
        bctx.fillRect(0, 0, 256, 256);

        const canvasTex = new THREE.CanvasTexture(blurCanvas);
        canvasTex.flipY = false;
        canvasTex.generateMipmaps = false;
        canvasTex.minFilter = THREE.LinearFilter;
        if (THREE.sRGBEncoding) canvasTex.encoding = THREE.sRGBEncoding;
        blurredTextureCache[textureURL] = canvasTex;
        photoTex = canvasTex;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          bctx.drawImage(img, 0, 0, 256, 256);
          executeReliableFastBlur(blurCanvas, 18);
          executeReliableFastBlur(blurCanvas, 12);
          canvasTex.needsUpdate = true;
        };
        img.onerror = () => {
          delete blurredTextureCache[textureURL];
        };
        img.src = textureURL;
      }
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        photoMap: { value: photoTex }
      },
      vertexShader: BODY_BLUR_VERTEX_SHADER,
      fragmentShader: BODY_BLUR_FRAGMENT_SHADER,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });
    return mat;
  }
  return sharedWhiteMat;
}

function applyProjectedUVsToGeometry(geometry) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
  const pos = geometry.attributes.position;
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = Math.max(0.0, Math.min(1.0, (x + 2.4) / 4.8));
    const v = Math.max(0.0, Math.min(1.0, 1.0 - (y + 2.4) / 4.8));
    uvs[i * 2 + 0] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.attributes.uv.needsUpdate = true;
}

const modelCache = {};
const modelLoadingPromises = {};
let resolvedBasePath = null;

const candidateBases = [
  '3DButterfly/',
  './3DButterfly/',
  '../3DButterfly/',
  'index/3DButterfly/',
  './index/3DButterfly/',
  '../index/3DButterfly/',
  '../../3DButterfly/'
];

function getOrLoadModel(modelName) {
  if (modelCache[modelName]) {
    return Promise.resolve(modelCache[modelName]);
  }
  if (modelLoadingPromises[modelName]) {
    return modelLoadingPromises[modelName];
  }

  const bases = resolvedBasePath ? [resolvedBasePath] : candidateBases;

  modelLoadingPromises[modelName] = new Promise((resolve) => {
    let idx = 0;
    function tryNext() {
      if (idx >= bases.length) {
        delete modelLoadingPromises[modelName];
        resolve(null);
        return;
      }
      const base = bases[idx++];
      const fullPath = base + modelName + '.glb';

      gltfLoader.load(
        fullPath,
        (gltf) => {
          resolvedBasePath = base;
          // 🌟 원본 캐시 모델의 모든 지오메트리가 실수로 dispose되지 않도록 보호 플래그 지정
          gltf.scene.traverse((child) => {
            if (child.isMesh && child.geometry) {
              child.geometry.userData.isSharedAsset = true;
            }
          });
          modelCache[modelName] = gltf.scene;
          resolve(gltf.scene);
        },
        undefined,
        () => {
          tryNext();
        }
      );
    }
    tryNext();
  });

  return modelLoadingPromises[modelName];
}

const container = document.getElementById('three-canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 14.5);

const renderer = new THREE.WebGLRenderer({ 
  alpha: true, 
  antialias: false, 
  powerPreference: "high-performance",
  precision: "mediump",
  stencil: false,
  depth: true
});

// 🌟 고해상도(QHD/4K) 프로젝터·스크린 연결 시 과도한 픽셀 셰이더 부하 방지를 위해 내부 해상도를 최대 Full HD(1920px)로 캡핑
function updateRendererSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const renderScale = Math.min(1.0, 1920 / Math.max(w, 1));
  renderer.setPixelRatio(1.0);
  renderer.setSize(Math.round(w * renderScale), Math.round(h * renderScale), false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
}
updateRendererSize();

if (THREE.sRGBEncoding) {
  renderer.outputEncoding = THREE.sRGBEncoding;
}
container.appendChild(renderer.domElement);

// 🌟 장시간 전시 중 디스플레이 절전 신호나 드라이버 리셋으로 WebGL 컨텍스트 유실 시 온라인 상태를 확인하며 안전하게 자동 새로고침 복구
let contextLostRecoveryTimer = null;
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  if (!isAutoReloading && !contextLostRecoveryTimer) {
    console.warn('WebGL 컨텍스트 유실 감지: 네트워크 상태 확인 후 화면을 복구합니다.');
    const attemptContextRecovery = () => {
      if (navigator.onLine !== false) {
        window.location.reload();
      } else {
        contextLostRecoveryTimer = setTimeout(attemptContextRecovery, 2000);
      }
    };
    contextLostRecoveryTimer = setTimeout(attemptContextRecovery, 2000);
  }
}, false);

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const gltfLoader = new THREE.GLTFLoader();
const leftGeom = createStableWingGeom(false);
const rightGeom = createStableWingGeom(true);
const bodyGeom = createBodyGeom();

// 🌟 7종 나비 3D 모델 백그라운드 사전 프리로딩 (런타임 중 GLB 파싱 렉 방지)
setTimeout(() => {
  BUTTERFLY_SHAPES.forEach((shapeName, idx) => {
    setTimeout(() => { getOrLoadModel(shapeName); }, idx * 180);
  });
}, 300);

// 🌟 미사용 텍스처 캐시 자동 가비지 컬렉션 (장시간 구동 시 VRAM 누적 방지)
function cleanupUnusedTextures() {
  const allKeys = new Set([
    ...Object.keys(textureCache),
    ...Object.keys(blurredTextureCache)
  ]);
  allKeys.forEach((key) => {
    const inRecentList = rawUserDataList.some(d => (d.texture_url || d.image_url) === key);
    const inFlock = userFlock.some(uf => uf && uf.textureURL === key);
    const inCeremonyQueue = ceremonyQueue.some(d => (d.texture_url || d.image_url) === key);
    const inActiveCeremony = activeCeremonyButterfly && activeCeremonyButterfly.textureURL === key;
    const inSpecial = specialButterfly && specialButterfly.textureURL === key;

    if (!inRecentList && !inFlock && !inCeremonyQueue && !inActiveCeremony && !inSpecial) {
      if (textureCache[key]) {
        textureCache[key].dispose();
        delete textureCache[key];
      }
      if (blurredTextureCache[key]) {
        blurredTextureCache[key].dispose();
        delete blurredTextureCache[key];
      }
    }
  });
}

function disposeButterfly(b) {
  if (!b || !b.group) return;
  b.isDisposed = true;
  scene.remove(b.group);
  b.group.traverse((child) => {
    if (child.isMesh) {
      // 🌟 오직 개별 복제된 날개 지오메트리(isClonedWing)만 안전하게 해제하고 공유 원본은 절대 건드리지 않음
      if (child.geometry && child.geometry.userData && child.geometry.userData.isClonedWing === true) {
        child.geometry.dispose();
      }
      if (child.material && child.material !== sharedWhiteMat && child.material !== sharedBlackMat && child.material !== sharedHaloMat) {
        child.material.dispose();
      }
    }
  });
  cleanupUnusedTextures();
}

/* ========================================================
   🌟 팅커벨 별가루 파티클 고화질 텍스처 (사진 100% 매칭: 중심 또렷 + 외곽 은은)
   ======================================================== */
const dustCanvas = document.createElement('canvas');
dustCanvas.width = 32; dustCanvas.height = 32;
const dustCtx = dustCanvas.getContext('2d');
const dustGrad = dustCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
dustGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
dustGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.95)');
dustGrad.addColorStop(0.60, 'rgba(255, 255, 255, 0.40)');
dustGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
dustCtx.fillStyle = dustGrad;
dustCtx.fillRect(0, 0, 32, 32);
const dustTexture = new THREE.CanvasTexture(dustCanvas);
dustTexture.needsUpdate = true;

// 🌟 특수 나비(손가락/세레머니) 전용 후광(Halo) 공유 스프라이트 재질 (순수 무채색 화이트 광원)
const sharedHaloMat = new THREE.SpriteMaterial({
  map: dustTexture,
  color: 0xffffff,
  transparent: true,
  opacity: 0.28,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

/* ========================================================
   1) 세레머니 나비용 파티클 시스템
   ======================================================== */
const CEREMONY_PARTICLES = 160;
const ceremonyParticlePositions = new Float32Array(CEREMONY_PARTICLES * 3);
const ceremonyParticleData = [];

for (let i = 0; i < CEREMONY_PARTICLES; i++) {
  ceremonyParticleData.push({ x: 9999, y: 9999, z: 9999, vx: 0, vy: 0, vz: 0, life: 0 });
  ceremonyParticlePositions[i * 3 + 0] = 9999;
  ceremonyParticlePositions[i * 3 + 1] = 9999;
  ceremonyParticlePositions[i * 3 + 2] = 9999;
}

const ceremonyParticleGeom = new THREE.BufferGeometry();
ceremonyParticleGeom.setAttribute('position', new THREE.BufferAttribute(ceremonyParticlePositions, 3));

// 🌟 size: 0.11 (화면상 6~9px 크기의 섬세하고 선명한 별가루 입자)
const ceremonyParticleMat = new THREE.PointsMaterial({
  map: dustTexture,
  size: 0.11,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  color: 0xffffff
});
const ceremonyParticlePoints = new THREE.Points(ceremonyParticleGeom, ceremonyParticleMat);
ceremonyParticlePoints.frustumCulled = false;
scene.add(ceremonyParticlePoints);

let ceremonyParticleCursor = 0;
let hasActiveCeremonyParticles = false;

// 🌟 나비 아래쪽에서 생성되어 위로 솔솔 피어오르는 팅커벨 가루
function spawnCeremonyParticle(pos) {
  const p = ceremonyParticleData[ceremonyParticleCursor];
  p.x = pos.x + (Math.random() - 0.5) * 0.85;
  p.y = pos.y - 0.40 - Math.random() * 0.35; // 나비 아래쪽
  p.z = (pos.z || 8.0) + (Math.random() - 0.5) * 0.35;
  p.vx = (Math.random() - 0.5) * 0.012;
  p.vy = 0.022 + Math.random() * 0.026; // 위쪽으로 상승
  p.vz = (Math.random() - 0.5) * 0.010;
  p.life = 0.80 + Math.random() * 0.35;

  ceremonyParticleCursor = (ceremonyParticleCursor + 1) % CEREMONY_PARTICLES;
  hasActiveCeremonyParticles = true;
}

function updateCeremonyParticles(dt) {
  if (!hasActiveCeremonyParticles) return;
  let needsUpdate = false;
  let anyAlive = false;
  const posAttr = ceremonyParticleGeom.attributes.position;
  for (let i = 0; i < CEREMONY_PARTICLES; i++) {
    const p = ceremonyParticleData[i];
    if (p.life > 0) {
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy; // 위로 피어오름
      p.z += p.vz;
      posAttr.setXYZ(i, p.x, p.y, p.z);
      needsUpdate = true;
      anyAlive = true;
    } else if (p.x !== 9999) {
      p.x = 9999;
      posAttr.setXYZ(i, 9999, 9999, 9999);
      needsUpdate = true;
    }
  }
  if (needsUpdate) posAttr.needsUpdate = true;
  hasActiveCeremonyParticles = anyAlive;
}

/* ========================================================
   2) 손가락 나비용 파티클 시스템
   ======================================================== */
const ENERGY_PARTICLES_COUNT = 180;
const energyParticlePositions = new Float32Array(ENERGY_PARTICLES_COUNT * 3);
const energyParticleData = [];

for (let i = 0; i < ENERGY_PARTICLES_COUNT; i++) {
  energyParticleData.push({ x: 9999, y: 9999, z: 9999, vx: 0, vy: 0, vz: 0, life: 0 });
  energyParticlePositions[i * 3 + 0] = 9999;
  energyParticlePositions[i * 3 + 1] = 9999;
  energyParticlePositions[i * 3 + 2] = 9999;
}

const energyParticleGeom = new THREE.BufferGeometry();
energyParticleGeom.setAttribute('position', new THREE.BufferAttribute(energyParticlePositions, 3));

// 🌟 size: 0.11 (화면상 6~9px 크기의 섬세하고 선명한 별가루 입자)
const energyParticleMat = new THREE.PointsMaterial({
  map: dustTexture,
  size: 0.11,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  color: 0xffffff
});
const energyParticlePoints = new THREE.Points(energyParticleGeom, energyParticleMat);
energyParticlePoints.frustumCulled = false;
scene.add(energyParticlePoints);

let energyParticleCursor = 0;
let hasActiveEnergyParticles = false;

// 🌟 나비 아래쪽에서 생성되어 위로 솔솔 피어오르는 팅커벨 가루
function spawnEnergyParticle(pos) {
  const p = energyParticleData[energyParticleCursor];
  p.x = pos.x + (Math.random() - 0.5) * 0.85;
  p.y = pos.y - 0.40 - Math.random() * 0.35; // 나비 아래쪽
  p.z = (pos.z || 8.0) + (Math.random() - 0.5) * 0.35;
  p.vx = (Math.random() - 0.5) * 0.012;
  p.vy = 0.022 + Math.random() * 0.026; // 위쪽으로 상승
  p.vz = (Math.random() - 0.5) * 0.010;
  p.life = 0.80 + Math.random() * 0.35;

  energyParticleCursor = (energyParticleCursor + 1) % ENERGY_PARTICLES_COUNT;
  hasActiveEnergyParticles = true;
}

function updateEnergyParticles(dt) {
  if (!hasActiveEnergyParticles) return;
  let needsUpdate = false;
  let anyAlive = false;
  const posAttr = energyParticleGeom.attributes.position;
  for (let i = 0; i < ENERGY_PARTICLES_COUNT; i++) {
    const p = energyParticleData[i];
    if (p.life > 0) {
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy; // 위로 피어오름
      p.z += p.vz;
      posAttr.setXYZ(i, p.x, p.y, p.z);
      needsUpdate = true;
      anyAlive = true;
    } else if (p.x !== 9999) {
      p.x = 9999;
      posAttr.setXYZ(i, 9999, 9999, 9999);
      needsUpdate = true;
    }
  }
  if (needsUpdate) posAttr.needsUpdate = true;
  hasActiveEnergyParticles = anyAlive;
}

const defaultFlock = [];
const userFlock = [];
const MAX_USER_BUTTERFLIES = 30;
const MAX_RECENT_USER_DATA = 45; // 🌟 VRAM 점유율 최적화를 위해 최근 사용자 나비 보관 개수를 45개로 제한
const rawUserDataList = [];

function attachClonedGLTFModel(sceneTemplate, innerGroup, wingMat, bodyMat, targetAntennaPrefix) {
  const model = sceneTemplate.clone(true);
  let newWingL = null, newWingR = null;
  const meshesToRemove = [];
  const activeBodyMat = bodyMat || sharedWhiteMat;

  model.traverse(function(child) {
    if (child.isMesh) {
      const name = child.name || '';
      if (name.startsWith('Wing_L')) { 
        newWingL = child; 
        newWingL.userData.baseRotY = child.rotation.y;
        child.material = wingMat; 
      }
      else if (name.startsWith('Wing_R')) { 
        newWingR = child; 
        newWingR.userData.baseRotY = child.rotation.y;
        child.material = wingMat; 
      }
      else if (name.startsWith('Body')) { 
        child.material = activeBodyMat; 
      }
      else if (name.startsWith('Antenna_')) { 
        if (name.startsWith(targetAntennaPrefix)) {
          child.material = activeBodyMat;
        } else {
          meshesToRemove.push(child);
        }
      }
    }
  });

  meshesToRemove.forEach((m) => {
    if (m.parent) m.parent.remove(m);
  });

  if (newWingL && newWingR) {
    model.scale.set(0.95, 0.95, 0.95);
    innerGroup.add(model);
    return { newWingL, newWingR };
  }
  return null;
}

function buildButterfly(data = {}, isUser = false, isDelayedArrival = false, isFingerTarget = false, customZ = 8.0, isCeremony = false) {
  const group = new THREE.Group();
  const innerGroup = new THREE.Group(); 

  // 🌟 손가락으로 불러오거나(isFingerTarget) 사용자가 날려서 나오는 세레머니 나비(isCeremony)에만 후광(Halo) 부착
  let haloSprite = null;
  if (isFingerTarget || isCeremony) {
    haloSprite = new THREE.Sprite(sharedHaloMat);
    haloSprite.scale.set(5.5, 5.5, 1.0);
    haloSprite.position.set(0, 0, -0.2);
    innerGroup.add(haloSprite);
  }

  const shapeId = data.wing_shape || DEFAULT_BUTTERFLY_SHAPES[Math.floor(Math.random() * DEFAULT_BUTTERFLY_SHAPES.length)];
  const rawAntStr = String(data.antenna_type || 'ball');
  const antParts = rawAntStr.split('__');
  const antId = antParts[0] || 'ball';
  const bodyColorMode = data.body_color || antParts[1] || 'white';
  const patId = data.pattern_id || data.pattern || null;
  const targetAntennaPrefix = 'Antenna_' + antId;

  const textureURL = data.texture_url || data.image_url;
  const patternFileName = isUser ? get3DPatternFileName(shapeId, patId) : null;
  const hasCustomWing = !!(isUser && (textureURL || patternFileName));

  const wingMat = hasCustomWing ? createStandardWingMaterial(textureURL, patternFileName) : sharedWhiteMat;
  const bodyMat = isUser ? createStandardBodyMaterial(textureURL, bodyColorMode) : sharedWhiteMat;

  let leftWing = null;
  let rightWing = null;
  let defaultBody = null;
  let aL = null;
  let aR = null;

  // 🌟 이미 모델 캐시에 로드된 경우 불필요한 임시 메쉬 5개를 생성·삭제하지 않고 즉시 장착
  if (modelCache[shapeId]) {
    const attached = attachClonedGLTFModel(modelCache[shapeId], innerGroup, wingMat, bodyMat, targetAntennaPrefix);
    if (attached) {
      leftWing = attached.newWingL;
      rightWing = attached.newWingR;
    }
  }

  if (!leftWing || !rightWing) {
    leftWing = new THREE.Mesh(leftGeom, sharedWhiteMat);
    rightWing = new THREE.Mesh(rightGeom, sharedWhiteMat);
    defaultBody = new THREE.Mesh(bodyGeom, bodyMat);

    innerGroup.add(leftWing);
    innerGroup.add(rightWing);
    innerGroup.add(defaultBody);
    
    aL = createAntenna(false, bodyMat); aL.position.set(-0.05, 0.7, 0.15); innerGroup.add(aL);
    aR = createAntenna(true, bodyMat); aR.position.set(0.05, 0.7, 0.15); innerGroup.add(aR);

    if (gltfLoader) {
      getOrLoadModel(shapeId).then((sceneTemplate) => {
        if (!sceneTemplate || butterflyRecord.isDisposed) return;
        const attached = attachClonedGLTFModel(sceneTemplate, innerGroup, wingMat, bodyMat, targetAntennaPrefix);
        if (attached) {
          innerGroup.remove(leftWing);
          innerGroup.remove(rightWing);
          innerGroup.remove(defaultBody);
          innerGroup.remove(aL);
          innerGroup.remove(aR);
          butterflyRecord.leftWing = attached.newWingL;
          butterflyRecord.rightWing = attached.newWingR;
        }
      });
    }
  }

  innerGroup.rotation.set(isCeremony ? 0 : Math.PI / 2, isCeremony ? 0 : Math.PI, 0);
  group.add(innerGroup);

  let initialVelocity;
  let targetScale = data.customScale || (0.62 + Math.random() * 0.14);

  const targetBPM = (targetScale < 0.35) ? (115 + Math.random() * 20) : 100;
  const flapSpeed = (targetBPM / 60) * 2 * Math.PI * 2;
  const initialSpeed = 0.080 + Math.random() * 0.020;

  let initScreenAngle = Math.random() * Math.PI * 2;
  let initDepthAngle = (Math.random() - 0.5) * 0.35;

  if (isCeremony) {
    group.position.set(0, -7.5, 8.0);
    initialVelocity = new THREE.Vector3(0, 0.034, 0);
    targetScale = 0.65;
    group.scale.set(0.65, 0.65, 0.65);
    group.rotation.set(0, 0, 0);
    initScreenAngle = Math.PI / 2;
  } else if (isFingerTarget) {
    group.position.set(-14.0, 8.5, 8.0);
    initialVelocity = new THREE.Vector3(0.06, -0.04, 0);
    initScreenAngle = -Math.PI / 6;
    targetScale = 0.88;
    group.scale.set(0.88, 0.88, 0.88);
  } else if (isDelayedArrival) {
    const fromTop = Math.random() < 0.5;
    group.position.set((Math.random() - 0.5) * 10, fromTop ? 8.0 : -7.5, 1.5);
    initialVelocity = new THREE.Vector3(0.04, fromTop ? -0.09 : 0.09, -0.01);
    initScreenAngle = fromTop ? -Math.PI / 2 : Math.PI / 2;
    group.scale.set(0.01, 0.01, 0.01);
  } else {
    const spawnMode = Math.floor(Math.random() * 5);
    let spawnX = 0, spawnY = 0;

    if (spawnMode === 0) {
      spawnX = (Math.random() - 0.5) * 18;
      spawnY = 6.8 + Math.random() * 1.5;
      initScreenAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    } else if (spawnMode === 1) {
      spawnX = (Math.random() - 0.5) * 18;
      spawnY = -6.8 - Math.random() * 1.5;
      initScreenAngle = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    } else if (spawnMode === 2) {
      spawnX = -13.5 - Math.random() * 2.0;
      spawnY = (Math.random() - 0.5) * 10;
      initScreenAngle = 0 + (Math.random() - 0.5) * 1.2;
    } else if (spawnMode === 3) {
      spawnX = 13.5 + Math.random() * 2.0;
      spawnY = (Math.random() - 0.5) * 10;
      initScreenAngle = Math.PI + (Math.random() - 0.5) * 1.2;
    } else {
      spawnX = (Math.random() - 0.5) * 16;
      spawnY = (Math.random() - 0.5) * 8.5;
      initScreenAngle = Math.random() * Math.PI * 2;
    }

    group.position.set(spawnX, spawnY, -0.5 - Math.random() * 5.0);

    const cosD = Math.cos(initDepthAngle);
    initialVelocity = new THREE.Vector3(
      cosD * Math.cos(initScreenAngle) * initialSpeed,
      cosD * Math.sin(initScreenAngle) * initialSpeed,
      Math.sin(initDepthAngle) * initialSpeed
    );
    group.scale.set(targetScale, targetScale, targetScale);
  }

  scene.add(group);

  const rawReason = data.concern_reason 
    || (Array.isArray(data.q1) && data.q1.length > 0 && typeof data.q1[0] === 'string' && data.q1[0].trim().length > 0 ? data.q1[0].trim() : null);
  const resolvedReason = sanitizeDisplayText(rawReason) || "항상 잘 해내야 한다는 마음이 앞서서요.";
  const resolvedName = sanitizeDisplayText(data.name) || (isUser ? "익명의 나비" : "나비");
  const resolvedMemo = sanitizeDisplayText(data.memo) || "너의 찬란한 날갯짓을 응원해.";
  const rawConcern = data.core_concern || (Array.isArray(data.q2) && data.q2.length > 0 ? data.q2[0] : "완벽주의 강박");
  const resolvedConcern = sanitizeDisplayText(rawConcern) || "완벽주의 강박";

  const butterflyRecord = {
    id: Math.random().toString(36).substring(7),
    isUser: isUser,
    isDisposed: false,
    textureURL: textureURL || null,
    group, innerGroup, leftWing, rightWing, haloSprite,
    velocity: initialVelocity,
    speed: flapSpeed,
    seed: Math.random() * 1000,
    wingPhase: Math.random() * Math.PI * 2,
    flapAmp: 1.0, 
    state: 'flying',
    targetScale: targetScale,
    isAscendingArrival: isDelayedArrival,
    arrivalTimer: 0,
    isSpecialLanding: isFingerTarget,
    specialState: isFingerTarget ? 'approaching' : null,
    leavingTimer: 0,
    isCeremony: isCeremony,
    ceremonyStage: isCeremony ? 'rising' : null,
    ceremonyRestTimer: 0,
    takeoffTimer: 0,
    name: resolvedName,
    memo: resolvedMemo,
    core_concern: resolvedConcern,
    concern_reason: resolvedReason,
    screenAngle: initScreenAngle,
    depthAngle: initDepthAngle,
    speedBase: initialSpeed,
    turnRateAngle: 0,
    turnRateDepth: 0,
    angleBias: (Math.random() - 0.5) * 0.008,
    rollBias: (Math.random() - 0.5) * 0.10,
    dirChangeTimer: Math.random() * 3.0,
    strokePower: 0,
    prevBobY: 0
  };

  return butterflyRecord;
}

const TOTAL_DEFAULT_BUTTERFLIES = 40;

for (let i = 0; i < TOTAL_DEFAULT_BUTTERFLIES; i++) {
  const assignedShape = DEFAULT_BUTTERFLY_SHAPES[i % DEFAULT_BUTTERFLY_SHAPES.length];
  let scale;
  if (i < 8) {
    scale = 0.58 + Math.random() * 0.14;
  } else if (i < 22) {
    scale = 0.32 + Math.random() * 0.14;
  } else {
    scale = 0.16 + Math.random() * 0.12;
  }
  defaultFlock.push(buildButterfly({ wing_shape: assignedShape, antenna_type: 'ball', customScale: scale }, false, false, false));
}