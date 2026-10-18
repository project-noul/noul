window.currentExtractedTexture = null;
var currentExtractedTexture = null;

function createFallbackDummyTexture(color1, color2) {
  var c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  var ctx = c.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, color1 || '#ffffff');
  grad.addColorStop(1, color2 || '#e5e7eb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  return c.toDataURL('image/png');
}

var activeCustomTab = 'wing';
var selectedButterflyShape = 'crescent';
var selectedAntennaType = 'ball';
var selectedPatternId = 'crescent_none';
var selectedBodyColor = 'blur';

window.currentSelected3DPatternPath = null;
var currentSelected3DPatternPath = null;

var patternImageCache = {};

function preloadAllPatternThumbnails() {
  if (typeof wingPatternDataset === 'undefined') return;
  
  preloadPatternsForShape(selectedButterflyShape);

  setTimeout(function() {
    Object.keys(wingPatternDataset).forEach(function(shapeKey) {
      if (shapeKey !== selectedButterflyShape) {
        preloadPatternsForShape(shapeKey);
      }
    });
  }, 1200);
}

function preloadPatternsForShape(shapeKey) {
  var pList = wingPatternDataset[shapeKey] || [];
  pList.forEach(function(item) {
    if (item && item.path) {
      preloadPatternImage(item.path);
      var path3D = get3DPatternPath(shapeKey, item.id);
      if (path3D) preloadPatternImage(path3D);
    }
  });
}

function preloadPatternImage(path) {
  if (!path) return;
  if (!patternImageCache[path]) {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
      patternImageCache[path] = img;
    };
    img.onerror = function() {
      patternImageCache[path] = null;
    };
    img.src = path;
  }
}

function get3DPatternPath(shape, patternId) {
  if (!patternId || patternId.indexOf('none') > -1) return null;

  var parts = patternId.split('_');
  var patNum = parts[parts.length - 1] || "1";

  var shapeFilePrefix = shape || 'crescent';
  if (shapeFilePrefix === 'moon-halo' || shapeFilePrefix === 'moon') shapeFilePrefix = 'moon-halo';
  else if (shapeFilePrefix === 'dawn-ray' || shapeFilePrefix === 'dawn') shapeFilePrefix = 'dawn-ray';
  else if (shapeFilePrefix === 'wave-fin' || shapeFilePrefix === 'wave') shapeFilePrefix = 'wave-fin';

  return '3DButterfly_pattern/' + shapeFilePrefix + '_pattern_3D_' + patNum + '.png';
}

function preloadSingleWingPattern(shape, patternId) {
  var path3D = get3DPatternPath(shape, patternId);
  if (path3D) preloadPatternImage(path3D);
}

function getSelectedPatternObject() {
  if (typeof wingPatternDataset === 'undefined') return null;
  var patterns = wingPatternDataset[selectedButterflyShape] || wingPatternDataset['crescent'] || [];
  return patterns.find(function(p) { return p.id === selectedPatternId; }) || patterns[0] || null;
}

var butterflyPathData = {};
if (typeof wingDataset !== 'undefined') {
  wingDataset.forEach(function(w) { butterflyPathData[w.id] = w; });
}

var bodyBlurSyncRafId = null;
function syncHeroBodyBlurImage() {
  if (selectedBodyColor !== 'blur') return;
  if (bodyBlurSyncRafId) return;
  bodyBlurSyncRafId = requestAnimationFrame(function() {
    bodyBlurSyncRafId = null;
    var blurImgEl = document.getElementById('hero-body-blur-img');
    if (blurImgEl && typeof alignCanvas !== 'undefined' && alignCanvas) {
      try {
        blurImgEl.setAttribute('href', alignCanvas.toDataURL('image/jpeg', 0.72));
      } catch (e) {}
    }
  });
}

function updateHeroPreview() {
  var heroSvg = document.getElementById('hero-butterfly-svg');
  var heroPathContainer = document.getElementById('hero-path-container');
  if (!heroSvg || !heroPathContainer || typeof wingDataset === 'undefined') return;

  var currentWing = butterflyPathData[selectedButterflyShape] || wingDataset[0];
  var ant = antennaDataset.find(function(a) { return a.id === selectedAntennaType; }) || antennaDataset[0];

  heroSvg.setAttribute('viewBox', currentWing.viewBox || '0 0 1000 1000');

  var wingD = currentWing.wingD || currentWing.d;
  var bodyD = currentWing.bodyD || "";
  var pat = getSelectedPatternObject();

  var patternSvgEl = "";
  if (pat && pat.path) {
    preloadPatternImage(pat.path);
    preloadSingleWingPattern(selectedButterflyShape, selectedPatternId);
    patternSvgEl = 
      '<g opacity="0.95" style="mix-blend-mode: multiply;">' +
        '<image href="' + pat.path + '" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/>' +
      '</g>';
  }

  var bodyExtraDefs = "";
  var bodyAndAntennaSvgEl = "";

  if (selectedBodyColor === 'black') {
    bodyAndAntennaSvgEl =
      (bodyD ? '<path d="' + bodyD + '" fill="#000000"/>' : '') +
      '<g transform="translate(' + currentWing.headX + ', ' + currentWing.headY + ')" color="#000000">' +
        ant.render(10.5) +
      '</g>';
  } else if (selectedBodyColor === 'blur') {
    var canvasDataUrl = "";
    if (typeof alignCanvas !== 'undefined' && alignCanvas && typeof rawImage !== 'undefined' && rawImage && rawImage.width) {
      try {
        canvasDataUrl = alignCanvas.toDataURL('image/jpeg', 0.72);
      } catch (e) {
        canvasDataUrl = createFallbackDummyTexture();
      }
    } else {
      canvasDataUrl = createFallbackDummyTexture();
    }
    bodyExtraDefs =
      '<mask id="hero-body-ant-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1400" height="1400">' +
        '<rect x="-200" y="-200" width="1400" height="1400" fill="black"/>' +
        (bodyD ? '<path d="' + bodyD + '" fill="white" fill-rule="nonzero"/>' : '') +
        '<g transform="translate(' + currentWing.headX + ', ' + currentWing.headY + ')" color="#ffffff">' +
          ant.render(10.5) +
        '</g>' +
      '</mask>' +
      '<filter id="hero-body-blur-filter" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur stdDeviation="18" />' +
      '</filter>';
    bodyAndAntennaSvgEl =
      '<g mask="url(#hero-body-ant-mask)">' +
        '<rect x="0" y="0" width="1000" height="1000" fill="#d4d4d8"/>' +
        '<image id="hero-body-blur-img" href="' + canvasDataUrl + '" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none" filter="url(#hero-body-blur-filter)"/>' +
      '</g>';
  } else {
    bodyAndAntennaSvgEl =
      (bodyD ? '<path d="' + bodyD + '" fill="#ffffff"/>' : '') +
      '<g transform="translate(' + currentWing.headX + ', ' + currentWing.headY + ')" filter="url(#antenna-subtle-contrast)" color="#ffffff">' +
        ant.render(10.5) +
      '</g>';
  }

  heroPathContainer.innerHTML = 
    '<defs>' +
      '<mask id="butterfly-outside-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1400" height="1400">' +
        '<rect x="-200" y="-200" width="1400" height="1400" fill="white"/>' +
        '<path d="' + wingD + '" fill="black" fill-rule="nonzero"/>' +
      '</mask>' +
      '<clipPath id="hero-wing-exact-clip">' +
        '<path d="' + wingD + '" fill-rule="nonzero"/>' +
      '</clipPath>' +
      bodyExtraDefs +
    '</defs>' +
    '<rect x="-200" y="-200" width="1400" height="1400" fill="rgba(0, 0, 0, 0.72)" mask="url(#butterfly-outside-mask)"/>' +
    '<g clip-path="url(#hero-wing-exact-clip)">' +
      patternSvgEl +
    '</g>' +
    bodyAndAntennaSvgEl;
}

var carouselContainer = document.getElementById('arch-carousel-container');

function renderCarouselItems() {
  if (!carouselContainer || typeof wingDataset === 'undefined') return;
  carouselContainer.innerHTML = '';
  
  var dataset = [];
  if (activeCustomTab === 'wing') {
    dataset = wingDataset;
  } else if (activeCustomTab === 'pattern') {
    if (typeof wingPatternDataset !== 'undefined') {
      dataset = wingPatternDataset[selectedButterflyShape] || wingPatternDataset['crescent'] || [];
    }
  } else if (activeCustomTab === 'antenna') {
    dataset = antennaDataset;
  }

  dataset.forEach(function(item) {
    var isActive = false;
    if (activeCustomTab === 'wing') isActive = (item.id === selectedButterflyShape);
    else if (activeCustomTab === 'pattern') isActive = (item.id === selectedPatternId);
    else if (activeCustomTab === 'antenna') isActive = (item.id === selectedAntennaType);

    var div = document.createElement('div');
    div.className = 'arch-track-item';
    var contentHtml = '';

    if (activeCustomTab === 'wing') {
      var wingPath = item.wingD || item.d;
      var bodyPath = item.bodyD || "";
      contentHtml = '<svg viewBox="' + item.viewBox + '" preserveAspectRatio="xMidYMid meet">' +
        '<path d="' + wingPath + '" fill="currentColor" fill-rule="nonzero"/>' +
        (bodyPath ? '<path d="' + bodyPath + '" fill="currentColor"/>' : '') +
        '</svg>';
    } else if (activeCustomTab === 'pattern') {
      if (item.path) {
        preloadPatternImage(item.path);
        preloadSingleWingPattern(selectedButterflyShape, item.id);
        contentHtml = '<img class="pattern-thumb-img" src="' + encodeURI(item.path) + '" alt="" onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'block\';" />' +
          '<svg viewBox="0 0 40 40" style="display:none; width:65%; height:65%;"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-dasharray="2,2" stroke-width="1.2"/></svg>';
      } else {
        contentHtml = '<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">' + (item.thumb || '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-dasharray="3,3" stroke-width="1.5"/>') + '</svg>';
      }
    } else if (activeCustomTab === 'antenna') {
      contentHtml = '<svg viewBox="-26 -30 52 38" preserveAspectRatio="xMidYMid meet"><g>' + item.render(1.1) + '</g></svg>';
    }

    div.innerHTML = '<button type="button" class="shape-thumb-btn ' + (isActive ? 'active' : '') + '" data-type="' + activeCustomTab + '" data-id="' + item.id + '">' + contentHtml + '</button><span class="shape-item-label text-[11px] ' + (isActive ? 'font-bold text-white' : 'font-medium text-neutral-500') + ' tracking-tight">' + item.name + '</span>';
    carouselContainer.appendChild(div);
  });

  bindItemClickEvents();
  updateCarouselPadding();
  applyStraightSelection();

  setTimeout(function() {
    var activeBtn = carouselContainer.querySelector('.shape-thumb-btn.active');
    if (activeBtn) snapItemToExactCenter(activeBtn.closest('.arch-track-item'));
  }, 50);
}

function bindItemClickEvents() {
  if (!carouselContainer) return;
  carouselContainer.querySelectorAll('.shape-thumb-btn').forEach(function(btn) {
    btn.onclick = function() {
      setActiveItemVisual(btn);
      snapItemToExactCenter(btn.closest('.arch-track-item'));
    };
  });
}

function updateCarouselPadding() {
  if (!carouselContainer) return;
  var firstItem = carouselContainer.querySelector('.arch-track-item');
  if (firstItem) {
    var pad = Math.max(0, (carouselContainer.clientWidth - firstItem.offsetWidth) / 2);
    carouselContainer.style.paddingLeft = pad + 'px';
    carouselContainer.style.paddingRight = pad + 'px';
  }
}

function applyStraightSelection() {
  if (!carouselContainer) return;
  var cWidth = carouselContainer.clientWidth, centerX = carouselContainer.scrollLeft + (cWidth / 2);
  var items = carouselContainer.querySelectorAll('.arch-track-item');
  var centerDetectedItem = null, minDistance = Infinity;

  items.forEach(function(item) {
    var dist = Math.abs(centerX - (item.offsetLeft + item.offsetWidth / 2));
    if (dist < minDistance) { minDistance = dist; centerDetectedItem = item; }
    item.style.transform = 'none';
    item.style.opacity = Math.max(0.35, 1 - (dist / (cWidth * 0.42))).toFixed(2);
  });

  if (centerDetectedItem && minDistance <= 36) {
    var btn = centerDetectedItem.querySelector('.shape-thumb-btn');
    if (btn && !btn.classList.contains('active')) setActiveItemVisual(btn);
  }
}

function setActiveItemVisual(btn) {
  carouselContainer.querySelectorAll('.shape-thumb-btn').forEach(function(b) {
    b.classList.remove('active');
    var txt = b.parentElement.querySelector('.shape-item-label');
    if (txt) { txt.classList.remove('font-bold', 'text-white'); txt.classList.add('font-medium', 'text-neutral-500'); }
  });
  btn.classList.add('active');
  var activeTxt = btn.parentElement.querySelector('.shape-item-label');
  if (activeTxt) { activeTxt.classList.add('font-bold', 'text-white'); activeTxt.classList.remove('font-medium', 'text-neutral-500'); }

  var type = btn.getAttribute('data-type'), id = btn.getAttribute('data-id');
  if (type === 'wing') { 
    selectedButterflyShape = id; 
    var currentPatterns = (typeof wingPatternDataset !== 'undefined' && wingPatternDataset[selectedButterflyShape]) ? wingPatternDataset[selectedButterflyShape] : [];
    selectedPatternId = currentPatterns.length > 0 ? currentPatterns[0].id : (selectedButterflyShape + '_none');
    preloadSingleWingPattern(selectedButterflyShape, selectedPatternId);
    drawAlignCanvas(); 
  } else if (type === 'pattern') {
    selectedPatternId = id;
    var curObj = getSelectedPatternObject();
    if (curObj && curObj.path) preloadPatternImage(curObj.path);
    preloadSingleWingPattern(selectedButterflyShape, selectedPatternId);
    drawAlignCanvas();
  } else if (type === 'antenna') { 
    selectedAntennaType = id; 
  }
  updateHeroPreview();
}

function snapItemToExactCenter(itemElement) {
  if (!carouselContainer || !itemElement) return;
  var targetScroll = itemElement.offsetLeft - ((carouselContainer.clientWidth - itemElement.offsetWidth) / 2);
  carouselContainer.scrollTo({ left: targetScroll, behavior: 'smooth' });
}

function autoSnapToNearestCenter() {
  if (!carouselContainer) return;
  var centerX = carouselContainer.scrollLeft + (carouselContainer.clientWidth / 2);
  var closestItem = null, minDistance = Infinity;
  carouselContainer.querySelectorAll('.arch-track-item').forEach(function(item) {
    var dist = Math.abs(centerX - (item.offsetLeft + item.offsetWidth / 2));
    if (dist < minDistance) { minDistance = dist; closestItem = item; }
  });
  if (closestItem) {
    var btn = closestItem.querySelector('.shape-thumb-btn');
    if (btn) setActiveItemVisual(btn);
    snapItemToExactCenter(closestItem);
  }
}

if (carouselContainer) {
  var scrollTimer = null;
  carouselContainer.addEventListener('scroll', function() {
    applyStraightSelection();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(autoSnapToNearestCenter, 100);
  }, { passive: true });
}

window.addEventListener('resize', function() {
  updateCarouselPadding(); 
  applyStraightSelection();
});

var tabWing = document.getElementById('tab-wing');
var tabPattern = document.getElementById('tab-pattern');
var tabAntenna = document.getElementById('tab-antenna');
var tabBlur = document.getElementById('tab-blur');
var shapeTitle = document.getElementById('shape-screen-title');
var shapeDesc = document.getElementById('shape-screen-desc');
var blurSliderBox = document.getElementById('blur-slider-box');
var carouselStage = document.getElementById('carousel-stage');

function switchTab(tabKey) {
  activeCustomTab = tabKey;
  [tabWing, tabPattern, tabAntenna, tabBlur].forEach(function(b) { if (b) b.classList.remove('active-tab'); });
  
  if (tabKey === 'wing') {
    if (shapeTitle) shapeTitle.innerText = "날개 형태 고르기";
    if (shapeDesc) shapeDesc.innerHTML = "<strong class='text-white'>[드래그]</strong> 이동, <strong class='text-white'>[두 손가락 핀치]</strong> 확대/축소";
  } else if (tabKey === 'pattern') {
    if (shapeTitle) shapeTitle.innerText = "날개 무늬 고르기";
    if (shapeDesc) shapeDesc.innerHTML = "원하는 고유 무늬를 선택해 날개에 새겨보세요";
    var currentPatterns = (typeof wingPatternDataset !== 'undefined' && wingPatternDataset[selectedButterflyShape]) ? wingPatternDataset[selectedButterflyShape] : [];
    if (!currentPatterns.some(function(p) { return p.id === selectedPatternId; })) {
      selectedPatternId = currentPatterns.length > 0 ? currentPatterns[0].id : (selectedButterflyShape + '_none');
    }
  } else if (tabKey === 'antenna') {
    if (shapeTitle) shapeTitle.innerText = "더듬이 모양 고르기";
    if (shapeDesc) shapeDesc.innerHTML = "나비의 인상을 결정할 더듬이를 선택해 보세요";
  } else if (tabKey === 'blur') {
    if (shapeTitle) shapeTitle.innerText = "질감 및 대칭 조정";
    if (shapeDesc) shapeDesc.innerHTML = "색상의 부드러움과 좌우 대칭을 조절해 보세요";
  }

  if (tabKey === 'wing' || tabKey === 'pattern' || tabKey === 'antenna') {
    var activeTabEl = tabKey === 'wing' ? tabWing : (tabKey === 'pattern' ? tabPattern : tabAntenna);
    if (activeTabEl) activeTabEl.classList.add('active-tab');
    if (blurSliderBox) blurSliderBox.classList.add('hidden-slider');
    if (carouselStage) carouselStage.style.display = 'flex';
    requestAnimationFrame(renderCarouselItems);
  } else if (tabKey === 'blur') {
    if (tabBlur) tabBlur.classList.add('active-tab');
    if (blurSliderBox) blurSliderBox.classList.remove('hidden-slider');
    if (carouselStage) carouselStage.style.display = 'none';
  }
}

if (tabWing) tabWing.onclick = function() { switchTab('wing'); };
if (tabPattern) tabPattern.onclick = function() { switchTab('pattern'); };
if (tabAntenna) tabAntenna.onclick = function() { switchTab('antenna'); };
if (tabBlur) tabBlur.onclick = function() { switchTab('blur'); };

var btnRephoto = document.getElementById('btn-rephoto-from-shape');
if (btnRephoto) {
  btnRephoto.onclick = function() {
    if (cameraInput) cameraInput.value = '';
    if (albumInput) albumInput.value = '';
    showScreen('screen-capture-guide');
  };
}

var btnConfirmShape = document.getElementById('btn-confirm-shape');
if (btnConfirmShape) {
  btnConfirmShape.onclick = async function() {
    btnConfirmShape.disabled = true;
    try {
      await exportAlignedTexture();
    } catch(err) {
      console.warn("텍스처 추출 중 예외 발생, 기본 진행:", err);
    } finally {
      btnConfirmShape.disabled = false;
      showScreen('screen-loading');
      startAnswerShowcaseSequence();
    }
  };
}

function executeReliableFastBlur(canvas, radius) {
  if (radius <= 0.2) return;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var w = canvas.width, h = canvas.height;
  var imgData = ctx.getImageData(0, 0, w, h);
  var src = imgData.data;
  var r = Math.max(1, Math.round(radius)), kernelSize = r * 2 + 1;
  var temp = new Uint8ClampedArray(src.length);

  for (var y = 0; y < h; y++) {
    var rowStart = y * w * 4, rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    for (var i = -r; i <= r; i++) {
      var px = Math.min(w - 1, Math.max(0, i)), pIndex = rowStart + px * 4;
      rSum += src[pIndex]; gSum += src[pIndex + 1]; bSum += src[pIndex + 2]; aSum += src[pIndex + 3];
    }
    for (var x = 0; x < w; x++) {
      var outIndex = rowStart + x * 4;
      temp[outIndex] = rSum / kernelSize; temp[outIndex + 1] = gSum / kernelSize; temp[outIndex + 2] = bSum / kernelSize; temp[outIndex + 3] = aSum / kernelSize;
      var remIdx = rowStart + Math.min(w - 1, Math.max(0, x - r)) * 4;
      var addIdx = rowStart + Math.min(w - 1, Math.max(0, x + r + 1)) * 4;
      rSum += src[addIdx] - src[remIdx]; gSum += src[addIdx + 1] - src[remIdx + 1]; bSum += src[addIdx + 2] - src[remIdx + 2]; aSum += src[addIdx + 3] - src[remIdx + 3];
    }
  }

  for (var x = 0; x < w; x++) {
    var rSum2 = 0, gSum2 = 0, bSum2 = 0, aSum2 = 0;
    for (var i = -r; i <= r; i++) {
      var py = Math.min(h - 1, Math.max(0, i)), pIndex2 = (py * w + x) * 4;
      rSum2 += temp[pIndex2]; gSum2 += temp[pIndex2 + 1]; bSum2 += temp[pIndex2 + 2]; aSum2 += temp[pIndex2 + 3];
    }
    for (var y = 0; y < h; y++) {
      var outIndex2 = (y * w + x) * 4;
      src[outIndex2] = rSum2 / kernelSize; src[outIndex2 + 1] = gSum2 / kernelSize; src[outIndex2 + 2] = bSum2 / kernelSize; src[outIndex2 + 3] = aSum2 / kernelSize;
      var remIdx2 = (Math.min(h - 1, Math.max(0, y - r)) * w + x) * 4;
      var addIdx2 = (Math.min(h - 1, Math.max(0, y + r + 1)) * w + x) * 4;
      rSum2 += temp[addIdx2] - temp[remIdx2]; gSum2 += temp[addIdx2 + 1] - temp[remIdx2 + 1]; bSum2 += temp[addIdx2 + 2] - temp[remIdx2 + 2]; aSum2 += temp[addIdx2 + 3] - temp[remIdx2 + 3];
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

var rawImage = new Image();
var alignCanvas = document.getElementById('align-canvas');
var actx = alignCanvas ? alignCanvas.getContext('2d', { willReadFrequently: true }) : null;
var imgX = 0, imgY = 0, imgScale = 1.0, baseImgScale = 1.0;
var isDragging = false, startX = 0, startY = 0, startPinchDist = 0, pinchStartScale = 1.0;
var currentBlurPx = 0, isSymmetryEnabled = false;

function clampImgScale(val) {
  var ref = baseImgScale > 0 ? baseImgScale : 1.0;
  var minS = ref * 0.2;
  var maxS = ref * 8.0;
  return Math.max(minS, Math.min(maxS, val));
}

var blurSlider = document.getElementById('blur-slider');
var toggleSymmetryBtn = document.getElementById('toggle-symmetry-btn');
var bodyColorBtns = document.querySelectorAll('.body-color-btn');

// 🌟 사진이 겹쳐지지 않는 빈 날개 영역을 선택된 몸통 색상(흰색 / 검은색 / 사진 블러)으로 채우는 헬퍼
function fillUnoccupiedWingSpace(ctx, width, height) {
  if (!ctx) return;
  if (selectedBodyColor === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  } else if (selectedBodyColor === 'blur') {
    if (rawImage && rawImage.width && rawImage.height) {
      var bgCanvas = document.createElement('canvas');
      bgCanvas.width = 128;
      bgCanvas.height = 128;
      var bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });
      var coverScale = Math.max(128 / rawImage.width, 128 / rawImage.height);
      var cw = rawImage.width * coverScale;
      var ch = rawImage.height * coverScale;
      var cx = (128 - cw) / 2;
      var cy = (128 - ch) / 2;
      bgCtx.fillStyle = '#d4d4d8';
      bgCtx.fillRect(0, 0, 128, 128);
      bgCtx.drawImage(rawImage, cx, cy, cw, ch);
      executeReliableFastBlur(bgCanvas, 14);
      ctx.drawImage(bgCanvas, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#d4d4d8';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
}

function setBodyColorMode(mode) {
  selectedBodyColor = mode || 'blur';
  if (bodyColorBtns && bodyColorBtns.length > 0) {
    bodyColorBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-body-color') === selectedBodyColor);
    });
  }
  drawAlignCanvas();
  updateHeroPreview();
}

if (bodyColorBtns && bodyColorBtns.length > 0) {
  bodyColorBtns.forEach(function(btn) {
    btn.onclick = function() {
      var mode = btn.getAttribute('data-body-color') || 'blur';
      setBodyColorMode(mode);
    };
  });
}

function updateSliderProgress(val, min, max) {
  if (!blurSlider) return;
  var minVal = parseFloat(min !== undefined ? min : (blurSlider.min || 0));
  var maxVal = parseFloat(max !== undefined ? max : (blurSlider.max || 25));
  var percent = Math.max(0, Math.min(100, ((parseFloat(val) - minVal) / (maxVal - minVal)) * 100));
  blurSlider.style.setProperty('--blur-percent', percent + '%');
}

function applyBlurValue(val) {
  currentBlurPx = parseFloat(val) || 0;
  updateSliderProgress(currentBlurPx);
  drawAlignCanvas();
}

if (blurSlider) {
  blurSlider.oninput = function(e) { applyBlurValue(e.target.value); };
  blurSlider.onchange = function(e) { applyBlurValue(e.target.value); };
}

if (toggleSymmetryBtn) {
  toggleSymmetryBtn.onclick = function() {
    isSymmetryEnabled = !isSymmetryEnabled;
    toggleSymmetryBtn.classList.toggle('toggle-active', isSymmetryEnabled);
    toggleSymmetryBtn.setAttribute('aria-pressed', isSymmetryEnabled ? 'true' : 'false');
    drawAlignCanvas();
  };
}

function handleFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      rawImage = img;
      if (blurSlider) { blurSlider.value = 0; currentBlurPx = 0; updateSliderProgress(0); }
      isSymmetryEnabled = false;
      if (toggleSymmetryBtn) { toggleSymmetryBtn.classList.remove('toggle-active'); toggleSymmetryBtn.setAttribute('aria-pressed', 'false'); }
      setBodyColorMode('blur');
      initAlignUI();
      showScreen('screen-shape-select');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

var cameraInput = document.getElementById('camera-input');
var albumInput = document.getElementById('album-input');
if (cameraInput) {
  cameraInput.onclick = function(e) { e.target.value = null; };
  cameraInput.onchange = function(e) { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); };
}
if (albumInput) {
  albumInput.onclick = function(e) { e.target.value = null; };
  albumInput.onchange = function(e) { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); };
}

function initAlignUI() {
  if (!rawImage || !rawImage.width || !alignCanvas) return;
  baseImgScale = alignCanvas.width / Math.min(rawImage.width, rawImage.height);
  imgScale = baseImgScale;
  imgX = (alignCanvas.width - rawImage.width * imgScale) / 2;
  imgY = (alignCanvas.height - rawImage.height * imgScale) / 2;
  drawAlignCanvas();
}

function drawAlignCanvas() {
  if (!alignCanvas || !actx) return;
  actx.clearRect(0, 0, alignCanvas.width, alignCanvas.height);

  var midX = alignCanvas.width / 2;
  var tempCanvas = document.createElement('canvas');
  tempCanvas.width = alignCanvas.width; tempCanvas.height = alignCanvas.height;
  var tctx = tempCanvas.getContext('2d', { willReadFrequently: true });

  // 🌟 사진이 겹쳐지지 않는 영역을 선택된 몸통 색상(흰색/검은색/사진 블러)으로 먼저 채움
  fillUnoccupiedWingSpace(tctx, alignCanvas.width, alignCanvas.height);

  if (rawImage && rawImage.width) {
    tctx.drawImage(rawImage, imgX, imgY, rawImage.width * imgScale, rawImage.height * imgScale);
  }

  if (currentBlurPx > 0) executeReliableFastBlur(tempCanvas, currentBlurPx * 0.9);

  if (!isSymmetryEnabled) {
    actx.drawImage(tempCanvas, 0, 0);
  } else {
    actx.drawImage(tempCanvas, 0, 0, midX, alignCanvas.height, 0, 0, midX, alignCanvas.height);
    actx.save();
    actx.translate(alignCanvas.width, 0); actx.scale(-1, 1);
    actx.drawImage(tempCanvas, 0, 0, midX, alignCanvas.height, 0, 0, midX, alignCanvas.height);
    actx.restore();
  }

  syncHeroBodyBlurImage();
}

var interactiveFrame = document.getElementById('interactive-align-frame');
if (interactiveFrame && alignCanvas) {
  interactiveFrame.onmousedown = function(e) {
    isDragging = true;
    var rect = alignCanvas.getBoundingClientRect(), sFactor = alignCanvas.width / rect.width;
    startX = (e.clientX - rect.left) * sFactor - imgX; startY = (e.clientY - rect.top) * sFactor - imgY;
  };
  window.addEventListener('mousemove', function(e) {
    if (!isDragging || !alignCanvas) return;
    var rect = alignCanvas.getBoundingClientRect(), sFactor = alignCanvas.width / rect.width;
    imgX = (e.clientX - rect.left) * sFactor - startX; imgY = (e.clientY - rect.top) * sFactor - startY;
    drawAlignCanvas();
  });
  window.addEventListener('mouseup', function() { isDragging = false; });
  interactiveFrame.addEventListener('wheel', function(e) {
    e.preventDefault();
    imgScale = clampImgScale(imgScale * (e.deltaY < 0 ? 1.06 : 0.94));
    drawAlignCanvas();
  }, { passive: false });

  interactiveFrame.addEventListener('touchstart', function(e) {
    var rect = alignCanvas.getBoundingClientRect(), sFactor = alignCanvas.width / rect.width;
    if (e.touches.length === 1) {
      isDragging = true;
      startX = (e.touches[0].clientX - rect.left) * sFactor - imgX; startY = (e.touches[0].clientY - rect.top) * sFactor - imgY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      startPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchStartScale = imgScale;
    }
  }, { passive: false });

  window.addEventListener('touchmove', function(e) {
    if (!document.getElementById('screen-shape-select').classList.contains('active')) return;
    var rect = alignCanvas.getBoundingClientRect(), sFactor = alignCanvas.width / rect.width;
    if (e.touches.length === 1 && isDragging) {
      if (e.cancelable) e.preventDefault();
      imgX = (e.touches[0].clientX - rect.left) * sFactor - startX; imgY = (e.touches[0].clientY - rect.top) * sFactor - startY;
      drawAlignCanvas();
    } else if (e.touches.length === 2 && startPinchDist > 0) {
      if (e.cancelable) e.preventDefault();
      var nextScale = pinchStartScale * (Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) / startPinchDist);
      imgScale = clampImgScale(nextScale);
      drawAlignCanvas();
    }
  }, { passive: false });

  function handleAlignTouchEnd(e) {
    startPinchDist = 0;
    if (e && e.touches && e.touches.length === 1 && alignCanvas) {
      var rect = alignCanvas.getBoundingClientRect();
      var sFactor = alignCanvas.width / rect.width;
      isDragging = true;
      startX = (e.touches[0].clientX - rect.left) * sFactor - imgX;
      startY = (e.touches[0].clientY - rect.top) * sFactor - imgY;
    } else {
      isDragging = false;
    }
  }
  window.addEventListener('touchend', handleAlignTouchEnd);
  window.addEventListener('touchcancel', handleAlignTouchEnd);
}

function exportAlignedTexture() {
  return new Promise(function(resolve) {
    currentSelected3DPatternPath = get3DPatternPath(selectedButterflyShape, selectedPatternId);
    window.currentSelected3DPatternPath = currentSelected3DPatternPath;

    if (!rawImage || !rawImage.width || !alignCanvas) {
      var fallbackColor1 = selectedBodyColor === 'black' ? '#000000' : '#ffffff';
      var fallbackColor2 = selectedBodyColor === 'black' ? '#000000' : '#e5e7eb';
      currentExtractedTexture = createFallbackDummyTexture(fallbackColor1, fallbackColor2);
      window.currentExtractedTexture = currentExtractedTexture;
      resolve(currentExtractedTexture);
      return;
    }

    // 🌟 WebGL 밉맵 및 비등방성 필터링(Anisotropy) 100% 활성화를 위해 2의 거듭제곱 표준 규격(1024x1024)으로 추출
    var scaleRatio = 1024 / alignCanvas.width;

    var finalCanvas = document.createElement('canvas');
    finalCanvas.width = 1024;
    finalCanvas.height = 1024;
    var fctx = finalCanvas.getContext('2d', { willReadFrequently: true });

    // 🌟 사진이 닿지 않는 빈 날개 영역을 선택된 몸통 색상(흰색/검은색/사진 블러)으로 먼저 채움
    fillUnoccupiedWingSpace(fctx, 1024, 1024);

    var scaledImgX = imgX * scaleRatio;
    var scaledImgY = imgY * scaleRatio;
    var scaledImgW = (rawImage.width * imgScale) * scaleRatio;
    var scaledImgH = (rawImage.height * imgScale) * scaleRatio;

    fctx.drawImage(rawImage, scaledImgX, scaledImgY, scaledImgW, scaledImgH);

    if (currentBlurPx > 0) {
      executeReliableFastBlur(finalCanvas, (currentBlurPx * 0.9) * scaleRatio);
    }

    if (isSymmetryEnabled) {
      var midX = 512;
      var symCanvas = document.createElement('canvas');
      symCanvas.width = 1024;
      symCanvas.height = 1024;
      var sctx = symCanvas.getContext('2d');

      sctx.drawImage(finalCanvas, 0, 0, midX, 1024, 0, 0, midX, 1024);
      sctx.save();
      sctx.translate(1024, 0);
      sctx.scale(-1, 1);
      sctx.drawImage(finalCanvas, 0, 0, midX, 1024, 0, 0, midX, 1024);
      sctx.restore();

      fctx.clearRect(0, 0, 1024, 1024);
      fctx.drawImage(symCanvas, 0, 0);
    }

    currentExtractedTexture = finalCanvas.toDataURL('image/png');
    window.currentExtractedTexture = currentExtractedTexture;
    resolve(currentExtractedTexture);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    preloadAllPatternThumbnails();
    drawAlignCanvas();
  });
} else {
  preloadAllPatternThumbnails();
  drawAlignCanvas();
}