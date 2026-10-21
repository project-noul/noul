function setupCommon3DScene(container, camZ, lookY) {
  if (!container || !window.THREE) return null;
  container.innerHTML = '';
  var w = container.clientWidth || window.innerWidth;
  var h = container.clientHeight || window.innerHeight;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 0, camZ || 7.5);
  camera.lookAt(0, lookY || 0, 0);

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (THREE.sRGBEncoding) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  container.appendChild(renderer.domElement);

  var amb = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(amb);
  var dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(0, 5, 10);
  scene.add(dir);

  return { scene: scene, camera: camera, renderer: renderer };
}

function disposeThreeRenderer(renderer) {
  if (!renderer) return;
  try {
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
  } catch (e) {}
}

function createBodyMaterial(textureURL, bodyColorMode) {
  var mode = bodyColorMode || (typeof selectedBodyColor !== 'undefined' ? selectedBodyColor : 'white');

  if (mode === 'black') {
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide
    });
  }

  if (mode === 'blur') {
    var texUrl = textureURL || (typeof currentExtractedTexture !== 'undefined' && currentExtractedTexture) || createFallbackDummyTexture('#ffffff', '#cfcfcf');
    var blurCanvas = document.createElement('canvas');
    blurCanvas.width = 256;
    blurCanvas.height = 256;
    var bctx = blurCanvas.getContext('2d', { willReadFrequently: true });
    bctx.fillStyle = '#d4d4d8';
    bctx.fillRect(0, 0, 256, 256);

    var photoTex = new THREE.CanvasTexture(blurCanvas);
    photoTex.flipY = false;
    photoTex.generateMipmaps = true;
    photoTex.minFilter = THREE.LinearMipmapLinearFilter;
    photoTex.magFilter = THREE.LinearFilter;
    if (THREE.sRGBEncoding) photoTex.encoding = THREE.sRGBEncoding;

    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      bctx.drawImage(img, 0, 0, 256, 256);
      if (typeof executeReliableFastBlur === 'function') {
        executeReliableFastBlur(blurCanvas, 18);
        executeReliableFastBlur(blurCanvas, 12);
      }
      photoTex.needsUpdate = true;
    };
    img.src = texUrl;

    return new THREE.ShaderMaterial({
      uniforms: {
        photoMap: { value: photoTex }
      },
      vertexShader: [
        'varying vec2 vProjectedUv;',
        'void main() {',
        '  float u = (position.x + 2.4) / 4.8;',
        '  float v = (position.y + 2.4) / 4.8;',
        '  vProjectedUv = vec2(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
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
      ].join('\n'),
      side: THREE.DoubleSide
    });
  }

  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  });
}

function loadButterflyModel(group, shapeId, antId, wingMaterials, whiteMat, scale, onLoaded) {
  if (!window.THREE || !THREE.GLTFLoader) return;
  var modelPath = '3DButterfly/' + (shapeId || 'crescent') + '.glb';
  var cleanAntId = String(antId || 'ball').split('__')[0] || 'ball';
  var targetAnt = 'Antenna_' + cleanAntId;

  var matL = wingMaterials && wingMaterials.matL ? wingMaterials.matL : wingMaterials;
  var matR = wingMaterials && wingMaterials.matR ? wingMaterials.matR : wingMaterials;

  new THREE.GLTFLoader().load(modelPath, function(gltf) {
    if (!group) return;
    var model = gltf.scene;
    var wL = null, wR = null;

    model.traverse(function(child) {
      if (child.isMesh) {
        var n = child.name || '';
        if (n.indexOf('Wing_L') === 0 || n.startsWith('Wing_L')) {
          wL = child;
          wL.userData.baseRotX = child.rotation.x;
          wL.userData.baseRotY = child.rotation.y;
          wL.userData.baseRotZ = child.rotation.z;
          child.material = matL;
          child.castShadow = true;
          child.receiveShadow = true;
        }
        else if (n.indexOf('Wing_R') === 0 || n.startsWith('Wing_R')) {
          wR = child;
          wR.userData.baseRotX = child.rotation.x;
          wR.userData.baseRotY = child.rotation.y;
          wR.userData.baseRotZ = child.rotation.z;
          child.material = matR;
          child.castShadow = true;
          child.receiveShadow = true;
        }
        else if (n.indexOf('Body') === 0 || n.startsWith('Body')) { 
          child.material = whiteMat; 
        }
        else if (n.indexOf('Antenna_') === 0 || n.startsWith('Antenna_')) { 
          child.material = whiteMat; 
          child.visible = n.startsWith(targetAnt); 
        }
      }
    });
    model.scale.set(scale, scale, scale);
    group.add(model);
    if (onLoaded) onLoaded(wL, wR);
  }, undefined, function(err) {
    console.error("모델 로드 오류:", err);
  });
}

var loadingScene, loadingCamera, loadingRenderer, loadingGroup, loadingWingL, loadingWingR;
var loadingAnimFrameId = null;

function initLoading3DScene() {
  stopLoading3DScene();
  var res = setupCommon3DScene(document.getElementById('loading-three-container'), 9.6, 0);
  if (!res) return;
  loadingScene = res.scene; loadingCamera = res.camera; loadingRenderer = res.renderer;

  var fogOverlay = document.querySelector('#screen-loading .loading-blur-vignette-overlay');
  if (fogOverlay) {
    fogOverlay.style.opacity = '1';
  }

  var whiteMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    side: THREE.DoubleSide 
  });
  
  loadingGroup = new THREE.Group();
  loadingGroup.rotation.set(1.12, 2.55, -0.62);
  loadingGroup.position.set(-0.08, -0.35, 0);

  var currentGroup = loadingGroup;
  loadButterflyModel(currentGroup, selectedButterflyShape, selectedAntennaType, { matL: whiteMat, matR: whiteMat }, whiteMat, 0.45, function(l, r) {
    if (loadingGroup !== currentGroup) return;
    loadingWingL = l; loadingWingR = r;
  });
  loadingScene.add(loadingGroup);

  var clock = new THREE.Clock();
  var flapPhase = 0;
  var lastTime = 0;

  (function animateLoading() {
    if (!loadingRenderer || !loadingScene || !loadingCamera) return;
    loadingAnimFrameId = requestAnimationFrame(animateLoading);
    var t = clock.getElapsedTime();
    var dt = Math.min(0.1, t - lastTime);
    lastTime = t;

    // 🌟 10초 동안 0.0 -> 1.0으로 진행되는 부화 진행률 (블러는 끝까지 풀리지 않고 유지)
    var prog = Math.min(1.0, t / 10.0);
    var smoothProg = prog * prog * (3.0 - 2.0 * prog);

    // 🌟 1. 카메라 줌인(Zoom-in): 멀리(9.6) 있던 시점이 진행률에 따라 나비 눈앞(5.7)까지 부드럽게 다가감
    loadingCamera.position.z = 9.6 - (3.9 * smoothProg);

    // 🌟 2. 실루엣 각성 날갯짓: 처음에는 느리고 작게 숨 쉬듯 움직이다가 후반부로 갈수록 힘차고 넓게 날갯짓
    var currentFlapSpeed = 3.8 + (7.2 * smoothProg);
    flapPhase += dt * currentFlapSpeed;
    var currentFlapAmp = 0.42 + (0.48 * smoothProg);
    var flap = (0.48 - 0.12 * smoothProg) + Math.sin(flapPhase) * currentFlapAmp;

    if (loadingWingL && loadingWingR) { 
      var uL = loadingWingL.userData;
      var uR = loadingWingR.userData;
      loadingWingL.rotation.set(uL.baseRotX || 0, (uL.baseRotY || 0) + flap, uL.baseRotZ || 0); 
      loadingWingR.rotation.set(uR.baseRotX || 0, (uR.baseRotY || 0) - flap, uR.baseRotZ || 0); 
    }

    // 🌟 3. 자세 각성: 웅크리고 기울어져 있던 각도에서 점차 중심을 잡고 우아하게 떠오름
    if (loadingGroup) {
      var baseX = -0.08 * (1.0 - smoothProg * 0.85);
      var baseY = -0.35 + (0.28 * smoothProg);
      var baseRotX = 1.12 - (0.34 * smoothProg);
      var baseRotY = 2.55 + (0.52 * smoothProg);
      var baseRotZ = -0.62 + (0.42 * smoothProg);

      loadingGroup.position.x = baseX;
      loadingGroup.position.y = baseY + Math.sin(t * 2.2) * 0.07;
      loadingGroup.rotation.x = baseRotX;
      loadingGroup.rotation.y = baseRotY;
      loadingGroup.rotation.z = baseRotZ + Math.sin(t * 1.5) * 0.04;
    }
    loadingRenderer.render(loadingScene, loadingCamera);
  })();
}

function stopLoading3DScene() {
  if (loadingAnimFrameId) { cancelAnimationFrame(loadingAnimFrameId); loadingAnimFrameId = null; }
  if (loadingRenderer) {
    disposeThreeRenderer(loadingRenderer);
    loadingRenderer = null;
  }
  loadingScene = null;
  loadingCamera = null;
  loadingGroup = null;
  loadingWingL = null;
  loadingWingR = null;
  var c = document.getElementById('loading-three-container');
  if (c) c.innerHTML = '';
  var fogOverlay = document.querySelector('#screen-loading .loading-blur-vignette-overlay');
  if (fogOverlay) {
    fogOverlay.style.opacity = '1';
  }
}

function createWingMaterials(textureURL, patternPath3D) {
  var patPath = (typeof patternPath3D !== 'undefined')
    ? patternPath3D
    : (typeof currentSelected3DPatternPath !== 'undefined' ? currentSelected3DPatternPath : null);

  var texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin('anonymous');

  var photoTex = texLoader.load(textureURL);
  photoTex.flipY = false;
  photoTex.generateMipmaps = true;
  photoTex.minFilter = THREE.LinearMipmapLinearFilter;
  photoTex.magFilter = THREE.LinearFilter;
  photoTex.anisotropy = 4;
  if (THREE.sRGBEncoding) photoTex.encoding = THREE.sRGBEncoding;

  var patTex = null;
  var hasPat = false;
  if (patPath) {
    patTex = texLoader.load(patPath);
    patTex.flipY = false;
    patTex.generateMipmaps = true;
    patTex.minFilter = THREE.LinearMipmapLinearFilter;
    patTex.magFilter = THREE.LinearFilter;
    patTex.anisotropy = 4;
    if (THREE.sRGBEncoding) patTex.encoding = THREE.sRGBEncoding;
    hasPat = true;
  }

  function createCustomWingShader() {
    return new THREE.ShaderMaterial({
      uniforms: {
        photoMap: { value: photoTex },
        patMap: { value: patTex || new THREE.Texture() },
        hasPattern: { value: hasPat ? 1.0 : 0.0 }
      },
      vertexShader: [
        'varying vec2 vProjectedUv;',
        'varying vec2 vModelUv;',
        'void main() {',
        '  vModelUv = uv;',
        '  float u = (position.x + 2.4) / 4.8;',
        '  float v = (position.y + 2.4) / 4.8;',
        '  vProjectedUv = vec2(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
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
        '  gl_FragColor = vec4(clamp(finalCol.rgb, 0.0, 1.0), finalCol.a);',
        '}'
      ].join('\n'),
      side: THREE.DoubleSide
    });
  }

  var matL = createCustomWingShader();
  var matR = createCustomWingShader();

  return { matL: matL, matR: matR };
}

var shareScene, shareCamera, shareRenderer, shareGroup, shareWingL, shareWingR;
var shareAnimFrameId = null;

function initShare3DScene() {
  stopShare3DScene();
  var res = setupCommon3DScene(document.getElementById('share-three-container'), 7.5, 0);
  if (!res) return;
  shareScene = res.scene; shareCamera = res.camera; shareRenderer = res.renderer;

  var texUrl = currentExtractedTexture || createFallbackDummyTexture('#ffffff', '#cfcfcf');
  var wingMats = createWingMaterials(texUrl, currentSelected3DPatternPath);
  var bodyMat = createBodyMaterial(texUrl, typeof selectedBodyColor !== 'undefined' ? selectedBodyColor : 'white');

  shareGroup = new THREE.Group();
  // 🌟 오른쪽으로 기울어지도록 Z축 각도를 +0.35에서 -0.35로 수정
  shareGroup.rotation.set(0.25, -0.8, -0.35);
  shareGroup.position.set(0, 0.45, 0);

  var currentGroup = shareGroup;
  loadButterflyModel(currentGroup, selectedButterflyShape, selectedAntennaType, wingMats, bodyMat, 0.48, function(l, r) {
    if (shareGroup !== currentGroup) return;
    shareWingL = l; shareWingR = r;
  });
  shareScene.add(shareGroup);

  var clock = new THREE.Clock();
  (function animateShare() {
    if (!shareRenderer || !shareScene || !shareCamera) return;
    shareAnimFrameId = requestAnimationFrame(animateShare);
    var t = clock.getElapsedTime(), flap = 0.30 + Math.sin(t * 2.8) * 0.65;
    if (shareWingL && shareWingR) { 
      var uL = shareWingL.userData;
      var uR = shareWingR.userData;
      shareWingL.rotation.set(uL.baseRotX || 0, (uL.baseRotY || 0) + flap, uL.baseRotZ || 0); 
      shareWingR.rotation.set(uR.baseRotX || 0, (uR.baseRotY || 0) - flap, uR.baseRotZ || 0); 
    }
    if (shareGroup) {
      shareGroup.position.y = 0.45 + Math.sin(t * 2.2) * 0.08;
      // 🌟 오른쪽 기울기를 유지하며 자연스럽게 부유하도록 기준각을 -0.35로 수정
      shareGroup.rotation.z = -0.35 + Math.sin(t * 1.5) * 0.04;
    }
    shareRenderer.render(shareScene, shareCamera);
  })();
}

function stopShare3DScene() {
  if (shareAnimFrameId) { cancelAnimationFrame(shareAnimFrameId); shareAnimFrameId = null; }
  if (shareRenderer) {
    disposeThreeRenderer(shareRenderer);
    shareRenderer = null;
  }
  shareScene = null;
  shareCamera = null;
  shareGroup = null;
  shareWingL = null;
  shareWingR = null;
  var c = document.getElementById('share-three-container');
  if (c) c.innerHTML = '';
}

var fullScene, fullCamera, fullRenderer, fullGroup, leftWingMesh, rightWingMesh, antennaMesh;
var isFlyingAway = false, animFrameId = null;
var initialRotL = { x: 0, y: 0, z: 0 }, initialRotR = { x: 0, y: 0, z: 0 };
var DEFAULT_ROT_X = 0, DEFAULT_ROT_Y = 0, butterflyRotX = DEFAULT_ROT_X, butterflyRotY = DEFAULT_ROT_Y;
var isUserDragging = false, lastPointerX = 0, lastPointerY = 0, previewStartTime = 0;
var isPressingScreen = false, pressStartTime = 0, isChargeTriggered = false, chargeProgress = 0, chargeVibrateInterval = null;
var particleCanvas = null, pctx = null, energyParticles = [], isFlyingTransitionTriggered = false;

var hasTriggeredDBSave = false;
var flyStartPhase = 0, flyStartTime = 0;

// 🌟 프리뷰 화면 전역 이벤트 리스너 중복 등록 방지를 위한 핸들러 참조 변수
var _previewTouchMoveHandler = null;
var _previewTouchEndHandler = null;
var _previewTouchCancelHandler = null;
var _previewMouseMoveHandler = null;
var _previewMouseUpHandler = null;

function unbindPreviewWindowEvents() {
  if (_previewTouchMoveHandler) {
    window.removeEventListener('touchmove', _previewTouchMoveHandler);
    _previewTouchMoveHandler = null;
  }
  if (_previewTouchEndHandler) {
    window.removeEventListener('touchend', _previewTouchEndHandler);
    _previewTouchEndHandler = null;
  }
  if (_previewTouchCancelHandler) {
    window.removeEventListener('touchcancel', _previewTouchCancelHandler);
    _previewTouchCancelHandler = null;
  }
  if (_previewMouseMoveHandler) {
    window.removeEventListener('mousemove', _previewMouseMoveHandler);
    _previewMouseMoveHandler = null;
  }
  if (_previewMouseUpHandler) {
    window.removeEventListener('mouseup', _previewMouseUpHandler);
    _previewMouseUpHandler = null;
  }
}

function stopFullButterflyViewer() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  unbindPreviewWindowEvents();
  resetChargeState();
  if (fullRenderer) {
    disposeThreeRenderer(fullRenderer);
    fullRenderer = null;
  }
  fullScene = null;
  fullCamera = null;
  fullGroup = null;
  leftWingMesh = null;
  rightWingMesh = null;
  antennaMesh = null;
  var container = document.getElementById('three-container');
  if (container) container.innerHTML = '';
  if (pctx && particleCanvas) {
    pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  }
  energyParticles = [];
}

function triggerDeviceVibrate(durationMs, intensity) {
  try {
    if (navigator.vibrate) navigator.vibrate(durationMs || 40);
    else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic) {
      window.webkit.messageHandlers.haptic.postMessage({ type: 'impactMedium' });
    }
  } catch(e) {}
}

function safeTriggerDBSave() {
  if (hasTriggeredDBSave) return;
  hasTriggeredDBSave = true;
  if (typeof window.saveButterflyToSupabase === 'function') {
    window.saveButterflyToSupabase();
  } else if (typeof saveButterflyToSupabase === 'function') {
    saveButterflyToSupabase();
  }
}

function initFullButterflyViewer(textureURL) {
  var container = document.getElementById('three-container');
  stopFullButterflyViewer();
  if (!container || !window.THREE) return;
  container.innerHTML = ''; container.style.opacity = '1';

  var glowBg = document.querySelector('.preview-ethereal-glow-bg');
  if (glowBg) glowBg.style.opacity = '1';

  var width = window.innerWidth, height = window.innerHeight;
  fullScene = new THREE.Scene();
  fullCamera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
  fullCamera.position.set(0, 0, 8.8); fullCamera.lookAt(0, 0, 0);

  fullRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  fullRenderer.setSize(width, height);
  fullRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (THREE.sRGBEncoding) {
    fullRenderer.outputEncoding = THREE.sRGBEncoding;
  }
  container.appendChild(fullRenderer.domElement);

  fullScene.add(new THREE.AmbientLight(0xffffff, 1.2));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(0, 5, 10); fullScene.add(dirLight);

  var wingMats = createWingMaterials(textureURL, currentSelected3DPatternPath);

  fullGroup = new THREE.Group();
  butterflyRotX = DEFAULT_ROT_X; butterflyRotY = DEFAULT_ROT_Y;
  fullGroup.rotation.set(butterflyRotX, butterflyRotY, 0);
  fullGroup.position.set(0, -6.5, 0);

  previewStartTime = performance.now();
  isFlyingAway = false; isFlyingTransitionTriggered = false; hasTriggeredDBSave = false; resetChargeState();
  flyStartPhase = 0; flyStartTime = 0;

  var bodyMat = createBodyMaterial(textureURL, typeof selectedBodyColor !== 'undefined' ? selectedBodyColor : 'white');
  var targetAnt = 'Antenna_' + String(selectedAntennaType || 'ball').split('__')[0];
  var currentFullGroup = fullGroup;

  if (window.THREE && THREE.GLTFLoader) {
    try {
      new THREE.GLTFLoader().load('3DButterfly/' + selectedButterflyShape + '.glb', function(gltf) {
        if (fullGroup !== currentFullGroup) return;
        leftWingMesh = null; rightWingMesh = null; antennaMesh = null;
        gltf.scene.traverse(function(child) {
          if (child.isMesh) {
            var n = child.name || '';
            if (n.indexOf('Wing_L') === 0 || n.startsWith('Wing_L')) { 
              leftWingMesh = child; 
              child.material = wingMats.matL; 
              initialRotL = { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z }; 
            }
            else if (n.indexOf('Wing_R') === 0 || n.startsWith('Wing_R')) { 
              rightWingMesh = child; 
              child.material = wingMats.matR; 
              initialRotR = { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z }; 
            }
            else if (n.indexOf('Body') === 0 || n.startsWith('Body')) { 
              child.material = bodyMat; 
            }
            else if (n.indexOf('Antenna_') === 0 || n.startsWith('Antenna_')) { 
              child.material = bodyMat; 
              child.visible = n.startsWith(targetAnt); 
              if (child.visible) antennaMesh = child; 
            }
          }
        });
        gltf.scene.scale.set(0.76, 0.76, 0.76);
        fullGroup.add(gltf.scene);
      });
    } catch(err) {
      console.error("3D 프리뷰 모델 로딩 실패:", err);
    }
  }

  fullScene.add(fullGroup);
  initEnergyParticleSystem();
  var clock = new THREE.Clock();

  (function animate() {
    if (!fullRenderer || !fullScene || !fullCamera || !fullGroup) return;
    animFrameId = requestAnimationFrame(animate);

    var t = clock.getElapsedTime();
    var now = performance.now(), elapsedSec = (now - previewStartTime) / 1000;

    if (!isUserDragging) {
      butterflyRotX += (DEFAULT_ROT_X - butterflyRotX) * 0.05;
      var diffY = (DEFAULT_ROT_Y - butterflyRotY);
      butterflyRotY += Math.atan2(Math.sin(diffY), Math.cos(diffY)) * 0.05;
    }
    fullGroup.rotation.x = butterflyRotX; fullGroup.rotation.y = butterflyRotY;

    if (isPressingScreen && !isFlyingAway) {
      var pressDuration = (now - pressStartTime) / 1000;
      if (pressDuration >= 2.0) {
        if (!isChargeTriggered) { isChargeTriggered = true; startChargeVibrationLoop(); }
        var currentChargeSec = Math.max(0, pressDuration - 2.0);
        chargeProgress = Math.min(1.0, currentChargeSec / 2.0);
        updateChargeUIAndCamera(chargeProgress, currentChargeSec);
        spawnEnergyParticles();
      }
    }

    if (!isFlyingAway) {
      if (elapsedSec < 3.0) {
        var progress = Math.min(1.0, elapsedSec / 3.0);
        var easeOut = 1.0 - Math.pow(1.0 - progress, 3);
        fullGroup.position.y = -6.5 * (1.0 - easeOut);
      } else {
        fullGroup.position.y = Math.sin((elapsedSec - 3.0) * 1.5) * 0.04;
      }

      var restingAngle = 0.18;
      var flapAngle;

      if (t < 1.0) {
        var phase = t * 16.0;
        flapAngle = restingAngle + 0.35 + Math.sin(phase) * 0.75;
      } else if (t < 3.6) {
        var decayProgress = (t - 1.0) / 2.6;
        var smoothWeight = Math.cos(decayProgress * (Math.PI / 2));
        var amp = 0.75 * Math.pow(smoothWeight, 2);
        var centerOffset = 0.35 * smoothWeight;
        
        var u = t - 1.0;
        var phase = 16.0 + (16.0 * 2.6 * 2.0 / Math.PI) * Math.sin((u / 2.6) * (Math.PI / 2));
        flapAngle = restingAngle + centerOffset + Math.sin(phase) * amp;
      } else {
        flapAngle = restingAngle;
      }

      if (leftWingMesh && rightWingMesh) {
        leftWingMesh.rotation.set(initialRotL.x, initialRotL.y + flapAngle, initialRotL.z);
        rightWingMesh.rotation.set(initialRotR.x, initialRotR.y - flapAngle, initialRotR.z);
      }
    } else {
      if (!flyStartTime) {
        flyStartTime = t;
        flyStartPhase = 0;
      }

      var flyPhase = flyStartPhase + (t - flyStartTime) * 30.0;
      var flyAngle = 0.524 + Math.sin(flyPhase) * 0.873;

      if (leftWingMesh && rightWingMesh) {
        leftWingMesh.rotation.set(initialRotL.x, initialRotL.y + flyAngle, initialRotL.z);
        rightWingMesh.rotation.set(initialRotR.x, initialRotR.y - flyAngle, initialRotR.z);
      }
      fullGroup.position.y += 0.09; fullGroup.position.z -= 0.04;

      if (fullGroup.position.y > 4.6 && !isFlyingTransitionTriggered) {
        isFlyingTransitionTriggered = true;
        clearTimeout(flightSafetyTimer);
        safeTriggerDBSave();

        if (container) container.style.opacity = '0';
        var glowBgEl = document.querySelector('.preview-ethereal-glow-bg');
        if (glowBgEl) glowBgEl.style.opacity = '0';
        var headerUIEl = document.getElementById('preview-header-ui');
        if (headerUIEl) headerUIEl.style.opacity = '0';
        var footerUIEl = document.getElementById('preview-footer-ui');
        if (footerUIEl) { footerUIEl.style.setProperty('display', 'none', 'important'); footerUIEl.style.opacity = '0'; }

        var globalCurtain = document.getElementById('cinematic-transition-curtain');
        if (globalCurtain) globalCurtain.classList.add('active-curtain');

        setTimeout(function() {
          stopFullButterflyViewer();
          showScreen('screen-complete');
          setTimeout(function() { if (globalCurtain) globalCurtain.classList.remove('active-curtain'); }, 80);
          isFlyingAway = false; isFlyingTransitionTriggered = false;
          if (container) container.style.opacity = '1';
          if (glowBgEl) glowBgEl.style.opacity = '1';
        }, 2000);
      }
    }
    renderEnergyParticles();
    if (fullRenderer && fullScene && fullCamera) {
      fullRenderer.render(fullScene, fullCamera);
    }
  })();
  bindInteractiveEvents(container);
}

function initEnergyParticleSystem() {
  particleCanvas = document.getElementById('energy-particles-canvas');
  if (!particleCanvas) return;
  particleCanvas.width = window.innerWidth; particleCanvas.height = window.innerHeight;
  pctx = particleCanvas.getContext('2d'); energyParticles = [];
}

function spawnEnergyParticles() {
  if (!pctx) return;
  var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  for (var i = 0; i < 2; i++) {
    var angle = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 80;
    energyParticles.push({
      x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 1.5 - 0.5,
      size: Math.random() * 2.8 + 1.2, alpha: 1.0, decay: Math.random() * 0.015 + 0.01
    });
  }
}

function renderEnergyParticles() {
  if (!pctx || !particleCanvas) return;
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  for (var i = energyParticles.length - 1; i >= 0; i--) {
    var p = energyParticles[i];
    p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
    if (p.alpha <= 0) { energyParticles.splice(i, 1); continue; }
    pctx.save();
    pctx.fillStyle = 'rgba(255, 255, 255, ' + p.alpha + ')';
    pctx.beginPath(); pctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); pctx.fill();
    pctx.restore();
  }
}

function updateChargeUIAndCamera(progress, currentChargeSec) {
  if (isFlyingAway) return;
  var chargeWidget = document.getElementById('energy-charge-widget');
  var innerFill = document.getElementById('charge-inner-fill');
  var headerUI = document.getElementById('preview-header-ui');
  var footerUI = document.getElementById('preview-footer-ui');

  if (chargeWidget) { chargeWidget.classList.remove('hidden'); chargeWidget.style.setProperty('display', 'flex', 'important'); }
  var currentSize = 22 + (96 - 22) * progress;
  if (innerFill) { innerFill.style.width = currentSize + 'px'; innerFill.style.height = currentSize + 'px'; }
  if (fullCamera) fullCamera.position.z = 8.8 - (2.6 * progress);

  if (headerUI) headerUI.style.opacity = Math.max(0, 1.0 - Math.min(1.0, currentChargeSec / 1.5));
  if (footerUI) { footerUI.style.display = 'flex'; footerUI.style.opacity = '1'; }

  var flyLabel = document.getElementById('preview-fly-label');
  if (flyLabel) {
    flyLabel.innerHTML = progress >= 1.0 ? "위로 쓸어 올려주세요" : "화면 아무 곳을<br>2초간 가만히 길게 눌러주세요.";
  }
}

function startChargeVibrationLoop() {
  if (chargeVibrateInterval) clearInterval(chargeVibrateInterval);
  triggerDeviceVibrate(45, 0.6);
  chargeVibrateInterval = setInterval(function() {
    if (!isPressingScreen || !isChargeTriggered || isFlyingAway) {
      clearInterval(chargeVibrateInterval); chargeVibrateInterval = null; return;
    }
    triggerDeviceVibrate(Math.round(25 + (chargeProgress * 60)), 0.4 + (chargeProgress * 0.6));
  }, 110);
}

function resetChargeState() {
  isPressingScreen = false; isChargeTriggered = false; chargeProgress = 0;
  if (chargeVibrateInterval) { clearInterval(chargeVibrateInterval); chargeVibrateInterval = null; }

  var chargeWidget = document.getElementById('energy-charge-widget');
  var innerFill = document.getElementById('charge-inner-fill');
  var headerUI = document.getElementById('preview-header-ui');
  var footerUI = document.getElementById('preview-footer-ui');

  if (chargeWidget) { chargeWidget.classList.add('hidden'); chargeWidget.style.setProperty('display', 'none', 'important'); }
  if (innerFill) { innerFill.style.width = '22px'; innerFill.style.height = '22px'; }
  if (fullCamera) fullCamera.position.z = 8.8;
  if (headerUI) headerUI.style.opacity = 1.0;
  if (footerUI && !isFlyingAway) { footerUI.style.display = 'flex'; footerUI.style.opacity = 1.0; footerUI.style.pointerEvents = 'none'; }

  var flyLabel = document.getElementById('preview-fly-label');
  if (flyLabel) {
    flyLabel.innerHTML = "화면 아무 곳을<br>2초간 가만히 길게 눌러주세요.";
  }
}

function bindInteractiveEvents(targetEl) {
  unbindPreviewWindowEvents();

  var touchStartY = 0, touchStartX = 0;
  function handlePointerStart(clientX, clientY) {
    if (isFlyingAway) return;
    isUserDragging = true; lastPointerX = clientX; lastPointerY = clientY; touchStartX = clientX; touchStartY = clientY;
    var chargeWidget = document.getElementById('energy-charge-widget');
    if (chargeWidget) { chargeWidget.style.left = clientX + 'px'; chargeWidget.style.top = clientY + 'px'; }
    isPressingScreen = true; pressStartTime = performance.now();
  }
  function handlePointerMove(clientX, clientY) {
    if (!isUserDragging || isFlyingAway) return;
    var deltaX = clientX - lastPointerX, deltaY = clientY - lastPointerY;
    if (!isChargeTriggered) {
      if (Math.hypot(clientX - touchStartX, clientY - touchStartY) > 15) pressStartTime = performance.now();
      butterflyRotY += deltaX * 0.013;
      butterflyRotX = Math.max(-1.4, Math.min(1.4, butterflyRotX + deltaY * 0.013));
    }
    lastPointerX = clientX; lastPointerY = clientY;
  }
  function handlePointerEnd(clientX, clientY) {
    if (!isUserDragging) return;
    isUserDragging = false;
    var swipeDeltaY = touchStartY - clientY;
    var chargeWidget = document.getElementById('energy-charge-widget');
    if (chargeWidget) { chargeWidget.classList.add('hidden'); chargeWidget.style.display = 'none'; }
    if (chargeVibrateInterval) { clearInterval(chargeVibrateInterval); chargeVibrateInterval = null; }

    if (isChargeTriggered && chargeProgress >= 1.0 && swipeDeltaY > 40 && !isFlyingAway) {
      isFlyingAway = true;
      triggerDeviceVibrate(180, 1.0);

      safeTriggerDBSave();

      var footerUI = document.getElementById('preview-footer-ui');
      if (footerUI) { footerUI.style.setProperty('display', 'none', 'important'); footerUI.style.opacity = '0'; footerUI.style.pointerEvents = 'none'; }
      clearTimeout(flightSafetyTimer);
      flightSafetyTimer = setTimeout(function() {
        if (!isFlyingTransitionTriggered) {
          isFlyingTransitionTriggered = true; 
          safeTriggerDBSave();
          stopFullButterflyViewer();
          showScreen('screen-complete');
        }
      }, 3500);
    } else resetChargeState();
  }

  _previewTouchMoveHandler = function(e) {
    if (isUserDragging && e.touches.length === 1) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  _previewTouchEndHandler = function(e) {
    if (e.changedTouches.length > 0) handlePointerEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  };
  _previewTouchCancelHandler = function(e) {
    if (e.changedTouches.length > 0) handlePointerEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    else resetChargeState();
  };
  _previewMouseMoveHandler = function(e) {
    if (isUserDragging) handlePointerMove(e.clientX, e.clientY);
  };
  _previewMouseUpHandler = function(e) {
    handlePointerEnd(e.clientX, e.clientY);
  };

  targetEl.oncontextmenu = function(e) { e.preventDefault(); return false; };
  targetEl.ontouchstart = function(e) { if (e.touches.length === 1) handlePointerStart(e.touches[0].clientX, e.touches[0].clientY); };
  window.addEventListener('touchmove', _previewTouchMoveHandler, { passive: true });
  window.addEventListener('touchend', _previewTouchEndHandler, { passive: true });
  window.addEventListener('touchcancel', _previewTouchCancelHandler, { passive: true });
  targetEl.onmousedown = function(e) { handlePointerStart(e.clientX, e.clientY); };
  window.addEventListener('mousemove', _previewMouseMoveHandler);
  window.addEventListener('mouseup', _previewMouseUpHandler);
}

var modalThreeScene, modalThreeCamera, modalThreeRenderer, modalGroup, modalWingL, modalWingR, modalAnimFrameId = null;
var _modalTouchMoveHandler = null, _modalTouchEndHandler = null, _modalMouseMoveHandler = null, _modalMouseUpHandler = null;

function unbindModalWindowEvents() {
  if (_modalTouchMoveHandler) {
    window.removeEventListener('touchmove', _modalTouchMoveHandler);
    _modalTouchMoveHandler = null;
  }
  if (_modalTouchEndHandler) {
    window.removeEventListener('touchend', _modalTouchEndHandler);
    window.removeEventListener('touchcancel', _modalTouchEndHandler);
    _modalTouchEndHandler = null;
  }
  if (_modalMouseMoveHandler) {
    window.removeEventListener('mousemove', _modalMouseMoveHandler);
    _modalMouseMoveHandler = null;
  }
  if (_modalMouseUpHandler) {
    window.removeEventListener('mouseup', _modalMouseUpHandler);
    _modalMouseUpHandler = null;
  }
}

function stopModal3DScene() {
  if (modalAnimFrameId) {
    cancelAnimationFrame(modalAnimFrameId);
    modalAnimFrameId = null;
  }
  unbindModalWindowEvents();
  if (modalThreeRenderer) {
    disposeThreeRenderer(modalThreeRenderer);
    modalThreeRenderer = null;
  }
  modalThreeScene = null;
  modalThreeCamera = null;
  modalGroup = null;
  modalWingL = null;
  modalWingR = null;
  var container = document.getElementById('specimen-three-container');
  if (container) container.innerHTML = '';
}

function sanitizeSpecimenShareText(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, function(m) { return m.length > 1 ? m[0] : ''; })
    .replace(/\uFFFD/g, '')
    .trim();
}

// 🌟 나비 둘러보기 3D 모달: 360도 드래그 회전 탑재 (온기 보내기 제거 완료)
function openSpecimen3DModal(item, textureUrl) {
  var modal = document.getElementById('specimen-detail-modal');
  var nameEl = document.getElementById('modal-butterfly-name');
  var tagsEl = document.getElementById('modal-specimen-tags');
  var memoEl = document.getElementById('modal-specimen-memo');
  var dateEl = document.getElementById('modal-specimen-date');
  var shareBtn = document.getElementById('btn-share-specimen-modal');
  var container = document.getElementById('specimen-three-container');

  var parsedAntParts = String(item.antId || 'ball').split('__');
  var cleanAntId = parsedAntParts[0] || 'ball';
  var itemBodyColor = item.bodyColor || parsedAntParts[1] || 'white';

  var cleanItemName = sanitizeSpecimenShareText(item.name) || "나비";
  var cleanItemMemo = sanitizeSpecimenShareText(item.memo || item.q6_memo);

  if (nameEl) nameEl.innerText = cleanItemName;
  if (tagsEl) {
    var coreTag = item.core_concern || (item.tags && item.tags[item.tags.length - 1]);
    var safeCoreTag = coreTag ? String(coreTag).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
    tagsEl.innerHTML = safeCoreTag ? '<span class="specimen-glass-pill bg-white text-black font-bold border-white" style="box-shadow: 0 0 12px rgba(255, 255, 255, 0.45);">#' + safeCoreTag + '</span>' : '';
  }
  if (memoEl) memoEl.innerText = cleanItemMemo ? ('"' + cleanItemMemo + '"') : '"너의 찬란한 날갯짓을 응원해."';
  if (dateEl) dateEl.innerText = item.date || "2026. 10. 24";

  if (shareBtn) {
    shareBtn.onclick = function(e) {
      e.stopPropagation();
      var rawName = cleanItemName || "나비";
      var rawMemo = cleanItemMemo || "너의 찬란한 날갯짓을 응원해.";
      var rawShape = item.wingId || "crescent";
      var rawPattern = item.patternId || (rawShape + "_none");
      var rawAntenna = cleanAntId + (itemBodyColor && itemBodyColor !== 'white' ? ('__' + itemBodyColor) : '');

      var baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, '');
      if (!baseUrl.endsWith('/')) baseUrl += '/';

      function executeModalShare(resolvedId) {
        var isRealDbId = resolvedId && !(typeof resolvedId === 'number' && resolvedId > 1000000000000);
        var shareCardUrl = '';
        if (isRealDbId) {
          shareCardUrl = baseUrl + 'share.html?id=' + encodeURIComponent(resolvedId);
        } else {
          shareCardUrl = baseUrl + 'share.html?name=' + encodeURIComponent(rawName) +
            '&memo=' + encodeURIComponent(rawMemo) +
            '&shape=' + encodeURIComponent(rawShape) +
            '&pattern=' + encodeURIComponent(rawPattern) +
            '&antenna=' + encodeURIComponent(rawAntenna) +
            '&body=' + encodeURIComponent(itemBodyColor);
        }

        var shareData = { text: "당신에게 '" + rawName + "'이(가) 도착했습니다.", url: shareCardUrl };
        if (typeof triggerShareOrCopyFallback === 'function') {
          triggerShareOrCopyFallback(shareData, shareCardUrl);
        } else if (navigator.share) {
          navigator.share(shareData).catch(function(err) {
            if (err && err.name !== 'AbortError' && navigator.clipboard) {
              navigator.clipboard.writeText(shareCardUrl).then(function() { alert("나비 초대장 링크가 클립보드에 복사되었습니다!"); });
            }
          });
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareCardUrl).then(function() { alert("나비 초대장 링크가 클립보드에 복사되었습니다!"); })
            .catch(function() { alert("링크 복사에 실패했습니다."); });
        } else {
          alert("공유를 지원하지 않는 브라우저입니다.");
        }
      }

      var targetId = item.id;
      var hasImmediateRealId = targetId && !(typeof targetId === 'number' && targetId > 1000000000000);

      // 🌟 이미 실제 DB ID가 있으면 await 없이 즉시 동기적으로 실행하여 iOS 공유창 차단 완벽 방지
      if (hasImmediateRealId) {
        executeModalShare(targetId);
        return;
      }

      if (typeof currentSavePromise !== 'undefined' && currentSavePromise) {
        Promise.race([
          currentSavePromise,
          new Promise(function(resolve) { setTimeout(function() { resolve(null); }, 1200); })
        ]).then(function(savedId) {
          if (savedId) item.id = savedId;
          executeModalShare(savedId || item.id);
        }).catch(function() {
          executeModalShare(item.id);
        });
      } else {
        executeModalShare(targetId);
      }
    };
  }

  if (modal) modal.classList.remove('hidden');

  stopModal3DScene();

  var res = setupCommon3DScene(container, 6.4, 0);
  if (!res) return;
  modalThreeScene = res.scene; modalThreeCamera = res.camera; modalThreeRenderer = res.renderer;

  var itemPattern3DPath = null;
  if (typeof get3DPatternPath === 'function') {
    itemPattern3DPath = get3DPatternPath(item.wingId, item.patternId);
  } else if (item.patternId && item.patternId.indexOf('none') === -1) {
    var parts = item.patternId.split('_');
    var patNum = parts[parts.length - 1] || "1";
    var shapePrefix = item.wingId || 'crescent';
    if (shapePrefix === 'moon-halo' || shapePrefix === 'moon') shapePrefix = 'moon-halo';
    else if (shapePrefix === 'dawn-ray' || shapePrefix === 'dawn') shapePrefix = 'dawn-ray';
    else if (shapePrefix === 'wave-fin' || shapePrefix === 'wave') shapePrefix = 'wave-fin';
    itemPattern3DPath = '3DButterfly_pattern/' + shapePrefix + '_pattern_3D_' + patNum + '.png';
  }

  var wingMats = createWingMaterials(textureUrl, itemPattern3DPath);
  var bodyMat = createBodyMaterial(textureUrl, itemBodyColor);

  modalGroup = new THREE.Group();
  modalGroup.position.set(0, -0.35, 0);

  var currentModalGroup = modalGroup;
  loadButterflyModel(currentModalGroup, item.wingId, cleanAntId, wingMats, bodyMat, 0.95, function(l, r) {
    if (modalGroup !== currentModalGroup) return;
    modalWingL = l; modalWingR = r;
  });
  modalThreeScene.add(modalGroup);

  // 🌟 3D 상세 모달 360도 터치/마우스 드래그 회전 바인딩
  var modalRotX = 0, modalRotY = 0;
  var isModalDragging = false, lastModalX = 0, lastModalY = 0;

  function onModalPointerDown(cx, cy) {
    isModalDragging = true;
    lastModalX = cx;
    lastModalY = cy;
  }
  function onModalPointerMove(cx, cy) {
    if (!isModalDragging) return;
    var dx = cx - lastModalX;
    var dy = cy - lastModalY;
    modalRotY += dx * 0.013;
    modalRotX = Math.max(-1.35, Math.min(1.35, modalRotX + dy * 0.013));
    lastModalX = cx;
    lastModalY = cy;
  }
  function onModalPointerUp() {
    isModalDragging = false;
  }

  container.oncontextmenu = function(e) { e.preventDefault(); return false; };
  container.ontouchstart = function(e) {
    if (e.touches.length === 1) onModalPointerDown(e.touches[0].clientX, e.touches[0].clientY);
  };
  _modalTouchMoveHandler = function(e) {
    if (isModalDragging && e.touches.length === 1) onModalPointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  _modalTouchEndHandler = function() { onModalPointerUp(); };

  container.onmousedown = function(e) { onModalPointerDown(e.clientX, e.clientY); };
  _modalMouseMoveHandler = function(e) {
    if (isModalDragging) onModalPointerMove(e.clientX, e.clientY);
  };
  _modalMouseUpHandler = function() { onModalPointerUp(); };

  window.addEventListener('touchmove', _modalTouchMoveHandler, { passive: true });
  window.addEventListener('touchend', _modalTouchEndHandler, { passive: true });
  window.addEventListener('touchcancel', _modalTouchEndHandler, { passive: true });
  window.addEventListener('mousemove', _modalMouseMoveHandler);
  window.addEventListener('mouseup', _modalMouseUpHandler);

  var clock = new THREE.Clock();
  (function modalAnimate() {
    if (!modalThreeRenderer || !modalThreeScene || !modalThreeCamera) return;
    modalAnimFrameId = requestAnimationFrame(modalAnimate);

    if (!isModalDragging) {
      modalRotX += (0 - modalRotX) * 0.06;
      var diffY = 0 - modalRotY;
      modalRotY += Math.atan2(Math.sin(diffY), Math.cos(diffY)) * 0.06;
    }

    var t = clock.getElapsedTime(), flap = 0.30 + Math.sin(t * 2.8) * 0.65;

    if (modalGroup) {
      modalGroup.rotation.x = modalRotX;
      modalGroup.rotation.y = modalRotY;
      modalGroup.position.y = -0.35 + Math.sin(t * 2.0) * 0.04;
    }

    if (modalWingL && modalWingR) { 
      var uL = modalWingL.userData;
      var uR = modalWingR.userData;
      modalWingL.rotation.set(uL.baseRotX || 0, (uL.baseRotY || 0) + flap, uL.baseRotZ || 0); 
      modalWingR.rotation.set(uR.baseRotX || 0, (uR.baseRotY || 0) - flap, uR.baseRotZ || 0); 
    }
    modalThreeRenderer.render(modalThreeScene, modalThreeCamera);
  })();
}

window.addEventListener('resize', function() {
  var activeScreen = document.querySelector('.screen.active');
  if (activeScreen) {
    if (activeScreen.id === 'screen-preview' && fullCamera && fullRenderer) {
      var w = window.innerWidth;
      var h = window.innerHeight;
      fullCamera.aspect = w / h;
      fullCamera.updateProjectionMatrix();
      fullRenderer.setSize(w, h);
      fullRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (particleCanvas) {
        particleCanvas.width = w;
        particleCanvas.height = h;
      }
    } else if (activeScreen.id === 'screen-loading' && loadingCamera && loadingRenderer) {
      var loadingCont = document.getElementById('loading-three-container');
      if (loadingCont) {
        var lw = loadingCont.clientWidth || window.innerWidth;
        var lh = loadingCont.clientHeight || window.innerHeight;
        loadingCamera.aspect = lw / lh;
        loadingCamera.updateProjectionMatrix();
        loadingRenderer.setSize(lw, lh);
      }
    } else if (activeScreen.id === 'screen-share' && shareCamera && shareRenderer) {
      var shareCont = document.getElementById('share-three-container');
      if (shareCont) {
        var sw = shareCont.clientWidth || window.innerWidth;
        var sh = shareCont.clientHeight || window.innerHeight;
        shareCamera.aspect = sw / sh;
        shareCamera.updateProjectionMatrix();
        shareRenderer.setSize(sw, sh);
      }
    } else if (activeScreen.id === 'screen-gallery' && typeof modalThreeCamera !== 'undefined' && modalThreeCamera && typeof modalThreeRenderer !== 'undefined' && modalThreeRenderer) {
      var modalCont = document.getElementById('specimen-three-container');
      if (modalCont) {
        var mw = modalCont.clientWidth || window.innerWidth;
        var mh = modalCont.clientHeight || window.innerHeight;
        modalThreeCamera.aspect = mw / mh;
        modalThreeCamera.updateProjectionMatrix();
        modalThreeRenderer.setSize(mw, mh);
      }
    }
  }
});

// ==========================================================================
// 🌟 2D / 물리 캔버스 시각 효과 렌더러 (app.js 분량 경량화를 위해 이동)
// ==========================================================================

var top7Engine = null;
var top7RenderLoop = null;
var top7Balls = [];
var top7Boundaries = [];
var top7GyroHandler = null;
var top7SpawnTimeouts = [];

function initTop7PhysicsScene(customKeywordList) {
  stopTop7PhysicsScene();
  var container = document.getElementById('top7-physics-container');
  var canvas = document.getElementById('top7-physics-canvas');
  if (!container || !canvas || typeof Matter === 'undefined') return;

  var rect = container.getBoundingClientRect();
  var width = rect.width || window.innerWidth;
  var height = container.clientHeight || rect.height || (window.innerHeight - 240);

  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d');

  var Engine = Matter.Engine,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Mouse = Matter.Mouse,
      MouseConstraint = Matter.MouseConstraint;

  top7Engine = Engine.create({
    positionIterations: 10,
    velocityIterations: 10,
    gravity: { x: 0, y: 0.95, scale: 0.001 }
  });

  var wallThick = 500;
  var floor = Bodies.rectangle(width / 2, height + wallThick / 2, width * 4, wallThick, { 
    isStatic: true, restitution: 0.42, friction: 0.2 
  });
  var leftWall = Bodies.rectangle(-wallThick / 2, height / 2, wallThick, height * 6, { 
    isStatic: true, restitution: 0.42, friction: 0.2 
  });
  var rightWall = Bodies.rectangle(width + wallThick / 2, height / 2, wallThick, height * 6, { 
    isStatic: true, restitution: 0.42, friction: 0.2 
  });

  // 🌟 [수정 완료]: 공이 천장에 막히지 않고 자유롭게 튀어오르도록 물리 천장 벽(ceiling)을 없애고 바닥과 좌우 벽만 배치
  top7Boundaries = [floor, leftWall, rightWall];
  Composite.add(top7Engine.world, top7Boundaries);

  top7Balls = [];
  top7SpawnTimeouts = [];

  var scaleRatio = Math.min(1.05, Math.max(0.85, width / 390));

  // 🌟 실제 전달받은 데이터 목록을 1위(rank 1)부터 오름차순으로 정렬하여 1위 공부터 차례대로 떨어지도록 보장
  var rawDataset = Array.isArray(customKeywordList) && customKeywordList.length > 0 
    ? customKeywordList.slice() 
    : top7KeywordData.slice();

  var spawnDataset = rawDataset.sort(function(a, b) {
    return (a.rank || 99) - (b.rank || 99);
  });

  // 🌟 1위부터 순서대로 자연스럽게 위에서 떨어지도록 가로 오프셋 패턴과 일정한 간격 적용
  var xOffsetRatios = [0.0, -0.18, 0.18, -0.11, 0.12, -0.06, 0.06];

  spawnDataset.forEach(function(item, idx) {
    var timer = setTimeout(function() {
      if (!top7Engine) return;

      var actualRadius = item.radius * scaleRatio;
      var margin = actualRadius + 16;
      var usableHalfW = Math.max(10, (width / 2) - margin);
      var ratio = xOffsetRatios[idx % xOffsetRatios.length];
      var jitter = (idx === 0) ? 0 : ((Math.random() - 0.5) * 14);
      var spawnX = Math.max(margin, Math.min(width - margin, (width / 2) + (usableHalfW * ratio) + jitter));
      // 화면 바로 위에서 시작해 1위부터 순서대로 시야에 자연스럽게 진입하도록 설정
      var spawnY = -actualRadius - 12;

      var ballBody = Bodies.circle(spawnX, spawnY, actualRadius, {
        restitution: 0.45,
        friction: 0.06,
        frictionAir: 0.007,
        density: 0.0025,
        angularDamping: 0.1
      });

      ballBody.customData = {
        rank: item.rank,
        keyword: item.keyword,
        percent: item.percent,
        radius: actualRadius,
        fill: item.fill,
        textColor: item.textColor,
        subColor: item.subColor
      };

      // 초기 낙하 속도를 일정하게 부여하여 앞 순위 공이 무조건 먼저 내려오도록 보장
      Matter.Body.setVelocity(ballBody, { x: (Math.random() - 0.5) * 0.9, y: 2.2 });
      Matter.Body.setAngularVelocity(ballBody, (Math.random() - 0.5) * 0.04);

      Composite.add(top7Engine.world, ballBody);
      top7Balls.push(ballBody);
    }, idx * 220);

    top7SpawnTimeouts.push(timer);
  });

  var mouse = Mouse.create(canvas);
  var mouseConstraint = MouseConstraint.create(top7Engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.18,
      render: { visible: false }
    }
  });
  Composite.add(top7Engine.world, mouseConstraint);

  top7GyroHandler = function(e) {
    if (!top7Engine) return;
    var gamma = e.gamma || 0;
    var beta = e.beta || 0;

    var gravityX = Math.max(-1.8, Math.min(1.8, (gamma / 45) * 1.3));
    // 🌟 기기를 거꾸로 기울여도 공이 위쪽으로 영원히 날아가지 않도록 상향 중력 한계를 적당히 제한
    var gravityY = Math.max(-0.55, Math.min(1.8, (beta / 45) * 1.3));

    if (Math.abs(gravityX) < 0.08 && Math.abs(gravityY) < 0.08) {
      gravityY = 0.95;
    }

    top7Engine.gravity.x = gravityX;
    top7Engine.gravity.y = gravityY;
  };

  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', top7GyroHandler, true);
  }

  (function renderTop7Frame() {
    if (!top7Engine) return;
    top7RenderLoop = requestAnimationFrame(renderTop7Frame);

    // 리사이즈 대응: 캔버스 크기가 변경되었을 경우 벽 위치 동기화
    if (canvas.width !== width || canvas.height !== height) {
      width = canvas.width;
      height = canvas.height;
      Matter.Body.setPosition(floor, { x: width / 2, y: height + wallThick / 2 });
      Matter.Body.setPosition(leftWall, { x: -wallThick / 2, y: height / 2 });
      Matter.Body.setPosition(rightWall, { x: width + wallThick / 2, y: height / 2 });
    }

    Engine.update(top7Engine, 1000 / 60);

    // 🌟 천장을 없애되 너무 높게 올라가지 않도록 소프트 상한선(화면 상단 위로 적당한 여유 높이) 적용
    var maxUpwardLimitY = -Math.min(height * 0.38, 180);
    for (var bIdx = 0; bIdx < top7Balls.length; bIdx++) {
      var b = top7Balls[bIdx];
      // 공이 화면 위쪽 여유 공간을 넘어 너무 높이 올라가면 부드럽게 속도를 줄여 다시 내려오게 함
      if (b.position.y < maxUpwardLimitY && b.velocity.y < 0) {
        Matter.Body.setPosition(b, { x: b.position.x, y: maxUpwardLimitY });
        Matter.Body.setVelocity(b, { x: b.velocity.x * 0.9, y: Math.abs(b.velocity.y) * 0.25 + 0.8 });
      }
      // 좌우 경계 이탈 안전장치
      var r = b.customData ? b.customData.radius : 60;
      if (b.position.x < r) {
        Matter.Body.setPosition(b, { x: r, y: b.position.y });
        if (b.velocity.x < 0) Matter.Body.setVelocity(b, { x: -b.velocity.x * 0.4, y: b.velocity.y });
      } else if (b.position.x > width - r) {
        Matter.Body.setPosition(b, { x: width - r, y: b.position.y });
        if (b.velocity.x > 0) Matter.Body.setVelocity(b, { x: -b.velocity.x * 0.4, y: b.velocity.y });
      }
    }

    ctx.clearRect(0, 0, width, height);

    top7Balls.forEach(function(ball) {
      var pos = ball.position;
      var angle = ball.angle;
      var data = ball.customData;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.arc(0, 0, data.radius, 0, Math.PI * 2);
      if (data.rank === 1) {
        // 🌟 삼성 인터넷 강제 다크모드가 1위 흰색 공의 단색 채우기를 검게 반전시키지 못하도록 원형 그라데이션 적용
        var ballGrad = ctx.createRadialGradient(0, 0, data.radius * 0.1, 0, 0, data.radius);
        ballGrad.addColorStop(0, "#ffffff");
        ballGrad.addColorStop(1, "#f4f4f6");
        ctx.fillStyle = ballGrad;
      } else {
        ctx.fillStyle = data.fill;
      }
      ctx.fill();

      if (data.rank === 1) {
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.stroke();
      } else {
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.stroke();
      }

      ctx.rotate(-angle);

      var titleFontSize = Math.max(11, Math.min(18, data.radius * 0.28));
      var percentFontSize = Math.max(10, Math.min(15, data.radius * 0.20));
      var maxTextWidth = data.radius * 1.62;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = "bold " + titleFontSize + "px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif";
      // 🌟 긴 키워드가 작은 공에 들어올 때 원 밖으로 삐져나오지 않도록 폰트 크기 자동 축소
      var measuredW = ctx.measureText(data.keyword || "").width;
      if (measuredW > maxTextWidth && measuredW > 0) {
        titleFontSize = Math.max(9.5, titleFontSize * (maxTextWidth / measuredW));
        ctx.font = "bold " + titleFontSize.toFixed(1) + "px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif";
      }

      ctx.fillStyle = data.rank === 1 ? "#050505" : data.textColor;
      ctx.fillText(data.keyword, 0, -percentFontSize * 0.65, maxTextWidth);

      ctx.font = "500 " + percentFontSize + "px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif";
      ctx.fillStyle = data.subColor;
      ctx.fillText(data.percent, 0, percentFontSize * 0.85, maxTextWidth);

      ctx.restore();
    });
  })();
}

function stopTop7PhysicsScene() {
  if (top7SpawnTimeouts && top7SpawnTimeouts.length > 0) {
    top7SpawnTimeouts.forEach(function(t) { clearTimeout(t); });
    top7SpawnTimeouts = [];
  }
  if (top7RenderLoop) { 
    cancelAnimationFrame(top7RenderLoop); 
    top7RenderLoop = null; 
  }
  if (top7GyroHandler) {
    window.removeEventListener('deviceorientation', top7GyroHandler, true);
    top7GyroHandler = null;
  }
  if (top7Engine) {
    Matter.World.clear(top7Engine.world, false);
    Matter.Engine.clear(top7Engine);
    top7Engine = null;
  }
  top7Balls = [];
  top7Boundaries = [];
  var canvas = document.getElementById('top7-physics-canvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

var bubbleCanvas = null, bctx = null, bubbleAnimFrameId = null;

function resizeBubblePhysicsCanvas() {
  bubbleCanvas = document.getElementById('bubble-physics-canvas');
  if (!bubbleCanvas || !bubbleCanvas.parentElement) return;
  var rect = bubbleCanvas.parentElement.getBoundingClientRect();
  bubbleCanvas.width = rect.width; bubbleCanvas.height = rect.height;
}

function startBubblePhysics() {
  stopBubblePhysics();
  bubbleCanvas = document.getElementById('bubble-physics-canvas');
  if (!bubbleCanvas) return;
  resizeBubblePhysicsCanvas();
  bctx = bubbleCanvas.getContext('2d');
  if (bctx) bctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);
}

function stopBubblePhysics() {
  if (bubbleAnimFrameId) { cancelAnimationFrame(bubbleAnimFrameId); bubbleAnimFrameId = null; }
  if (bubbleCanvas && bctx) bctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);
}

var coverAnimId = null;
var coverParticles = [];
var silkRibbons = []; // 🌟 중간에 점/구슬이 맺히지 않는 매끄러운 연속 실크 너울 곡선 배열
var tapRipples = [];  // 🌟 짧은 터치(탭) 시 피어나는 은은한 윤슬 물결 파동 & 별가루 배열
var activeRibbon = null;
var isCoverPointerDown = false;
var pointerMoveListener = null, pointerDownListener = null, pointerUpListener = null;
var touchStartListener = null, touchMoveListener = null, touchEndListener = null;

function resizeCoverWaveCanvas() {
  var canvas = document.getElementById('cover-wave-canvas');
  if (!canvas) return;
  canvas.width = canvas.clientWidth || window.innerWidth;
  canvas.height = canvas.clientHeight || window.innerHeight;
}

function initCoverWaveCanvas() {
  stopCoverWaveCanvas();
  var canvas = document.getElementById('cover-wave-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = (canvas.width = canvas.clientWidth || window.innerWidth);
  var h = (canvas.height = canvas.clientHeight || window.innerHeight);

  coverParticles = [];
  for (var i = 0; i < 28; i++) {
    coverParticles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.2 + 0.8,
      vy: -(Math.random() * 0.35 + 0.15),
      vx: (Math.random() - 0.5) * 0.25,
      phase: Math.random() * Math.PI * 2
    });
  }

  silkRibbons = [];
  tapRipples = [];
  activeRibbon = null;

  function getCanvasPos(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      valid: (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)
    };
  }

  // 🌟 짧은 터치(탭) 시 실크 선과 어우러지는 은은한 윤슬 물결 파동 및 미세 별가루 생성
  function spawnTapRipple(x, y) {
    var sparks = [];
    var sparkCount = 6;
    for (var s = 0; s < sparkCount; s++) {
      var angle = (Math.PI * 2 * s) / sparkCount + (Math.random() - 0.5) * 0.5;
      var speed = 0.45 + Math.random() * 0.75;
      sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.18,
        r: 1.0 + Math.random() * 1.1
      });
    }
    tapRipples.push({
      x: x,
      y: y,
      age: 0,
      maxAge: 38,
      maxRadius: 34,
      sparks: sparks
    });
    if (tapRipples.length > 8) tapRipples.shift();
  }

  function startRibbonAt(clientX, clientY) {
    var pos = getCanvasPos(clientX, clientY);
    if (!pos.valid) return;
    isCoverPointerDown = true;

    spawnTapRipple(pos.x, pos.y);

    activeRibbon = {
      points: [
        { x: pos.x, y: pos.y, age: 0, phase: Math.random() * 6.28 }
      ]
    };
    silkRibbons.push(activeRibbon);
    if (silkRibbons.length > 6) silkRibbons.shift();
  }

  function moveRibbonAt(clientX, clientY) {
    var pos = getCanvasPos(clientX, clientY);
    if (!pos.valid) return;

    if (!activeRibbon) {
      activeRibbon = { points: [] };
      silkRibbons.push(activeRibbon);
      if (silkRibbons.length > 6) silkRibbons.shift();
    }

    var pts = activeRibbon.points;
    var lastPt = pts.length > 0 ? pts[pts.length - 1] : null;
    if (!lastPt || Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y) > 2.5) {
      var smoothX = lastPt ? (lastPt.x * 0.28 + pos.x * 0.72) : pos.x;
      var smoothY = lastPt ? (lastPt.y * 0.28 + pos.y * 0.72) : pos.y;
      pts.push({
        x: smoothX,
        y: smoothY,
        age: 0,
        phase: (pts.length * 0.3)
      });
      if (pts.length > 16) {
        pts.shift();
      }
    }
  }

  function endRibbon() {
    isCoverPointerDown = false;
    activeRibbon = null;
  }

  // PC 마우스 전용 포인터 리스너 (터치는 아래 touch 이벤트에서 전담)
  pointerDownListener = function(e) {
    if (e.pointerType === 'touch') return;
    startRibbonAt(e.clientX, e.clientY);
  };

  pointerMoveListener = function(e) {
    if (e.pointerType === 'touch') return;
    moveRibbonAt(e.clientX, e.clientY);
  };

  pointerUpListener = function(e) {
    if (e && e.pointerType === 'touch') return;
    endRibbon();
  };

  // 모바일(iOS + 갤럭시 안드로이드) 전용 터치 리스너
  touchStartListener = function(e) {
    if (e.touches && e.touches.length > 0) {
      startRibbonAt(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  touchMoveListener = function(e) {
    if (e.touches && e.touches.length > 0) {
      moveRibbonAt(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  touchEndListener = function() {
    endRibbon();
  };

  window.addEventListener('pointerdown', pointerDownListener, { passive: true });
  window.addEventListener('pointermove', pointerMoveListener, { passive: true });
  window.addEventListener('pointerup', pointerUpListener, { passive: true });

  window.addEventListener('touchstart', touchStartListener, { passive: true });
  window.addEventListener('touchmove', touchMoveListener, { passive: true });
  window.addEventListener('touchend', touchEndListener, { passive: true });
  window.addEventListener('touchcancel', touchEndListener, { passive: true });

  var waveTime = 0;
  var MAX_RIBBON_AGE = 48;

  function getSingleSmoothedSpine(pts) {
    var len = pts.length;
    var raw = [];
    for (var i = 0; i < len; i++) {
      var p = pts[i];
      var env = len > 1 ? Math.sin((i / (len - 1)) * Math.PI) : 0;
      var waveOffset = Math.sin(waveTime * 2.0 + p.phase) * 3.5 * env;
      raw.push({
        x: p.x + waveOffset,
        y: p.y - (p.age * 0.22) + Math.cos(waveTime * 1.6 + p.phase) * 2.0 * env,
        age: p.age
      });
    }

    if (len >= 3) {
      for (var pass = 0; pass < 2; pass++) {
        var next = [raw[0]];
        for (var j = 1; j < len - 1; j++) {
          next.push({
            x: raw[j - 1].x * 0.25 + raw[j].x * 0.5 + raw[j + 1].x * 0.25,
            y: raw[j - 1].y * 0.25 + raw[j].y * 0.5 + raw[j + 1].y * 0.25,
            age: raw[j].age
          });
        }
        next.push(raw[len - 1]);
        raw = next;
      }
    }
    return raw;
  }

  // 🌟 선분 마디마다 끊어서 stroke()를 호출할 때 round cap이 겹쳐 점처럼 보이던 현상을 완벽히 제거하고, 처음부터 끝까지 단 하나의 이어진 경로로 매끄럽게 그리는 렌더러
  function drawUnifiedSmoothRibbon(pts) {
    if (pts.length < 2) return;
    var sPts = getSingleSmoothedSpine(pts);
    var len = sPts.length;

    var headAge = sPts[len - 1].age;
    var lifeRatio = Math.max(0, 1 - (headAge / MAX_RIBBON_AGE));
    var ribbonFade = lifeRatio * lifeRatio;
    if (ribbonFade <= 0.01) return;

    var startPt = sPts[0];
    var endPt = sPts[len - 1];
    var dist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    if (dist < 1.5) return;

    var gradPasses = [
      { width: 22.0, alpha: 0.038, r: 205, g: 230, b: 255 },
      { width: 12.0, alpha: 0.065, r: 220, g: 238, b: 255 },
      { width: 6.0,  alpha: 0.105, r: 240, g: 248, b: 255 },
      { width: 2.2,  alpha: 0.175, r: 255, g: 255, b: 255 }
    ];

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 하나의 이어진 전체 경로를 한 번만 구성
    ctx.beginPath();
    ctx.moveTo(sPts[0].x, sPts[0].y);
    for (var i = 1; i < len - 1; i++) {
      var midX = (sPts[i].x + sPts[i + 1].x) * 0.5;
      var midY = (sPts[i].y + sPts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(sPts[i].x, sPts[i].y, midX, midY);
    }
    ctx.lineTo(sPts[len - 1].x, sPts[len - 1].y);

    // 꼬리(투명)에서 머리(발광)로 자연스럽게 이어지는 선형 그라데이션을 사용하여 중간 마디 점이 전혀 생기지 않도록 렌더링
    for (var g = 0; g < gradPasses.length; g++) {
      var gp = gradPasses[g];
      var maxA = gp.alpha * ribbonFade;
      if (maxA < 0.003) continue;

      var lineGrad = ctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
      lineGrad.addColorStop(0, 'rgba(' + gp.r + ', ' + gp.g + ', ' + gp.b + ', 0)');
      lineGrad.addColorStop(0.35, 'rgba(' + gp.r + ', ' + gp.g + ', ' + gp.b + ', ' + (maxA * 0.45).toFixed(4) + ')');
      lineGrad.addColorStop(0.85, 'rgba(' + gp.r + ', ' + gp.g + ', ' + gp.b + ', ' + maxA.toFixed(4) + ')');
      lineGrad.addColorStop(1, 'rgba(' + gp.r + ', ' + gp.g + ', ' + gp.b + ', ' + (maxA * 0.65).toFixed(4) + ')');

      ctx.lineWidth = gp.width;
      ctx.strokeStyle = lineGrad;
      ctx.stroke();
    }
  }

  // 🌟 짧은 터치(탭) 시 피어나는 윤슬 물결 파동 & 별가루 렌더러
  function drawTapRipple(rp) {
    var prog = rp.age / rp.maxAge;
    if (prog >= 1) return;

    var easeOut = 1 - Math.pow(1 - prog, 3);
    var fade = Math.pow(1 - prog, 1.75);
    var curRadius = 3 + rp.maxRadius * easeOut;

    // 1. 중심의 부드러운 윤슬 빛무리
    var glowR = curRadius * 1.15;
    var radGrad = ctx.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, glowR);
    radGrad.addColorStop(0, 'rgba(255, 255, 255, ' + (0.24 * fade).toFixed(4) + ')');
    radGrad.addColorStop(0.45, 'rgba(215, 235, 255, ' + (0.10 * fade).toFixed(4) + ')');
    radGrad.addColorStop(1, 'rgba(205, 230, 255, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 2. 바깥으로 퍼져나가는 외곽 윤슬 링
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, curRadius, 0, Math.PI * 2);
    ctx.lineWidth = 1.6 * (1 - prog * 0.5);
    ctx.strokeStyle = 'rgba(235, 246, 255, ' + (0.28 * fade).toFixed(4) + ')';
    ctx.stroke();

    // 3. 시차를 두고 따라오는 안쪽 2차 물결 링
    if (prog > 0.14) {
      var innerProg = (prog - 0.14) / 0.86;
      var innerEase = 1 - Math.pow(1 - innerProg, 2.5);
      var innerRadius = 2 + rp.maxRadius * 0.68 * innerEase;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, innerRadius, 0, Math.PI * 2);
      ctx.lineWidth = 1.0 * (1 - innerProg * 0.5);
      ctx.strokeStyle = 'rgba(205, 230, 255, ' + (0.18 * (1 - innerProg)).toFixed(4) + ')';
      ctx.stroke();
    }

    // 4. 터치 지점에서 사방으로 잔잔하게 흩어지는 미세 별가루
    for (var s = 0; s < rp.sparks.length; s++) {
      var sp = rp.sparks[s];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vx *= 0.95;
      sp.vy *= 0.95;

      var spAlpha = 0.42 * fade;
      if (spAlpha > 0.01) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * (0.4 + 0.6 * fade), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + spAlpha.toFixed(4) + ')';
        ctx.fill();
      }
    }
  }

  (function renderCover() {
    coverAnimId = requestAnimationFrame(renderCover);
    waveTime += 0.04;
    var curW = canvas.width;
    var curH = canvas.height;
    ctx.clearRect(0, 0, curW, curH);

    // 1. 기본 배경 부유 빛 입자 렌더링
    ctx.globalCompositeOperation = 'source-over';
    for (var i = 0; i < coverParticles.length; i++) {
      var p = coverParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.phase += 0.03;
      if (p.y < -10) { p.y = curH + 10; p.x = Math.random() * curW; }
      if (p.x < -10) p.x = curW + 10;
      else if (p.x > curW + 10) p.x = -10;

      var alpha = 0.2 + Math.sin(p.phase) * 0.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.max(0.05, alpha) + ')';
      ctx.fill();
    }

    // 🌟 'lighter' 가산 혼합 모드로 터치 윤슬 파동 및 연속 실크 선 렌더링
    ctx.globalCompositeOperation = 'lighter';

    for (var tr = tapRipples.length - 1; tr >= 0; tr--) {
      var rp = tapRipples[tr];
      rp.age += 1;
      if (rp.age >= rp.maxAge) {
        tapRipples.splice(tr, 1);
        continue;
      }
      drawTapRipple(rp);
    }

    for (var r = silkRibbons.length - 1; r >= 0; r--) {
      var ribbon = silkRibbons[r];
      var pts = ribbon.points;

      for (var k = pts.length - 1; k >= 0; k--) {
        pts[k].age += 1;
        if (pts[k].age > MAX_RIBBON_AGE) {
          pts.splice(k, 1);
        }
      }

      if (pts.length === 0) {
        if (ribbon !== activeRibbon) {
          silkRibbons.splice(r, 1);
        }
        continue;
      }

      if (pts.length >= 2) {
        drawUnifiedSmoothRibbon(pts);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  })();
}

function stopCoverWaveCanvas() {
  if (coverAnimId) {
    cancelAnimationFrame(coverAnimId);
    coverAnimId = null;
  }
  if (pointerDownListener) {
    window.removeEventListener('pointerdown', pointerDownListener);
    pointerDownListener = null;
  }
  if (pointerMoveListener) {
    window.removeEventListener('pointermove', pointerMoveListener);
    pointerMoveListener = null;
  }
  if (pointerUpListener) {
    window.removeEventListener('pointerup', pointerUpListener);
    pointerUpListener = null;
  }
  if (touchStartListener) {
    window.removeEventListener('touchstart', touchStartListener);
    touchStartListener = null;
  }
  if (touchMoveListener) {
    window.removeEventListener('touchmove', touchMoveListener);
    touchMoveListener = null;
  }
  if (touchEndListener) {
    window.removeEventListener('touchend', touchEndListener);
    window.removeEventListener('touchcancel', touchEndListener);
    touchEndListener = null;
  }
  silkRibbons = [];
  tapRipples = [];
  activeRibbon = null;
  var canvas = document.getElementById('cover-wave-canvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}